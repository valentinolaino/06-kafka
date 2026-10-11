import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Tabla "processed_events" (sección 07 del PDF): los eventId que este servicio ya procesó.
 * La clave primaria única es lo que impide procesar dos veces el mismo evento.
 * Cada servicio tiene su propia copia en su propia base.
 */
@Entity('processed_events')
export class ProcessedEvent {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  eventId!: string;

  @Column({ type: 'varchar', length: 60 })
  eventType!: string;

  /** Sirve para borrar los registros viejos (TTL de 7 días, igual a la retención de los topics). */
  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  processedAt!: Date;
}
