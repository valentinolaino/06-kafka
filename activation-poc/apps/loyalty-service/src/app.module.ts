import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventConsumerModule, EventPublisherModule } from '@activation-poc/kafka-toolkit';
import { LoyaltyModule } from './loyalty/loyalty.module';
import { config } from './config';

@Module({
  imports: [
    // Base propia de loyalty (loyalty_db la crea docker/init-databases.sql).
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: config.databaseUrl,
      autoLoadEntities: true,
      synchronize: true,
    }),

    // Este servicio NO publica eventos de negocio. Necesita el cliente Kafka solo para enviar a la
    // DLQ los mensajes que no pueda procesar.
    EventPublisherModule.register({ clientId: config.kafkaClientId }),

    // Idempotencia (processed_events), reintentos y DLQ.
    EventConsumerModule.register({ groupId: config.kafkaGroupId }),

    LoyaltyModule,
  ],
})
export class AppModule {}
