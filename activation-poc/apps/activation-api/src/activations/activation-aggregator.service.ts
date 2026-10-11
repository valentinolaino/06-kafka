import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  BillingAccountCancelledEvent,
  BillingAccountCreatedEvent,
  BillingFailedEvent,
  createEnvelope,
  DomainEvent,
  EVENT_TYPES,
  ProvisioningCompletedEvent,
  ProvisioningFailedEvent,
} from '@activation-poc/contracts';
import { AfterCommit, EventPublisher } from '@activation-poc/kafka-toolkit';
import { Activation, StepResult } from './activation.entity';
import { decide, StepOutcome } from './aggregation';
import { ActivationsGateway } from './activations.gateway';

/** Eventos que billing y provisioning publican y que este servicio consume. */
export type ResultEvent =
  | BillingAccountCreatedEvent
  | BillingFailedEvent
  | BillingAccountCancelledEvent
  | ProvisioningCompletedEvent
  | ProvisioningFailedEvent;

/** Traduce el evento recibido a un resultado de paso. Devuelve null si no es un resultado. */
function toOutcome(event: ResultEvent): StepOutcome | null {
  switch (event.eventType) {
    case 'BillingAccountCreated':
      return { step: 'billing', status: 'OK' };
    case 'BillingFailed':
      return { step: 'billing', status: 'FAILED', reason: event.payload.reason };
    case 'ProvisioningCompleted':
      return { step: 'provisioning', status: 'OK' };
    case 'ProvisioningFailed':
      return { step: 'provisioning', status: 'FAILED', reason: event.payload.reason };
    default:
      // BillingAccountCancelled es la compensación: no es un resultado de la activación.
      return null;
  }
}

@Injectable()
export class ActivationAggregatorService {
  private readonly logger = new Logger(ActivationAggregatorService.name);

  constructor(
    private readonly publisher: EventPublisher,
    private readonly gateway: ActivationsGateway,
  ) {}

  /**
   * RF-05 y RF-06: junta los resultados de billing y provisioning y decide el estado final.
   *
   * 1) Corre dentro de la transacción que abre EventConsumer (junto con el registro del evento en
   *    processed_events), con la fila de la activación bloqueada (SELECT ... FOR UPDATE). Así, si dos
   *    resultados llegan a la vez, se procesan de a uno.
   * 2) Devuelve lo que hay que hacer DESPUÉS del commit: avisar a la UI por WebSocket y publicar el
   *    evento de salida (ActivationCompleted / ActivationFailed). RIESGO CONOCIDO (igual que en
   *    POST /activations): si el servicio se cae entre el commit y la publicación, el evento no sale.
   *    Lo resuelve el outbox de la fase 4.
   */
  async handleResultEvent(event: ResultEvent, manager: EntityManager): Promise<AfterCommit | void> {
    const activationId = event.correlationId;
    this.logger.log(`${event.eventType} recibido (activación ${activationId})`);

    const activation = await manager.findOne(Activation, {
      where: { id: activationId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!activation) {
      this.logger.warn(`No existe la activación ${activationId}; se ignora ${event.eventType}`);
      return;
    }

    const incomingEntry = { eventType: event.eventType, at: event.occurredAt };
    const outcome = toOutcome(event);

    // Compensación (BillingAccountCancelled): solo queda registrada en el historial.
    if (!outcome) {
      activation.history = [...activation.history, incomingEntry];
      await manager.save(activation);
      return () => this.afterCommit(activation, null);
    }

    const decision = decide(activation, outcome);
    if (decision.kind === 'duplicate') {
      this.logger.warn(`${event.eventType} repetido para ${activationId}; se ignora`);
      return;
    }

    // Resultado posterior al estado final: solo historial (sección 06 del PDF).
    if (decision.kind === 'history-only') {
      activation.history = [...activation.history, incomingEntry];
      await manager.save(activation);
      this.logger.log(`${activationId} ya está ${activation.status}: ${event.eventType} solo se registra`);
      return () => this.afterCommit(activation, null);
    }

    // Guardamos el resultado del servicio en "steps".
    const stepResult: StepResult = { status: outcome.status, at: event.occurredAt };
    if (outcome.reason) stepResult.reason = outcome.reason;
    activation.steps = { ...activation.steps, [outcome.step]: stepResult };

    let out: DomainEvent | null = null;
    switch (decision.kind) {
      case 'in-progress':
        activation.status = 'IN_PROGRESS';
        break;
      case 'completed':
        activation.status = 'ACTIVE';
        out = createEnvelope({
          eventType: EVENT_TYPES.ACTIVATION_COMPLETED,
          correlationId: activation.id,
          customerId: activation.customerId,
          source: 'activation-api',
          payload: {},
        });
        break;
      case 'failed':
        activation.status = 'FAILED';
        out = createEnvelope({
          eventType: EVENT_TYPES.ACTIVATION_FAILED,
          correlationId: activation.id,
          customerId: activation.customerId,
          source: 'activation-api',
          payload: { failedStep: decision.failedStep, reason: decision.reason },
        });
        break;
    }

    activation.history = [
      ...activation.history,
      incomingEntry,
      ...(out ? [{ eventType: out.eventType, at: out.occurredAt }] : []),
    ];
    await manager.save(activation);
    this.logger.log(`Activación ${activationId} -> ${activation.status}`);
    return () => this.afterCommit(activation, out);
  }

  /** Ya confirmado el cambio en la base: se avisa a la UI y recién después se publica en Kafka. */
  private async afterCommit(activation: Activation, outgoing: DomainEvent | null): Promise<void> {
    this.gateway.notify(activation);
    if (outgoing) await this.publisher.publish(outgoing);
  }
}
