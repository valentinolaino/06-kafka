import { Controller } from '@nestjs/common';
import { Ctx, EventPattern, KafkaContext, Payload } from '@nestjs/microservices';
import { ActivationCompletedEvent, ActivationFailedEvent, TOPICS } from '@activation-poc/contracts';
import { EventConsumer } from '@activation-poc/kafka-toolkit';
import { NotificationsService } from './notifications.service';

@Controller()
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly consumer: EventConsumer,
  ) {}

  /**
   * activation.events trae solo ActivationCompleted y ActivationFailed: los dos resultados
   * finales de una activación. Cada uno genera un email distinto.
   * EventConsumer.process aplica idempotencia, reintentos y DLQ.
   */
  @EventPattern(TOPICS.ACTIVATION_EVENTS)
  onActivationEvent(@Payload() payload: unknown, @Ctx() context: KafkaContext): Promise<void> {
    return this.consumer.process<ActivationCompletedEvent | ActivationFailedEvent>(
      payload,
      context,
      async (event, manager) => {
        if (event.eventType === 'ActivationCompleted' || event.eventType === 'ActivationFailed') {
          await this.notifications.handle(event, manager);
        }
      },
    );
  }
}
