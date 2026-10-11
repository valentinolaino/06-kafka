// Cómo se dibuja cada tipo de evento: en qué carril, de qué color y cómo se llama en pantalla.
// Los nombres técnicos (ActivationRequested, ...) son los mismos que se ven en Kafka UI.

export const LANES = [
  { id: 'api', label: 'activation-api' },
  { id: 'billing', label: 'billing' },
  { id: 'provisioning', label: 'provisioning' },
];

// tone: ok (salió bien) | fail (falló) | comp (compensación) | neutral (inicio)
export const EVENT_META = {
  ActivationRequested: { lane: 'api', tone: 'neutral', label: 'Activación solicitada' },
  BillingAccountCreated: { lane: 'billing', tone: 'ok', label: 'Cuenta de facturación creada' },
  BillingFailed: { lane: 'billing', tone: 'fail', label: 'Falló la facturación' },
  BillingAccountCancelled: { lane: 'billing', tone: 'comp', label: 'Cuenta de facturación cancelada' },
  ProvisioningCompleted: { lane: 'provisioning', tone: 'ok', label: 'Servicio aprovisionado' },
  ProvisioningFailed: { lane: 'provisioning', tone: 'fail', label: 'Falló el aprovisionamiento' },
  ActivationCompleted: { lane: 'api', tone: 'ok', label: 'Activación completada' },
  ActivationFailed: { lane: 'api', tone: 'fail', label: 'Activación fallida' },
};

const UNKNOWN = { lane: 'api', tone: 'neutral' };

export function metaFor(eventType) {
  return EVENT_META[eventType] ?? { ...UNKNOWN, label: eventType };
}

export const STATUS_LABEL = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En curso',
  ACTIVE: 'Activa',
  FAILED: 'Fallida',
};

export const PLANS = [
  { id: 'PLAN-FIBRA-100', name: 'Fibra 100 Mb' },
  { id: 'PLAN-FIBRA-300', name: 'Fibra 300 Mb' },
  { id: 'PLAN-FIBRA-600', name: 'Fibra 600 Mb' },
  { id: 'PLAN-MOVIL-20', name: 'Móvil 20 GB' },
];

export function planName(planId) {
  return PLANS.find((p) => p.id === planId)?.name ?? planId;
}

/** Tiempo transcurrido desde el primer evento: "+0 ms", "+240 ms", "+1,4 s". */
export function formatDelta(fromIso, toIso) {
  const ms = Math.max(0, new Date(toIso) - new Date(fromIso));
  if (ms < 1000) return `+${Math.round(ms)} ms`;
  return `+${(ms / 1000).toFixed(1).replace('.', ',')} s`;
}
