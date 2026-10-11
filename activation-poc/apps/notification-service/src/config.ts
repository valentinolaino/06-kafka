import { CONSUMER_GROUPS } from '@activation-poc/contracts';

/**
 * Configuración del servicio. Cada valor se puede pisar con una variable de entorno;
 * los valores por defecto coinciden con el docker-compose.yml.
 * (Los brokers de Kafka los lee kafka-toolkit desde KAFKA_BROKERS.)
 */
export const config = {
  databaseUrl:
    process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:15432/notification_db',
  kafkaClientId: process.env.KAFKA_CLIENT_ID ?? 'notification-service',
  kafkaGroupId: process.env.KAFKA_GROUP_ID ?? CONSUMER_GROUPS.NOTIFICATION,

  // Mailhog recibe los emails por SMTP en el puerto 1025 y los muestra en http://localhost:8025.
  smtpHost: process.env.SMTP_HOST ?? 'localhost',
  smtpPort: Number(process.env.SMTP_PORT ?? 1025),
  mailFrom: process.env.MAIL_FROM ?? 'Activaciones <no-responder@activaciones.demo>',
};
