import { Controller } from '@nestjs/common';
import { Ctx, EventPattern, KafkaContext, Payload } from '@nestjs/microservices';
import {
  ActivationCompletedEvent,
  ActivationFailedEvent,
  ActivationRequestedEvent,
  TOPICS,
} from '@activation-poc/contracts';
import { EventConsumer } from '@activation-poc/kafka-toolkit';
import { BillingService } from './billing.service';

/**
 * En un microservicio Kafka, un @Controller no atiende rutas HTTP: agrupa handlers de eventos.
 * Cada handler pasa por EventConsumer.process, que aplica idempotencia, reintentos y DLQ.
 */
@Controller()
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly consumer: EventConsumer,
  ) {}

  /**
   * @EventPattern(<topic>) le dice a Nest: "suscribite a este topic y llamame con cada mensaje".
   * @Payload() entrega el valor del mensaje ya convertido de JSON a objeto.
   * @Ctx() entrega el contexto de Kafka (topic, partición, offset y mensaje original).
   */
  @EventPattern(TOPICS.ACTIVATION_REQUESTED)
  onActivationRequested(@Payload() payload: unknown, @Ctx() context: KafkaContext): Promise<void> {
    return this.consumer.process<ActivationRequestedEvent>(payload, context, (event, manager) =>
      this.billing.handleActivationRequested(event, manager),
    );
  }

  /**
   * activation.events trae ActivationCompleted y ActivationFailed. Billing solo reacciona al
   * segundo: es el disparador de la compensación.
   */
  @EventPattern(TOPICS.ACTIVATION_EVENTS)
  onActivationEvent(@Payload() payload: unknown, @Ctx() context: KafkaContext): Promise<void> {
    return this.consumer.process<ActivationCompletedEvent | ActivationFailedEvent>(
      payload,
      context,
      async (event, manager) => {
        if (event.eventType === 'ActivationFailed') {
          return this.billing.handleActivationFailed(event, manager);
        }
      },
    );
  }
}
