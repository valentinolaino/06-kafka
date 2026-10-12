import { CONSUMER_GROUPS } from '@activation-poc/contracts';

/**
 * Configuración del servicio. Cada valor se puede pisar con una variable de entorno;
 * los valores por defecto coinciden con el docker-compose.yml.
 * (Los brokers de Kafka los lee kafka-toolkit desde KAFKA_BROKERS.)
 */
export const config = {
  databaseUrl:
    process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:15432/loyalty_db',
  kafkaClientId: process.env.KAFKA_CLIENT_ID ?? 'loyalty-service',
  kafkaGroupId: process.env.KAFKA_GROUP_ID ?? CONSUMER_GROUPS.LOYALTY,
};
