import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  ActivationFailedEvent,
  ActivationRequestedEvent,
  createEnvelope,
  EVENT_TYPES,
} from '@activation-poc/contracts';
import { AfterCommit, EventPublisher } from '@activation-poc/kafka-toolkit';
import { BillingAccount } from './billing-account.entity';

/**
 * Los métodos reciben el "manager" de la transacción que abre EventConsumer: lo que se guarda con
 * él se confirma junto con el registro del evento en processed_events. Devuelven (si corresponde)
 * lo que hay que hacer DESPUÉS del commit: publicar el evento de salida.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(private readonly publisher: EventPublisher) {}

  /**
   * RF-04: procesa ActivationRequested y publica el resultado de billing.
   *  - Si la activación pidió fallar en billing  -> publica BillingFailed (no crea cuenta).
   *  - Si no                                      -> crea la cuenta y publica BillingAccountCreated.
   */
  async handleActivationRequested(
    event: ActivationRequestedEvent,
    manager: EntityManager,
  ): Promise<AfterCommit | void> {
    // El correlationId del evento es el activationId.
    const activationId = event.correlationId;
    this.logger.log(`ActivationRequested recibido (activación ${activationId}, cliente ${event.customerId})`);

    // Si ya hay una fila para esta activación, no creamos otra cuenta. Puede ser una cuenta ya creada,
    // o la marca CANCELLED que dejó handleActivationFailed cuando el fallo llegó antes que el pedido.
    const existing = await manager.getRepository(BillingAccount).findOneBy({ activationId });
    if (existing) {
      this.logger.warn(`Ya existe la cuenta ${existing.id} (${existing.status}) para ${activationId}; no se crea otra`);
      return;
    }

    // Un fallo simulado es un resultado de negocio, no un error técnico:
    // se publica como evento y NO va a la DLQ (sección 08 del PDF).
    if (event.payload.simulateFailure === 'billing') {
      return () =>
        this.publisher.publish(
          createEnvelope({
            eventType: EVENT_TYPES.BILLING_FAILED,
            correlationId: activationId,
            customerId: event.customerId,
            source: 'billing',
            payload: { reason: 'Fallo simulado en billing' },
          }),
        );
    }

    const account = await this.insertIfAbsent(manager, {
      id: `bill-${randomUUID().slice(0, 8)}`,
      activationId,
      customerId: event.customerId,
      status: 'CREATED',
    });
    if (!account) {
      // Otra instancia insertó una fila para esta activación justo antes que nosotros.
      this.logger.warn(`La activación ${activationId} ya tiene registro en billing; no se crea otra cuenta`);
      return;
    }

    return () =>
      this.publisher.publish(
        createEnvelope({
          eventType: EVENT_TYPES.BILLING_ACCOUNT_CREATED,
          correlationId: activationId,
          customerId: event.customerId,
          source: 'billing',
          payload: { billingAccountId: account.id },
        }),
      );
  }

  /**
   * Compensación (RF-07): si la activación falló, se cancela la cuenta de billing que se haya creado.
   *
   * Casos:
   *  1) Hay cuenta CREATED         -> pasa a CANCELLED y se publica BillingAccountCancelled.
   *  2) Ya estaba CANCELLED        -> evento repetido, no se hace nada.
   *  3) No hay cuenta todavía      -> ActivationFailed le ganó a ActivationRequested (viajan por
   *     topics distintos y Kafka no ordena entre topics). Se deja una fila CANCELLED como "marca":
   *     cuando llegue ActivationRequested, el chequeo de existencia la ignora y nunca se crea la cuenta.
   *  4) Falló el propio billing    -> no hay nada que cancelar.
   */
  async handleActivationFailed(
    event: ActivationFailedEvent,
    manager: EntityManager,
  ): Promise<AfterCommit | void> {
    const activationId = event.correlationId;
    this.logger.log(`ActivationFailed recibido (activación ${activationId}, paso ${event.payload.failedStep})`);

    if (event.payload.failedStep === 'billing') return;

    const repo = manager.getRepository(BillingAccount);
    const existing = await repo.findOneBy({ activationId });
    if (existing) return this.cancel(manager, existing, event);

    const marker = await this.insertIfAbsent(manager, {
      id: `bill-${randomUUID().slice(0, 8)}`,
      activationId,
      customerId: event.customerId,
      status: 'CANCELLED',
    });
    if (marker) {
      this.logger.log(`Sin cuenta para ${activationId}: se registra la cancelación por adelantado`);
      return;
    }

    // Mientras tanto, la cuenta se creó: ahora sí hay que cancelarla.
    const created = await repo.findOneBy({ activationId });
    if (created) return this.cancel(manager, created, event);
  }

  private async cancel(
    manager: EntityManager,
    account: BillingAccount,
    cause: ActivationFailedEvent,
  ): Promise<AfterCommit | void> {
    if (account.status === 'CANCELLED') {
      this.logger.warn(`La cuenta ${account.id} ya estaba cancelada; se ignora el evento`);
      return;
    }
    account.status = 'CANCELLED';
    await manager.getRepository(BillingAccount).save(account);
    this.logger.log(`Cuenta ${account.id} cancelada (compensación de ${cause.correlationId})`);

    // Igual que en el resto del POC: se publica después de confirmar (el outbox llega en la fase 4).
    return () =>
      this.publisher.publish(
        createEnvelope({
          eventType: EVENT_TYPES.BILLING_ACCOUNT_CANCELLED,
          correlationId: cause.correlationId,
          customerId: cause.customerId,
          source: 'billing',
          payload: {
            billingAccountId: account.id,
            reason: `Compensación: la activación falló en ${cause.payload.failedStep}`,
          },
        }),
      );
  }

  /**
   * Inserta la fila; si ya existe una para esa activación (índice único), devuelve null.
   * Se hace en una transacción anidada (SAVEPOINT): en PostgreSQL un error dentro de una
   * transacción la deja inutilizable, y así solo se deshace este INSERT y el resto sigue.
   */
  private async insertIfAbsent(
    manager: EntityManager,
    data: Partial<BillingAccount>,
  ): Promise<BillingAccount | null> {
    try {
      return await manager.transaction(async (nested) => {
        const repo = nested.getRepository(BillingAccount);
        return repo.save(repo.create(data));
      });
    } catch (err) {
      if (isUniqueViolation(err)) return null;
      throw err;
    }
  }
}

/** Error 23505 de PostgreSQL: se violó un índice único. */
function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; driverError?: { code?: string } };
  return e?.code === '23505' || e?.driverError?.code === '23505';
}
