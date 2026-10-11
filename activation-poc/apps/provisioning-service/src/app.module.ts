import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventConsumerModule, EventPublisherModule } from '@activation-poc/kafka-toolkit';
import { ProvisioningModule } from './provisioning/provisioning.module';
import { config } from './config';

@Module({
  imports: [
    // Base propia de provisioning (provisioning_db la crea docker/init-databases.sql).
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: config.databaseUrl,
      autoLoadEntities: true,
      synchronize: true,
    }),

    // Cliente Kafka para publicar los resultados de provisioning.
    EventPublisherModule.register({ clientId: config.kafkaClientId }),

    // Idempotencia (processed_events), reintentos y DLQ para todo lo que provisioning consume.
    EventConsumerModule.register({ groupId: config.kafkaGroupId }),

    ProvisioningModule,
  ],
})
export class AppModule {}
