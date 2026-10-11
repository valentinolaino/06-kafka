import { randomUUID } from 'node:crypto';

/** Servicios que publican eventos (campo "source" del sobre). */
export type EventSource = 'activation-api' | 'billing' | 'provisioning';

/** Modo de fallo forzado desde la UI (solo para la demo). */
export type SimulateFailure = 'none' | 'billing' | 'provisioning';

/**
 * Sobre común a todos los eventos (sección 05 del PDF).
 * Lo único que cambia entre eventos es el tipo y el payload.
 */
export interface EventEnvelope<TType extends string = string, TPayload = unknown> {
  /** Identificador único. Base de la idempotencia. */
  eventId: string;
  /** Nombre del evento, en pasado (describe un hecho). */
  eventType: TType;
  /** Versión del contrato. Cambios incompatibles suben este número. */
  version: number;
  /** Momento en que ocurrió el hecho (ISO 8601, UTC). */
  occurredAt: string;
  /** Es el activationId: agrupa todos los eventos de una activación. */
  correlationId: string;
  /** También es la clave del mensaje en Kafka: garantiza orden por cliente. */
  customerId: string;
  /** Servicio que publicó el evento. */
  source: EventSource;
  payload: TPayload;
}

export interface CreateEnvelopeParams<TType extends string, TPayload> {
  eventType: TType;
  version?: number;
  correlationId: string;
  customerId: string;
  source: EventSource;
  payload: TPayload;
}

/** Arma un sobre completo con eventId y occurredAt generados automáticamente. */
export function createEnvelope<TType extends string, TPayload>(
  params: CreateEnvelopeParams<TType, TPayload>,
): EventEnvelope<TType, TPayload> {
  return {
    eventId: randomUUID(),
    eventType: params.eventType,
    version: params.version ?? 1,
    occurredAt: new Date().toISOString(),
    correlationId: params.correlationId,
    customerId: params.customerId,
    source: params.source,
    payload: params.payload,
  };
}
