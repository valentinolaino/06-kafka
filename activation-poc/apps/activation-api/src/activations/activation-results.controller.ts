import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { TOPICS } from '@activation-poc/contracts';
import { ActivationAggregatorService, ResultEvent } from './activation-aggregator.service';

/**
 * Handlers de eventos de Kafka (no rutas HTTP). activation-api escucha los resultados de
 * billing y de provisioning con un único consumer group ("activation-api").
 */
@Controller()
export class ActivationResultsController {
  constructor(private readonly aggregator: ActivationAggregatorService) {}

  @EventPattern(TOPICS.BILLING_EVENTS)
  async onBillingEvent(@Payload() event: ResultEvent): Promise<void> {
    await this.aggregator.handleResultEvent(event);
  }

  @EventPattern(TOPICS.PROVISIONING_EVENTS)
  async onProvisioningEvent(@Payload() event: ResultEvent): Promise<void> {
    await this.aggregator.handleResultEvent(event);
  }
}
