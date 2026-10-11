/**
 * Nombres de topics (sección 05 del PDF).
 * Convención: dominio.tipo. Los DLQ se arman agregando ".dlq".
 */
export const TOPICS = {
  ACTIVATION_REQUESTED: 'activation.requested',
  BILLING_EVENTS: 'billing.events',
  PROVISIONING_EVENTS: 'provisioning.events',
  ACTIVATION_EVENTS: 'activation.events',
} as const;

export type Topic = (typeof TOPICS)[keyof typeof TOPICS];

/** Todos los topics de negocio (útil para crm-analytics, que consume todo). */
export const ALL_TOPICS: Topic[] = Object.values(TOPICS);

/** Devuelve el nombre del DLQ de un topic: "billing.events" -> "billing.events.dlq". */
export function dlqTopic(topic: Topic): string {
  return `${topic}.dlq`;
}

/** Consumer groups (sección 05 del PDF). Uno por servicio. */
export const CONSUMER_GROUPS = {
  BILLING: 'billing-svc',
  PROVISIONING: 'provisioning-svc',
  ACTIVATION_API: 'activation-api',
  NOTIFICATION: 'notification-svc',
  CRM_ANALYTICS: 'crm-analytics',
} as const;
