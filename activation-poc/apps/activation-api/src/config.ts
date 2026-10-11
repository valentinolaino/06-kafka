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
    process.env.DATABASE_URL ??
    "postgres://postgres:postgres@localhost:15432/activation_db",
  kafkaClientId: process.env.KAFKA_CLIENT_ID ?? "activation-api",
};
