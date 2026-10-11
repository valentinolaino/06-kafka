import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { ActivationRequestedEvent, TOPICS } from '@activation-poc/contracts';
import { BillingService } from './billing.service';

/**
 * En un microservicio Kafka, un @Controller no atiende rutas HTTP: agrupa handlers de eventos.
 */
@Controller()
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  /**
   * @EventPattern(<topic>) le dice a Nest: "suscribite a este topic y llamame con cada mensaje".
   * @Payload() entrega el valor del mensaje ya convertido de JSON a objeto.
   */
  @EventPattern(TOPICS.ACTIVATION_REQUESTED)
  async onActivationRequested(@Payload() event: ActivationRequestedEvent): Promise<void> {
    await this.billing.handleActivationRequested(event);
  }
}
