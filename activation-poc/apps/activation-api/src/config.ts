import { CONSUMER_GROUPS } from '@activation-poc/contracts';

/**
 * Configuración del servicio. Cada valor se puede pisar con una variable de entorno;
 * si no existe, se usa el valor por defecto, que coincide con el docker-compose.yml
 * (así funciona en tu máquina sin configurar nada).
 *
 * Los brokers de Kafka (KAFKA_BROKERS) los lee kafka-toolkit.
 * DATABASE_URL reemplaza a MONGO_URI del PDF, porque usamos PostgreSQL.
 */
export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl:
    process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:15432/activation_db',
  // Orígenes del navegador que pueden llamar a la API y al WebSocket (CORS).
  // 5173 es el puerto por defecto de Vite, donde va a correr demo-ui. Se pueden poner varios separados por coma.
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  kafkaClientId: process.env.KAFKA_CLIENT_ID ?? 'activation-api',
  // Consumer group con el que activation-api escucha billing.events y provisioning.events.
  kafkaGroupId: process.env.KAFKA_GROUP_ID ?? CONSUMER_GROUPS.ACTIVATION_API,
};
