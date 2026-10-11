import { EventEnvelope, SimulateFailure } from './envelope';
import { Topic, TOPICS } from './topics';

/** Nombres de eventos, en pasado (sección 05 del PDF). */
export const EVENT_TYPES = {
  ACTIVATION_REQUESTED: 'ActivationRequested',
  BILLING_ACCOUNT_CREATED: 'BillingAccountCreated',
  BILLING_FAILED: 'BillingFailed',
  BILLING_ACCOUNT_CANCELLED: 'BillingAccountCancelled',
  PROVISIONING_COMPLETED: 'ProvisioningCompleted',
  PROVISIONING_FAILED: 'ProvisioningFailed',
  ACTIVATION_COMPLETED: 'ActivationCompleted',
  ACTIVATION_FAILED: 'ActivationFailed',
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

// ---------- Payloads ----------
// El PDF solo define el payload de ActivationRequested; el resto es una propuesta
// mínima para que cada servicio tenga lo que necesita.

export interface ActivationRequestedPayload {
  planId: string;
  channel: string;
  simulateFailure: SimulateFailure;
}

export interface BillingAccountCreatedPayload {
  billingAccountId: string;
}

export interface BillingFailedPayload {
  reason: string;
}

export interface BillingAccountCancelledPayload {
  billingAccountId: string;
  reason: string;
}

export interface ProvisioningCompletedPayload {
  provisioningOrderId: string;
}

export interface ProvisioningFailedPayload {
  reason: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type ActivationCompletedPayload = Record<string, never>;

export interface ActivationFailedPayload {
  /** Qué servicio falló primero. */
  failedStep: 'billing' | 'provisioning';
  reason: string;
}

// ---------- Eventos tipados (sobre + payload) ----------

export type ActivationRequestedEvent = EventEnvelope<'ActivationRequested', ActivationRequestedPayload>;
export type BillingAccountCreatedEvent = EventEnvelope<'BillingAccountCreated', BillingAccountCreatedPayload>;
export type BillingFailedEvent = EventEnvelope<'BillingFailed', BillingFailedPayload>;
export type BillingAccountCancelledEvent = EventEnvelope<'BillingAccountCancelled', BillingAccountCancelledPayload>;
export type ProvisioningCompletedEvent = EventEnvelope<'ProvisioningCompleted', ProvisioningCompletedPayload>;
export type ProvisioningFailedEvent = EventEnvelope<'ProvisioningFailed', ProvisioningFailedPayload>;
export type ActivationCompletedEvent = EventEnvelope<'ActivationCompleted', ActivationCompletedPayload>;
export type ActivationFailedEvent = EventEnvelope<'ActivationFailed', ActivationFailedPayload>;

/** Unión de todos los eventos del dominio: sirve para hacer switch sobre eventType. */
export type DomainEvent =
  | ActivationRequestedEvent
  | BillingAccountCreatedEvent
  | BillingFailedEvent
  | BillingAccountCancelledEvent
  | ProvisioningCompletedEvent
  | ProvisioningFailedEvent
  | ActivationCompletedEvent
  | ActivationFailedEvent;

/** A qué topic se publica cada evento (tabla de la sección 05 del PDF). */
export const EVENT_TOPIC: Record<EventType, Topic> = {
  ActivationRequested: TOPICS.ACTIVATION_REQUESTED,
  BillingAccountCreated: TOPICS.BILLING_EVENTS,
  BillingFailed: TOPICS.BILLING_EVENTS,
  BillingAccountCancelled: TOPICS.BILLING_EVENTS,
  ProvisioningCompleted: TOPICS.PROVISIONING_EVENTS,
  ProvisioningFailed: TOPICS.PROVISIONING_EVENTS,
  ActivationCompleted: TOPICS.ACTIVATION_EVENTS,
  ActivationFailed: TOPICS.ACTIVATION_EVENTS,
};

/** Versión actual del contrato de cada evento (RNF-07). */
export const EVENT_VERSIONS: Record<EventType, number> = {
  ActivationRequested: 1,
  BillingAccountCreated: 1,
  BillingFailed: 1,
  BillingAccountCancelled: 1,
  ProvisioningCompleted: 1,
  ProvisioningFailed: 1,
  ActivationCompleted: 1,
  ActivationFailed: 1,
};
