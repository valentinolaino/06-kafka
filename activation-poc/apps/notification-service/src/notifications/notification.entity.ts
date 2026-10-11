import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

export type NotificationStatus = 'PENDING' | 'SENT';

/**
 * Tabla "notifications" (sección 07 del PDF): un registro por email, con índice único sobre
 * activationId + eventType. Ese índice es lo que evita mandar dos veces el mismo email.
 *
 *  - PENDING: se decidió mandar el email, pero todavía no se confirmó el envío.
 *  - SENT:    Mailhog (el servidor SMTP) aceptó el email.
 */
@Entity('notifications')
@Index(['activationId', 'eventType'], { unique: true })
export class Notification {
  @PrimaryColumn({ type: 'varchar', length: 40 })
  id: string;

  @Column({ type: 'varchar', length: 40 })
  activationId: string;

  /** ActivationCompleted (email de bienvenida) o ActivationFailed (email de error). */
  @Column({ type: 'varchar', length: 40 })
  eventType: string;

  @Column({ type: 'varchar', length: 120 })
  recipient: string;

  @Column({ type: 'varchar', length: 200 })
  subject: string;

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status: NotificationStatus;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
