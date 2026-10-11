import { Controller } from '@nestjs/common';
import { Ctx, EventPattern, KafkaContext, Payload } from '@nestjs/microservices';
import { ActivationRequestedEvent, TOPICS } from '@activation-poc/contracts';
import { EventConsumer } from '@activation-poc/kafka-toolkit';
import { ProvisioningService } from './provisioning.service';

/**
 * En un microservicio Kafka, un @Controller agrupa handlers de eventos (no rutas HTTP).
 */
@Controller()
export class ProvisioningController {
  constructor(
    private readonly provisioning: ProvisioningService,
    private readonly consumer: EventConsumer,
  ) {}

  /**
   * provisioning escucha el MISMO topic que billing, pero con su propio consumer group:
   * por eso cada ActivationRequested llega a los dos, y trabajan en paralelo (RF-04).
   * EventConsumer.process aplica idempotencia, reintentos y DLQ.
   */
  @EventPattern(TOPICS.ACTIVATION_REQUESTED)
  onActivationRequested(@Payload() payload: unknown, @Ctx() context: KafkaContext): Promise<void> {
    return this.consumer.process<ActivationRequestedEvent>(payload, context, (event, manager) =>
      this.provisioning.handleActivationRequested(event, manager),
    );
  }
}
