import { Controller } from '@nestjs/common';
import { Ctx, EventPattern, KafkaContext, Payload } from '@nestjs/microservices';
import { DomainEvent, TOPICS } from '@activation-poc/contracts';
import { EventConsumer } from '@activation-poc/kafka-toolkit';
import { EventsService } from './events.service';

/**
 * Escucha los 4 topics de negocio. Para sumar este consumidor no hubo que tocar a ningún otro
 * servicio: solo tiene su propio consumer group ("crm-analytics") y lee lo que ya existe.
 */
@Controller()
export class EventsController {
  constructor(
    private readonly events: EventsService,
    private readonly consumer: EventConsumer,
  ) {}

  @EventPattern(TOPICS.ACTIVATION_REQUESTED)
  onActivationRequested(@Payload() payload: unknown, @Ctx() context: KafkaContext): Promise<void> {
    return this.register(payload, context);
  }

  @EventPattern(TOPICS.BILLING_EVENTS)
  onBillingEvent(@Payload() payload: unknown, @Ctx() context: KafkaContext): Promise<void> {
    return this.register(payload, context);
  }

  @EventPattern(TOPICS.PROVISIONING_EVENTS)
  onProvisioningEvent(@Payload() payload: unknown, @Ctx() context: KafkaContext): Promise<void> {
    return this.register(payload, context);
  }

  @EventPattern(TOPICS.ACTIVATION_EVENTS)
  onActivationEvent(@Payload() payload: unknown, @Ctx() context: KafkaContext): Promise<void> {
    return this.register(payload, context);
  }

  private register(payload: unknown, context: KafkaContext): Promise<void> {
    const origin = {
      topic: context.getTopic(),
      partition: context.getPartition(),
      offset: String(context.getMessage().offset),
    };
    return this.consumer.process<DomainEvent>(payload, context, (event, manager) =>
      this.events.record(event, origin, manager),
    );
  }
}
