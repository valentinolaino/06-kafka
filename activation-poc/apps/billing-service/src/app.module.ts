import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventPublisherModule } from '@activation-poc/kafka-toolkit';
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

    BillingModule,
  ],
})
export class AppModule {}
