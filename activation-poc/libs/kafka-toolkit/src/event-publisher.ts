import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { DomainEvent, EVENT_TOPIC } from '@activation-poc/contracts';
import { KAFKA_CLIENT } from './kafka.config';

/**
 * Publica eventos de dominio en Kafka.
 *
 * Es la única clase que "sabe" cómo se habla con Kafka. Si algún día se reemplaza
 * kafkajs (riesgo de la sección 11 del PDF), el cambio queda acá y no en cada servicio.
 */
@Injectable()
export class EventPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventPublisher.name);

  constructor(@Inject(KAFKA_CLIENT) private readonly client: ClientKafka) {}

  /** Nest llama a este método al arrancar la app: abrimos la conexión con Kafka. */
  async onModuleInit(): Promise<void> {
    await this.client.connect();
  }

  /** Y este al apagarla: cerramos la conexión de forma limpia. */
  async onModuleDestroy(): Promise<void> {
    await this.client.close();
  }

  /**
   * Publica un evento en el topic que le corresponde (tabla EVENT_TOPIC del contrato).
   * La clave del mensaje es el customerId: Kafka manda todos los mensajes con la misma
   * clave a la misma partición, y eso garantiza el orden por cliente (RNF-02).
   */
  async publish(event: DomainEvent): Promise<void> {
    const topic = EVENT_TOPIC[event.eventType];

    // emit() devuelve un Observable; lastValueFrom lo convierte en una Promise para poder
    // hacer await y enterarnos si el envío falló.
    await lastValueFrom(this.client.emit(topic, { key: event.customerId, value: event }), {
      defaultValue: undefined,
    });

    this.logger.log(
      `${event.eventType} publicado en ${topic} (eventId=${event.eventId}, correlationId=${event.correlationId})`,
    );
  }
}
