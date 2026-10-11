import { ActivationStatus, ActivationSteps } from './activation.entity';

export type StepName = 'billing' | 'provisioning';

/** Resultado de un servicio, ya "traducido" desde el evento que lo informó. */
export interface StepOutcome {
  step: StepName;
  status: 'OK' | 'FAILED';
  reason?: string;
}

/** Qué hay que hacer con la activación al llegar un resultado. */
export type Decision =
  /** La activación ya terminó: el resultado solo se anota en el historial. */
  | { kind: 'history-only' }
  /** Resultado repetido de un servicio que ya habíamos registrado: se ignora. */
  | { kind: 'duplicate' }
  /** Llegó el primer resultado (OK) y falta el otro servicio. */
  | { kind: 'in-progress' }
  /** Billing y provisioning confirmaron: la activación pasa a ACTIVE. */
  | { kind: 'completed' }
  /** Un servicio falló: la activación pasa a FAILED. */
  | { kind: 'failed'; failedStep: StepName; reason: string };

const FINAL_STATUSES: ActivationStatus[] = ['ACTIVE', 'FAILED'];

const OTHER_STEP: Record<StepName, StepName> = {
  billing: 'provisioning',
  provisioning: 'billing',
};

/**
 * Regla de agregación de la sección 06 del PDF. Es una función pura (no toca la base ni Kafka),
 * así que se puede probar sola con distintos órdenes de llegada.
 *
 *  - Con los dos resultados OK            -> ActivationCompleted (ACTIVE).
 *  - Con el primer fallo                  -> ActivationFailed (FAILED).
 *  - Resultados posteriores a ese estado final -> solo se registran en el historial.
 */
export function decide(
  current: { status: ActivationStatus; steps: ActivationSteps },
  outcome: StepOutcome,
): Decision {
  if (FINAL_STATUSES.includes(current.status)) {
    return { kind: 'history-only' };
  }

  // Kafka entrega "al menos una vez": si ya registramos este paso, es una repetición.
  if (current.steps[outcome.step]) {
    return { kind: 'duplicate' };
  }

  if (outcome.status === 'FAILED') {
    return {
      kind: 'failed',
      failedStep: outcome.step,
      reason: outcome.reason ?? 'Sin motivo informado',
    };
  }

  const other = current.steps[OTHER_STEP[outcome.step]];
  if (other && other.status === 'OK') {
    return { kind: 'completed' };
  }

  return { kind: 'in-progress' };
}
