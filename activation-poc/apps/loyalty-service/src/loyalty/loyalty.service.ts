import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ActivationCompletedEvent } from '@activation-poc/contracts';
import { LoyaltyAccount } from './loyalty-account.entity';

/** Puntos que gana un cliente por cada activación completada. */
export const POINTS_PER_ACTIVATION = 10;

@Injectable()
export class LoyaltyService {
  private readonly logger = new Logger(LoyaltyService.name);

  /**
   * Suma puntos al cliente. Corre dentro de la transacción de EventConsumer, que ya garantiza
   * que cada eventId se procesa una sola vez: un evento repetido no suma puntos dos veces.
   * Los mensajes de un mismo cliente van siempre a la misma partición, así que se procesan en
   * orden y no hay dos actualizaciones simultáneas de la misma fila.
   */
  async handle(event: ActivationCompletedEvent, manager: EntityManager): Promise<void> {
    const account = await manager.findOneBy(LoyaltyAccount, { customerId: event.customerId });
    if (!account) {
      await manager.insert(LoyaltyAccount, {
        customerId: event.customerId,
        points: POINTS_PER_ACTIVATION,
        completedActivations: 1,
      });
      this.logger.log(`Cliente ${event.customerId}: cuenta nueva con ${POINTS_PER_ACTIVATION} puntos`);
      return;
    }
    account.points += POINTS_PER_ACTIVATION;
    account.completedActivations += 1;
    await manager.save(account);
    this.logger.log(`Cliente ${event.customerId}: ${account.points} puntos (${account.completedActivations} activaciones)`);
  }
}
