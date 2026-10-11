import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { ActivationRequestedEvent, TOPICS } from '@activation-poc/contracts';
import { ProvisioningService } from './provisioning.service';

/**
 * En un microservicio Kafka, un @Controller agrupa handlers de eventos (no rutas HTTP).
 */
@Controller()
export class ProvisioningController {
  constructor(private readonly provisioning: ProvisioningService) {}

  /**
   * provisioning escucha el MISMO topic que billing, pero con su propio consumer group:
   * por eso cada ActivationRequested llega a los dos, y trabajan en paralelo (RF-04).
   */
  @EventPattern(TOPICS.ACTIVATION_REQUESTED)
  async onActivationRequested(@Payload() event: ActivationRequestedEvent): Promise<void> {
    await this.provisioning.handleActivationRequested(event);
  }
}
