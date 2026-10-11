import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { ActivationCompletedEvent, ActivationFailedEvent, TOPICS } from '@activation-poc/contracts';
import { NotificationsService } from './notifications.service';

@Controller()
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  /**
   * activation.events trae solo ActivationCompleted y ActivationFailed: los dos resultados
   * finales de una activación. Cada uno genera un email distinto.
   */
  @EventPattern(TOPICS.ACTIVATION_EVENTS)
  async onActivationEvent(@Payload() event: ActivationCompletedEvent | ActivationFailedEvent): Promise<void> {
    if (event.eventType === 'ActivationCompleted' || event.eventType === 'ActivationFailed') {
      await this.notifications.handle(event);
    }
  }
}
