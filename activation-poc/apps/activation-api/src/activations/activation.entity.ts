import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { SimulateFailure } from '@activation-poc/contracts';

/** Estados de la activación (sección 06 del PDF). */
export type ActivationStatus = 'PENDING' | 'IN_PROGRESS' | 'ACTIVE' | 'FAILED';

/** Resultado que informó un servicio (billing o provisioning). */
export interface StepResult {
  status: 'OK' | 'FAILED';
  at: string;
  reason?: string;
}

export interface ActivationSteps {
  billing?: StepResult;
  provisioning?: StepResult;
}

/** Una línea del historial de eventos de la activación. */
export interface HistoryEntry {
  eventType: string;
  at: string;
}

/**
 * Tabla "activations" (sección 07 del PDF).
 *
 * El PDF modela la activación como un documento de Mongo con "steps" e "history"
 * anidados. En PostgreSQL conservamos esa misma forma usando columnas jsonb:
 * los datos que se consultan o filtran (id, customerId, status) son columnas normales,
 * y los datos que solo se leen completos (steps, history) van como JSON.
 */
@Entity('activations')
export class Activation {
  /** activationId. También es el correlationId de todos los eventos de la activación. */
  @PrimaryColumn({ type: 'varchar', length: 40 })
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 60 })
  customerId: string;

  @Column({ type: 'varchar', length: 60 })
  planId: string;

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status: ActivationStatus;

  @Column({ type: 'varchar', length: 20, default: 'none' })
  simulateFailure: SimulateFailure;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  steps: ActivationSteps;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  history: HistoryEntry[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
