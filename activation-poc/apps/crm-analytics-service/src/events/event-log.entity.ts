import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Tabla "event_log" (sección 07 del PDF): una copia de cada evento recibido.
 *  - eventId es la clave primaria, por lo tanto único: el mismo evento no se guarda dos veces.
 *  - correlationId (= activationId) tiene índice: sirve para reconstruir la historia completa
 *    de una activación con un solo SELECT.
 */
@Entity('event_log')
@Index(['correlationId'])
@Index(['customerId'])
export class EventLog {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  eventId: string;

  @Column({ type: 'varchar', length: 40 })
  eventType: string;

  @Column({ type: 'int' })
  version: number;

  @Column({ type: 'varchar', length: 40 })
  correlationId: string;

  @Column({ type: 'varchar', length: 60 })
  customerId: string;

  /** Servicio que publicó el evento (activation-api, billing o provisioning). */
  @Column({ type: 'varchar', length: 40 })
  source: string;

  /** De dónde se leyó en Kafka: topic, partición y offset. */
  @Column({ type: 'varchar', length: 80 })
  topic: string;

  @Column({ type: 'int' })
  partition: number;

  @Column({ type: 'varchar', length: 30 })
  kafkaOffset: string;

  /** Cuándo ocurrió el hecho (lo dice el evento). */
  @Column({ type: 'timestamptz' })
  occurredAt: Date;

  /** Cuándo lo registró este servicio. */
  @CreateDateColumn({ type: 'timestamptz' })
  receivedAt: Date;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;
}
