import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventConsumerModule, EventPublisherModule } from '@activation-poc/kafka-toolkit';
import { EventsModule } from './events/events.module';
import { config } from './config';

@Module({
  imports: [
    // Base propia de crm-analytics (crm_analytics_db la crea docker/init-databases.sql).
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

    EventsModule,
  ],
})
export class AppModule {}
