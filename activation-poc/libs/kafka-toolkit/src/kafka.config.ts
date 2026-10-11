/**
 * Token de inyección del cliente Kafka. Es un nombre propio que usamos para pedirle
 * a Nest "dame el cliente Kafka" (@Inject(KAFKA_CLIENT)).
 */
export const KAFKA_CLIENT = 'KAFKA_CLIENT';

/**
 * Lista de brokers desde la variable de entorno KAFKA_BROKERS (separados por coma).
 *  - Corriendo en tu máquina: localhost:9092 (listener EXTERNAL del docker-compose).
 *  - Corriendo dentro de Docker Compose: kafka:19092 (listener INTERNAL).
 */
export function kafkaBrokers(): string[] {
  return (process.env.KAFKA_BROKERS ?? 'localhost:9092')
    .split(',')
    .map((broker) => broker.trim())
    .filter(Boolean);
}
