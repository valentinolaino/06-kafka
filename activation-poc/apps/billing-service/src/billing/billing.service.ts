import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivationRequestedEvent, createEnvelope, EVENT_TYPES } from '@activation-poc/contracts';
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

    const account = await this.repo.save(
      this.repo.create({
        id: `bill-${randomUUID().slice(0, 8)}`,
        activationId,
        customerId: event.customerId,
        status: 'CREATED',
      }),
    );

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
}
