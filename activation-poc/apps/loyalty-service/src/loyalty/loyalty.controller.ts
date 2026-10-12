import { Controller } from '@nestjs/common';
import { Ctx, EventPattern, KafkaContext, Payload } from '@nestjs/microservices';
import { ActivationCompletedEvent, ActivationFailedEvent, TOPICS } from '@activation-poc/contracts';
import { EventConsumer } from '@activation-poc/kafka-toolkit';
import { LoyaltyService } from './loyalty.service';

@Controller()
export class LoyaltyController {
  constructor(
    private readonly loyalty: LoyaltyService,
    private readonly consumer: EventConsumer,
  ) {}

  /**
   * Escucha activation.events con su PROPIO consumer group. Como es un grupo nuevo y los
   * consumidores leen "desde el principio", al arrancar procesa todo el historial del topic
   * sin que ningún otro servicio se entere (escenario 5 de la demo).
   * Solo las activaciones completadas dan puntos; las fallidas se ignoran.
   */
  @EventPattern(TOPICS.ACTIVATION_EVENTS)
  onActivationEvent(@Payload() payload: unknown, @Ctx() context: KafkaContext): Promise<void> {
    return this.consumer.process<ActivationCompletedEvent | ActivationFailedEvent>(
      payload,
      context,
      async (event, manager) => {
        if (event.eventType === 'ActivationCompleted') {
          await this.loyalty.handle(event, manager);
        }
      },
    );
  }
}
