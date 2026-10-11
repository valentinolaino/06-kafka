import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventConsumerModule, EventPublisherModule } from '@activation-poc/kafka-toolkit';
import { BillingModule } from './billing/billing.module';
import { config } from './config';

@Module({
  imports: [
    // Base propia de billing (billing_db la crea docker/init-databases.sql).
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: config.databaseUrl,
      autoLoadEntities: true,
      synchronize: true,
    }),

    // Cliente Kafka para publicar los resultados de billing.
    EventPublisherModule.register({ clientId: config.kafkaClientId }),

    // Idempotencia (processed_events), reintentos y DLQ para todo lo que billing consume.
    EventConsumerModule.register({ groupId: config.kafkaGroupId }),

    BillingModule,
  ],
})
export class AppModule {}
