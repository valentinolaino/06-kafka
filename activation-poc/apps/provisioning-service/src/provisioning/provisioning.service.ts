import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ActivationRequestedEvent, createEnvelope, EVENT_TYPES } from '@activation-poc/contracts';
import { AfterCommit, EventPublisher } from '@activation-poc/kafka-toolkit';
import { config } from '../config';
import { ProvisioningOrder } from './provisioning-order.entity';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

@Injectable()
export class ProvisioningService {
  private readonly logger = new Logger(ProvisioningService.name);

  constructor(private readonly publisher: EventPublisher) {}

  /**
   * RF-04: procesa ActivationRequested y publica el resultado de provisioning.
   * Simula que aprovisionar la línea tarda entre 1 y 3 segundos.
   *  - Si la activación pidió fallar en provisioning -> publica ProvisioningFailed (no crea orden).
   *  - Si no                                          -> crea la orden y publica ProvisioningCompleted.
   */
  async handleActivationRequested(
    event: ActivationRequestedEvent,
    manager: EntityManager,
  ): Promise<AfterCommit | void> {
    // El correlationId del evento es el activationId.
    const activationId = event.correlationId;
    this.logger.log(`ActivationRequested recibido (activación ${activationId}, cliente ${event.customerId})`);

    // Segunda red de seguridad: si ya hay una orden para esta activación, no creamos otra.
    // La idempotencia por eventId la resuelve EventConsumer (tabla processed_events).
    const repo = manager.getRepository(ProvisioningOrder);
    const existing = await repo.findOneBy({ activationId });
    if (existing) {
      this.logger.warn(`Ya existe la orden ${existing.id} para ${activationId}; se ignora el evento`);
      return;
    }

    // Retardo simulado del aprovisionamiento (el resultado, bueno o malo, llega después).
    await sleep(this.randomDelayMs());

    // Un fallo simulado es un resultado de negocio, no un error técnico:
    // se publica como evento y NO va a la DLQ (sección 08 del PDF).
    if (event.payload.simulateFailure === 'provisioning') {
      return () =>
        this.publisher.publish(
          createEnvelope({
            eventType: EVENT_TYPES.PROVISIONING_FAILED,
            correlationId: activationId,
            customerId: event.customerId,
            source: 'provisioning',
            payload: { reason: 'Fallo simulado en provisioning' },
          }),
        );
    }

    const order = await repo.save(
      repo.create({
        id: `prov-${randomUUID().slice(0, 8)}`,
        activationId,
        customerId: event.customerId,
        status: 'COMPLETED',
      }),
    );

    // El evento se publica después de confirmar la transacción (el outbox llega en la fase 4).
    return () =>
      this.publisher.publish(
        createEnvelope({
          eventType: EVENT_TYPES.PROVISIONING_COMPLETED,
          correlationId: activationId,
          customerId: event.customerId,
          source: 'provisioning',
          payload: { provisioningOrderId: order.id },
        }),
      );
  }

  /** Número entero al azar entre minDelayMs y maxDelayMs (ambos incluidos). */
  private randomDelayMs(): number {
    const { minDelayMs, maxDelayMs } = config;
    return minDelayMs + Math.floor(Math.random() * (maxDelayMs - minDelayMs + 1));
  }
}
