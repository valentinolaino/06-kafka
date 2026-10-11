// Llamadas HTTP a activation-api. El WebSocket vive en useActivations.js.
export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/** Error con un mensaje que la pantalla puede mostrar tal cual. */
export class ApiError extends Error {}

async function request(path, options) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, options);
  } catch {
    // fetch solo falla así cuando no hay conexión o CORS bloquea el pedido.
    throw new ApiError(`No se pudo conectar con la API en ${API_URL}. Revisá que activation-api esté levantada.`);
  }
  if (res.status === 404) return null;
  if (!res.ok) {
    // Nest responde { message: string | string[] } cuando el body no pasa la validación.
    const body = await res.json().catch(() => ({}));
    const detail = Array.isArray(body.message) ? body.message.join('. ') : body.message;
    throw new ApiError(detail || `La API respondió con el error ${res.status}.`);
  }
  return res.json();
}

/** POST /activations → { activationId, status } */
export function createActivation({ customerId, planId, simulateFailure }) {
  return request('/activations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerId, planId, simulateFailure }),
  });
}

/** GET /activations/:id → la activación completa, o null si no existe. */
export function getActivation(id) {
  return request(`/activations/${encodeURIComponent(id)}`);
}
