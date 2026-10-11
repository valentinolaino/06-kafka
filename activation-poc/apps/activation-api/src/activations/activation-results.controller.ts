import { Controller } from '@nestjs/common';
import { Ctx, EventPattern, KafkaContext, Payload } from '@nestjs/microservices';
import { TOPICS } from '@activation-poc/contracts';
import { EventConsumer } from '@activation-poc/kafka-toolkit';
import { ActivationAggregatorService, ResultEvent } from './activation-aggregator.service';

/**
 * Handlers de eventos de Kafka (no rutas HTTP). activation-api escucha los resultados de
 * billing y de provisioning con un único consumer group ("activation-api").
 * Cada handler pasa por EventConsumer.process: idempotencia, reintentos y DLQ.
 */
@Controller()
export class ActivationResultsController {
  constructor(
    private readonly aggregator: ActivationAggregatorService,
    private readonly consumer: EventConsumer,
  ) {}

  @EventPattern(TOPICS.BILLING_EVENTS)
  onBillingEvent(@Payload() payload: unknown, @Ctx() context: KafkaContext): Promise<void> {
    return this.consumer.process<ResultEvent>(payload, context, (event, manager) =>
      this.aggregator.handleResultEvent(event, manager),
    );
  }

  @EventPattern(TOPICS.PROVISIONING_EVENTS)
  onProvisioningEvent(@Payload() payload: unknown, @Ctx() context: KafkaContext): Promise<void> {
    return this.consumer.process<ResultEvent>(payload, context, (event, manager) =>
      this.aggregator.handleResultEvent(event, manager),
    );
  }
}
