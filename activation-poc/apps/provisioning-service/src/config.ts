import { CONSUMER_GROUPS } from '@activation-poc/contracts';

/**
 * Configuración del servicio. Cada valor se puede pisar con una variable de entorno;
 * los valores por defecto coinciden con el docker-compose.yml.
 * (Los brokers de Kafka los lee kafka-toolkit desde KAFKA_BROKERS.)
 */
export const config = {
  databaseUrl:
    process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:15432/provisioning_db',
  kafkaClientId: process.env.KAFKA_CLIENT_ID ?? 'provisioning-service',
  kafkaGroupId: process.env.KAFKA_GROUP_ID ?? CONSUMER_GROUPS.PROVISIONING,

  // Retardo simulado del aprovisionamiento: entre 1 y 3 segundos (sección 04 del PDF).
  // Se puede cambiar con variables de entorno, por ejemplo a 0 para hacer pruebas rápidas.
  minDelayMs: Number(process.env.PROVISIONING_MIN_DELAY_MS ?? 1000),
  maxDelayMs: Number(process.env.PROVISIONING_MAX_DELAY_MS ?? 3000),
};
