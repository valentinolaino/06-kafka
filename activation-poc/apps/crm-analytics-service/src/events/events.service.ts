import { Injectable, Logger } from "@nestjs/common";
import { EntityManager } from "typeorm";
import { DomainEvent } from "@activation-poc/contracts";
import { EventLog } from "./event-log.entity";

/** Dónde se leyó el mensaje en Kafka. */
export interface KafkaOrigin {
  topic: string;
  partition: number;
  offset: string;
}

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  /**
   * Guarda una copia del evento. Corre dentro de la transacción de EventConsumer.
   * Es de solo escritura: este servicio nunca publica nada ni modifica a otros servicios.
   *
   * Aunque processed_events ya filtra los repetidos, se vuelve a chequear eventId acá: los
   * registros de processed_events se purgan a los 7 días, y un replay posterior no tiene que
   * duplicar el log ni fallar por la clave única.
   */
  async record(
    event: DomainEvent,
    origin: KafkaOrigin,
    manager: EntityManager,
  ): Promise<void> {
    if (await manager.findOneBy(EventLog, { eventId: event.eventId })) return;

    await manager.insert(EventLog, {
      eventId: event.eventId,
      eventType: event.eventType,
      version: event.version,
      correlationId: event.correlationId,
      customerId: event.customerId,
      source: event.source,
      topic: origin.topic,
      partition: origin.partition,
      kafkaOffset: origin.offset,
      occurredAt: new Date(event.occurredAt),
      // "never" es solo para el compilador: TypeORM no acepta objetos libres en columnas jsonb
      // dentro de insert(). En runtime se guarda el objeto tal cual.
      payload: event.payload as never,
    });
    this.logger.log(
      `${event.eventType} registrado (activación ${event.correlationId}, ${origin.topic}[${origin.partition}]@${origin.offset})`,
    );
  }
}
