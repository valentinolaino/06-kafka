import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export type ProvisioningOrderStatus = 'COMPLETED';

/**
 * Tabla "provisioning_orders" (sección 07 del PDF): una orden simulada por activación.
 * El índice único sobre activationId garantiza que no existan dos órdenes para la misma activación.
 */
@Entity('provisioning_orders')
export class ProvisioningOrder {
  @PrimaryColumn({ type: 'varchar', length: 40 })
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 40 })
  activationId: string;

  @Column({ type: 'varchar', length: 60 })
  customerId: string;

  @Column({ type: 'varchar', length: 20, default: 'COMPLETED' })
  status: ProvisioningOrderStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
