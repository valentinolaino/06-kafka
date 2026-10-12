import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** Tabla "loyalty_accounts": una fila por cliente con sus puntos acumulados. */
@Entity('loyalty_accounts')
export class LoyaltyAccount {
  @PrimaryColumn({ type: 'varchar', length: 60 })
  customerId: string;

  @Column({ type: 'int', default: 0 })
  points: number;

  /** Cuántas activaciones completadas dieron esos puntos. */
  @Column({ type: 'int', default: 0 })
  completedActivations: number;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
