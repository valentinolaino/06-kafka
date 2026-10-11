import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventConsumerModule, EventPublisherModule } from '@activation-poc/kafka-toolkit';
import { NotificationsModule } from './notifications/notifications.module';
import { config } from './config';

@Module({
  imports: [
    // Base propia de notification (notification_db la crea docker/init-databases.sql).
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: config.databaseUrl,
      autoLoadEntities: true,
      synchronize: true,
    }),

    // Este servicio no publica eventos de negocio, pero necesita el cliente Kafka para enviar a la
    // DLQ los mensajes que no pueda procesar.
    EventPublisherModule.register({ clientId: config.kafkaClientId }),

    // Idempotencia (processed_events), reintentos y DLQ para todo lo que notification consume.
    EventConsumerModule.register({ groupId: config.kafkaGroupId }),

    NotificationsModule,
  ],
})
export class AppModule {}
