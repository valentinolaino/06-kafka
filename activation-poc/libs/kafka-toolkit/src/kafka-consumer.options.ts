import { KafkaOptions, Transport } from '@nestjs/microservices';
import { kafkaBrokers } from './kafka.config';

export interface KafkaConsumerOptions {
  /** Nombre con el que el servicio se identifica ante Kafka. */
  clientId: string;
  /** Consumer group: los servicios con el mismo groupId se reparten las particiones. */
  groupId: string;
  /** Si no se indica, se leen de la variable de entorno KAFKA_BROKERS. */
  brokers?: string[];
}

/**
 * Opciones para que un servicio NestJS escuche topics de Kafka.
 * Cada servicio consumidor las pasa a NestFactory.createMicroservice(...).
 *
 * Centralizarlas acá evita repetirlas en cada servicio y deja el detalle de kafkajs
 * en un solo lugar (riesgo de mantenimiento de la sección 11 del PDF).
 */
export function kafkaConsumerOptions(options: KafkaConsumerOptions): KafkaOptions {
  return {
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: options.clientId,
        brokers: options.brokers ?? kafkaBrokers(),
      },
      consumer: {
        groupId: options.groupId,
        // Los topics los crea create-topics.sh; no queremos que el consumidor los cree solo.
        allowAutoTopicCreation: false,
      },
      subscribe: {
        // Si el grupo es nuevo, empieza desde el primer mensaje del topic y no desde "ahora".
        // Así un servicio que arranca tarde no pierde eventos (RNF-05).
        fromBeginning: true,
      },
    },
  };
}
