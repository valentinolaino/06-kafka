import { Activation } from './activation.entity';

/**
 * Forma "pública" de una activación: la devuelve GET /activations/:id y también es lo que se
 * envía por WebSocket. Es la misma para los dos, así la UI puede mezclar ambas fuentes.
 * (La columna "id" de la tabla se expone como "activationId", el nombre que usa el PDF.)
 */
export function toActivationView(activation: Activation) {
  const { id: activationId, ...rest } = activation;
  return { activationId, ...rest };
}

export type ActivationView = ReturnType<typeof toActivationView>;
