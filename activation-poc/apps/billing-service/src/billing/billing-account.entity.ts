import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export type BillingAccountStatus = 'CREATED' | 'CANCELLED';

/**
 * Tabla "billing_accounts" (sección 07 del PDF): una cuenta simulada por activación.
 * El índice único sobre activationId garantiza que no existan dos cuentas para la misma activación.
 */
@Entity('billing_accounts')
export class BillingAccount {
  @PrimaryColumn({ type: 'varchar', length: 40 })
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 40 })
  activationId: string;

  @Column({ type: 'varchar', length: 60 })
  customerId: string;

  @Column({ type: 'varchar', length: 20, default: 'CREATED' })
  status: BillingAccountStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
