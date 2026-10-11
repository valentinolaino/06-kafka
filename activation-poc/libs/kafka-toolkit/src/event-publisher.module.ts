import { DynamicModule, Global, Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { EventPublisher } from './event-publisher';
import { KAFKA_CLIENT, kafkaBrokers } from './kafka.config';

export interface EventPublisherOptions {
  /** Nombre con el que este servicio se identifica ante Kafka (aparece en Kafka UI). */
  clientId: string;
  /** Si no se indica, se leen de la variable de entorno KAFKA_BROKERS. */
  brokers?: string[];
}

/**
 * Módulo que cada servicio importa UNA vez en su AppModule:
 *
 *   EventPublisherModule.register({ clientId: 'activation-api' })
 *
 * Al ser @Global(), cualquier otro módulo del servicio puede inyectar EventPublisher
 * sin volver a importarlo.
 */
@Global()
@Module({})
export class EventPublisherModule {
  static register(options: EventPublisherOptions): DynamicModule {
    return {
      module: EventPublisherModule,
      imports: [
        ClientsModule.register([
          {
            name: KAFKA_CLIENT,
            transport: Transport.KAFKA,
            options: {
              client: {
                clientId: options.clientId,
                brokers: options.brokers ?? kafkaBrokers(),
              },
              // Este cliente solo publica: no necesita consumer group propio.
              producerOnlyMode: true,
              // Los topics los crea create-topics.sh; si un topic no existe, queremos
              // enterarnos del error en vez de que Kafka lo cree con valores por defecto.
              producer: { allowAutoTopicCreation: false },
            },
          },
        ]),
      ],
      providers: [EventPublisher],
      exports: [EventPublisher],
    };
  }
}
