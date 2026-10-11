import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ActivationFailedEvent,
  ActivationRequestedEvent,
  createEnvelope,
  EVENT_TYPES,
} from '@activation-poc/contracts';
import { EventPublisher } from '@activation-poc/kafka-toolkit';
import { BillingAccount } from './billing-account.entity';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @InjectRepository(BillingAccount) private readonly repo: Repository<BillingAccount>,
    private readonly publisher: EventPublisher,
  ) {}

  /**
   * RF-04: procesa ActivationRequested y publica el resultado de billing.
   *  - Si la activación pidió fallar en billing  -> publica BillingFailed (no crea cuenta).
   *  - Si no                                      -> crea la cuenta y publica BillingAccountCreated.
   */
  async handleActivationRequested(event: ActivationRequestedEvent): Promise<void> {
    // El correlationId del evento es el activationId.
    const activationId = event.correlationId;
    this.logger.log(`ActivationRequested recibido (activación ${activationId}, cliente ${event.customerId})`);

    // Protección básica: si ya hay una cuenta para esta activación, no creamos otra.
    // La idempotencia completa (tabla processed_events) llega en la fase 3.
    const existing = await this.repo.findOneBy({ activationId });
    if (existing) {
      this.logger.warn(`Ya existe la cuenta ${existing.id} para ${activationId}; se ignora el evento`);
      return;
    }

    // Un fallo simulado es un resultado de negocio, no un error técnico:
    // se publica como evento y NO va a la DLQ (sección 08 del PDF).
    if (event.payload.simulateFailure === 'billing') {
      await this.publisher.publish(
        createEnvelope({
          eventType: EVENT_TYPES.BILLING_FAILED,
          correlationId: activationId,
          customerId: event.customerId,
          source: 'billing',
          payload: { reason: 'Fallo simulado en billing' },
        }),
      );
      return;
    }

    let account: BillingAccount;
    try {
      account = await this.repo.save(
        this.repo.create({
          id: `bill-${randomUUID().slice(0, 8)}`,
          activationId,
          customerId: event.customerId,
          status: 'CREATED',
        }),
      );
    } catch (err) {
      // Otro mensaje insertó antes una fila para esta activación (por ejemplo, la marca de
      // cancelación de handleActivationFailed). No hay nada que crear.
      if (isUniqueViolation(err)) {
        this.logger.warn(`La activación ${activationId} ya tiene registro en billing; se ignora el evento`);
        return;
      }
      throw err;
    }

    await this.publisher.publish(
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
  async handleActivationFailed(event: ActivationFailedEvent): Promise<void> {
    const activationId = event.correlationId;
    this.logger.log(`ActivationFailed recibido (activación ${activationId}, paso ${event.payload.failedStep})`);

    if (event.payload.failedStep === 'billing') return;

    const existing = await this.repo.findOneBy({ activationId });
    if (existing) {
      await this.cancel(existing, event);
      return;
    }

    try {
      await this.repo.save(
        this.repo.create({
          id: `bill-${randomUUID().slice(0, 8)}`,
          activationId,
          customerId: event.customerId,
          status: 'CANCELLED',
        }),
      );
      this.logger.log(`Sin cuenta para ${activationId}: se registra la cancelación por adelantado`);
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // Mientras tanto, la cuenta se creó: ahora sí hay que cancelarla.
      const created = await this.repo.findOneBy({ activationId });
      if (created) await this.cancel(created, event);
    }
  }

  private async cancel(account: BillingAccount, cause: ActivationFailedEvent): Promise<void> {
    if (account.status === 'CANCELLED') {
      this.logger.warn(`La cuenta ${account.id} ya estaba cancelada; se ignora el evento`);
      return;
    }
    account.status = 'CANCELLED';
    await this.repo.save(account);

    // Igual que en el resto del POC: se publica después de guardar (el outbox llega en la fase 4).
    await this.publisher.publish(
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
    this.logger.log(`Cuenta ${account.id} cancelada (compensación de ${cause.correlationId})`);
  }
}

/** Error 23505 de PostgreSQL: se violó un índice único. */
function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; driverError?: { code?: string } };
  return e?.code === '23505' || e?.driverError?.code === '23505';
}
