import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivationRequestedEvent, createEnvelope, EVENT_TYPES } from '@activation-poc/contracts';
import { EventPublisher } from '@activation-poc/kafka-toolkit';
import { config } from '../config';
import { ProvisioningOrder } from './provisioning-order.entity';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

@Injectable()
export class ProvisioningService {
  private readonly logger = new Logger(ProvisioningService.name);

  constructor(
    @InjectRepository(ProvisioningOrder) private readonly repo: Repository<ProvisioningOrder>,
    private readonly publisher: EventPublisher,
  ) {}

  /**
   * RF-04: procesa ActivationRequested y publica el resultado de provisioning.
   * Simula que aprovisionar la línea tarda entre 1 y 3 segundos.
   *  - Si la activación pidió fallar en provisioning -> publica ProvisioningFailed (no crea orden).
   *  - Si no                                          -> crea la orden y publica ProvisioningCompleted.
   */
  async handleActivationRequested(event: ActivationRequestedEvent): Promise<void> {
    // El correlationId del evento es el activationId.
    const activationId = event.correlationId;
    this.logger.log(`ActivationRequested recibido (activación ${activationId}, cliente ${event.customerId})`);

    // Protección básica: si ya hay una orden para esta activación, no creamos otra.
    // La idempotencia completa (tabla processed_events) llega en la fase 3.
    const existing = await this.repo.findOneBy({ activationId });
    if (existing) {
      this.logger.warn(`Ya existe la orden ${existing.id} para ${activationId}; se ignora el evento`);
      return;
    }

    // Retardo simulado del aprovisionamiento (el resultado, bueno o malo, llega después).
    await sleep(this.randomDelayMs());

    // Un fallo simulado es un resultado de negocio, no un error técnico:
    // se publica como evento y NO va a la DLQ (sección 08 del PDF).
    if (event.payload.simulateFailure === 'provisioning') {
      await this.publisher.publish(
        createEnvelope({
          eventType: EVENT_TYPES.PROVISIONING_FAILED,
          correlationId: activationId,
          customerId: event.customerId,
          source: 'provisioning',
          payload: { reason: 'Fallo simulado en provisioning' },
        }),
      );
      return;
    }

    const order = await this.repo.save(
      this.repo.create({
        id: `prov-${randomUUID().slice(0, 8)}`,
        activationId,
        customerId: event.customerId,
        status: 'COMPLETED',
      }),
    );

    await this.publisher.publish(
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
