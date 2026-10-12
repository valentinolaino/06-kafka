import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { KafkaContext } from '@nestjs/microservices';
import { DataSource, EntityManager, LessThan } from 'typeorm';
import { DomainEvent } from '@activation-poc/contracts';
import { EventPublisher } from './event-publisher';
import { ProcessedEvent } from './processed-event.entity';

export const EVENT_CONSUMER_OPTIONS = 'EVENT_CONSUMER_OPTIONS';

export interface EventConsumerOptions {
  /** Consumer group del servicio. Se anota en los headers de la DLQ para saber quién falló. */
  groupId: string;
}

/** Trabajo que se hace DESPUÉS de confirmar la transacción (publicar un evento, avisar a la UI). */
export type AfterCommit = () => Promise<void>;

/**
 * Lo que hace cada servicio con un evento. Recibe el "manager" de la transacción: todo lo que
 * guarde con él se confirma (o se deshace) junto con el registro en processed_events.
 * Puede devolver una función para ejecutar después del commit.
 */
export type EventHandler<E extends DomainEvent> = (
  event: E,
  manager: EntityManager,
) => Promise<AfterCommit | void>;

/** Error que no tiene sentido reintentar (por ejemplo, un mensaje mal formado): va directo a la DLQ. */
export class NonRetryableError extends Error {}

/** Marca interna: el evento ya se había procesado. */
class DuplicateEventError extends Error {}

/** Los registros de processed_events duran lo mismo que la retención de los topics (7 días). */
const PROCESSED_EVENTS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PURGE_EVERY_MS = 60 * 60 * 1000;

/** Esperas entre reintentos: 3 reintentos con espera creciente (sección 08 del PDF). */
const DEFAULT_RETRY_DELAYS_MS = [1000, 2000, 4000];

function retryDelaysFromEnv(): number[] {
  const raw = process.env.RETRY_DELAYS_MS;
  if (!raw) return DEFAULT_RETRY_DELAYS_MS;
  const values = raw.split(',').map((v) => Number(v.trim()));
  return values.every((v) => Number.isFinite(v) && v >= 0) ? values : DEFAULT_RETRY_DELAYS_MS;
}

/** ¿Es un mensaje con la forma del sobre común (sección 05 del PDF)? */
function validateEnvelope(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return 'el mensaje no es un objeto JSON';
  const e = payload as Record<string, unknown>;
  for (const field of ['eventId', 'eventType', 'correlationId', 'customerId']) {
    if (typeof e[field] !== 'string' || e[field] === '') return `falta el campo "${field}"`;
  }
  if (typeof e.payload !== 'object' || e.payload === null) return 'falta el campo "payload"';
  return null;
}

/** Error 23505 de PostgreSQL sobre la tabla processed_events. */
function isProcessedEventsConflict(err: unknown): boolean {
  const e = err as { code?: string; table?: string; driverError?: { code?: string; table?: string } };
  const code = e?.code ?? e?.driverError?.code;
  const table = e?.table ?? e?.driverError?.table;
  return code === '23505' && table === 'processed_events';
}

/**
 * Texto legible de un error. Algunos errores llegan con el mensaje vacío: por ejemplo, cuando la
 * base rechaza la conexión, pg lanza un AggregateError (una falla por IPv4 y otra por IPv6) y todo
 * el detalle está en "errors". Sin esto, el motivo de la DLQ quedaría en blanco.
 */
function errorMessage(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const own = err.message?.trim();
  if (own) return own;

  const inner = (err as { errors?: unknown[] }).errors;
  if (Array.isArray(inner) && inner.length > 0) {
    const details = inner.map((e) => {
      if (!(e instanceof Error)) return String(e);
      return e.message?.trim() || (e as { code?: string }).code || e.name;
    });
    return `${err.name}: ${[...new Set(details)].join('; ')}`;
  }
  const code = (err as { code?: string }).code;
  return code ? `${err.name}: ${code}` : err.name;
}

/**
 * Procesa los mensajes que llegan de Kafka con las garantías de la sección 08 del PDF.
 * Cada servicio la usa en TODOS sus handlers:
 *
 *   @EventPattern(TOPICS.BILLING_EVENTS)
 *   onBillingEvent(@Payload() payload: unknown, @Ctx() ctx: KafkaContext) {
 *     return this.consumer.process(payload, ctx, (event, manager) => this.service.handle(event, manager));
 *   }
 *
 * Lo que hace, en orden:
 *  1. Valida que el mensaje tenga la forma del sobre. Si no, lo manda a la DLQ sin reintentar.
 *  2. IDEMPOTENCIA: en una transacción, anota el eventId en processed_events y ejecuta el efecto
 *     del servicio. Si el eventId ya estaba, descarta el evento (Kafka entrega "al menos una vez").
 *  3. REINTENTOS: si falla, reintenta 3 veces esperando 1 s, 2 s y 4 s. Cada intento es una
 *     transacción nueva, así que un intento fallido no deja nada a medias.
 *  4. DLQ: si sigue fallando, publica el mensaje original en "<topic>.dlq" con el motivo en los
 *     headers y sigue con el siguiente: un mensaje roto no frena al resto de la partición.
 *  5. Después de confirmar la transacción ejecuta el "afterCommit" (publicar el evento de salida).
 *  6. COMMIT MANUAL DEL OFFSET: recién cuando termina todo lo anterior (procesado, descartado por
 *     duplicado o enviado a la DLQ) le avisa a Kafka "ya leí hasta acá". Si el servicio se cae en
 *     el medio, Kafka vuelve a entregar el mensaje y la idempotencia evita el doble efecto.
 *     Si ni siquiera se puede publicar en la DLQ, el offset NO se confirma.
 */
@Injectable()
export class EventConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventConsumer.name);
  private purgeTimer?: ReturnType<typeof setInterval>;

  /** Esperas entre reintentos. Se puede cambiar con la variable RETRY_DELAYS_MS (por ejemplo "200,400,800"). */
  retryDelaysMs: number[] = retryDelaysFromEnv();

  constructor(
    private readonly dataSource: DataSource,
    private readonly publisher: EventPublisher,
    @Inject(EVENT_CONSUMER_OPTIONS) private readonly options: EventConsumerOptions,
  ) {}

  onModuleInit(): void {
    this.purgeTimer = setInterval(() => void this.purgeOldRecords(), PURGE_EVERY_MS);
    // unref: que este temporizador no impida que el proceso termine al apagar el servicio.
    (this.purgeTimer as unknown as { unref?: () => void }).unref?.();
  }

  onModuleDestroy(): void {
    if (this.purgeTimer) clearInterval(this.purgeTimer);
  }

  async process<E extends DomainEvent = DomainEvent>(
    payload: unknown,
    context: KafkaContext,
    handler: EventHandler<E>,
  ): Promise<void> {
    // Si handle() lanza (la DLQ no respondió), no se llega al commit: Kafka reentrega el mensaje.
    await this.handle(payload, context, handler);
    await this.commitOffset(context);
  }

  private async handle<E extends DomainEvent>(
    payload: unknown,
    context: KafkaContext,
    handler: EventHandler<E>,
  ): Promise<void> {
    const invalid = validateEnvelope(payload);
    if (invalid) {
      this.logger.error(`Mensaje inválido en ${context.getTopic()}: ${invalid}`);
      await this.sendToDlq(context, `Mensaje inválido: ${invalid}`, 0);
      return;
    }
    const event = payload as E;

    // Etapa 1: transacción (idempotencia + efecto del servicio).
    let stage1: { duplicate: boolean; after?: AfterCommit };
    try {
      stage1 = await this.withRetry(() => this.runInTransaction(event, handler));
    } catch (err) {
      await this.sendToDlq(context, errorMessage(err), this.attemptsOf(err));
      return;
    }
    if (stage1.duplicate) {
      this.logger.warn(`${event.eventType} ${event.eventId} ya fue procesado; se descarta`);
      return;
    }

    // Etapa 2: trabajo posterior al commit (publicar). Si falla, se reintenta solo esto.
    if (stage1.after) {
      try {
        await this.withRetry(stage1.after);
      } catch (err) {
        await this.sendToDlq(context, `Falló la publicación posterior: ${errorMessage(err)}`, this.attemptsOf(err));
      }
    }
  }

  /**
   * Confirma en Kafka que este mensaje ya está resuelto. Kafka espera el offset del PRÓXIMO
   * mensaje a leer, por eso se suma 1. Si el commit falla no es grave: el mensaje se reentregará
   * y la idempotencia lo descartará, así que solo se avisa en el log.
   */
  private async commitOffset(context: KafkaContext): Promise<void> {
    const offset = (BigInt(context.getMessage().offset) + 1n).toString();
    try {
      await context.getConsumer().commitOffsets([
        { topic: context.getTopic(), partition: context.getPartition(), offset },
      ]);
    } catch (err) {
      this.logger.warn(`No se pudo confirmar el offset ${offset} de ${context.getTopic()}: ${errorMessage(err)}`);
    }
  }

  private async runInTransaction<E extends DomainEvent>(
    event: E,
    handler: EventHandler<E>,
  ): Promise<{ duplicate: boolean; after?: AfterCommit }> {
    let after: AfterCommit | undefined;
    try {
      await this.dataSource.transaction(async (manager) => {
        if (await manager.findOneBy(ProcessedEvent, { eventId: event.eventId })) {
          throw new DuplicateEventError();
        }
        await manager.insert(ProcessedEvent, { eventId: event.eventId, eventType: event.eventType });
        after = (await handler(event, manager)) || undefined;
      });
    } catch (err) {
      // Dos copias del mismo evento procesadas a la vez: gana una y la otra termina acá.
      if (err instanceof DuplicateEventError || isProcessedEventsConflict(err)) return { duplicate: true };
      throw err;
    }
    return { duplicate: false, after };
  }

  /** Ejecuta la tarea; si falla, reintenta con las esperas de retryDelaysMs. */
  private async withRetry<T>(task: () => Promise<T>): Promise<T> {
    let attempt = 0;
    for (;;) {
      try {
        return await task();
      } catch (err) {
        if (err instanceof NonRetryableError || attempt >= this.retryDelaysMs.length) {
          throw Object.assign(err instanceof Error ? err : new Error(String(err)), { attempts: attempt + 1 });
        }
        const wait = this.retryDelaysMs[attempt];
        attempt += 1;
        this.logger.warn(`Falló el procesamiento (${errorMessage(err)}). Reintento ${attempt}/${this.retryDelaysMs.length} en ${wait} ms`);
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
    }
  }

  private attemptsOf(err: unknown): number {
    return (err as { attempts?: number })?.attempts ?? 1;
  }

  /**
   * Publica el mensaje ORIGINAL en "<topic>.dlq" con el motivo del error en los headers.
   * Si ni siquiera se puede publicar en la DLQ, el error sube: así el mensaje no se da por
   * procesado y Kafka lo vuelve a entregar (preferimos frenar antes que perderlo).
   */
  private async sendToDlq(context: KafkaContext, reason: string, attempts: number): Promise<void> {
    const message = context.getMessage();
    const topic = context.getTopic();
    const headers: Record<string, string> = {};
    for (const [name, value] of Object.entries(message.headers ?? {})) {
      if (value !== undefined && value !== null) headers[name] = value.toString();
    }
    Object.assign(headers, {
      'x-error-message': reason.slice(0, 500),
      'x-error-attempts': String(attempts),
      'x-failed-at': new Date().toISOString(),
      'x-source-topic': topic,
      'x-source-partition': String(context.getPartition()),
      'x-source-offset': String(message.offset),
      'x-consumer-group': this.options.groupId,
    });

    await this.publisher.publishRaw(`${topic}.dlq`, {
      key: message.key ? message.key.toString() : null,
      value: message.value ? message.value.toString() : '',
      headers,
    });
    this.logger.error(`Mensaje de ${topic} (offset ${message.offset}) enviado a ${topic}.dlq: ${reason}`);
  }

  /** Borra de processed_events lo que ya superó la retención de los topics. */
  async purgeOldRecords(now: Date = new Date()): Promise<void> {
    try {
      const limit = new Date(now.getTime() - PROCESSED_EVENTS_TTL_MS);
      await this.dataSource.getRepository(ProcessedEvent).delete({ processedAt: LessThan(limit) });
    } catch (err) {
      this.logger.warn(`No se pudo limpiar processed_events: ${errorMessage(err)}`);
    }
  }
}
