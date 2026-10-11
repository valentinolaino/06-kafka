import { randomUUID } from 'node:crypto';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createEnvelope, EVENT_TYPES } from '@activation-poc/contracts';
import { EventPublisher } from '@activation-poc/kafka-toolkit';
import { Activation } from './activation.entity';
import { CreateActivationDto } from './dto/create-activation.dto';

@Injectable()
export class ActivationsService {
  private readonly logger = new Logger(ActivationsService.name);

  constructor(
    // Repository<Activation> es el objeto de TypeORM para leer/escribir en la tabla activations.
    @InjectRepository(Activation) private readonly repo: Repository<Activation>,
    private readonly publisher: EventPublisher,
  ) {}

  /**
   * RF-02 y RF-03: guarda la activación como PENDING y publica ActivationRequested.
   * No espera a que billing ni provisioning hagan nada: por eso el controlador responde 202.
   */
  async create(dto: CreateActivationDto): Promise<{ activationId: string; status: string }> {
    const activationId = `act-${randomUUID().slice(0, 8)}`;
    const simulateFailure = dto.simulateFailure ?? 'none';

    // 1) Armamos el evento primero: así su fecha (occurredAt) queda también en el historial.
    const event = createEnvelope({
      eventType: EVENT_TYPES.ACTIVATION_REQUESTED,
      correlationId: activationId,
      customerId: dto.customerId,
      source: 'activation-api',
      payload: { planId: dto.planId, channel: 'web', simulateFailure },
    });

    // 2) Guardamos ANTES de publicar: cuando billing y provisioning respondan, la activación
    //    tiene que existir en la base para que el agregador pueda actualizarla.
    await this.repo.save(
      this.repo.create({
        id: activationId,
        customerId: dto.customerId,
        planId: dto.planId,
        status: 'PENDING',
        simulateFailure,
        steps: {},
        history: [{ eventType: event.eventType, at: event.occurredAt }],
      }),
    );

    // 3) Publicamos directo en Kafka (sección 08 del PDF, fases 1 a 3).
    //    RIESGO CONOCIDO: si el servicio se cae entre el paso 2 y este, la activación queda
    //    en PENDING y el evento nunca sale. Lo resuelve el outbox transaccional (fase 4).
    await this.publisher.publish(event);

    this.logger.log(`Activación ${activationId} creada para el cliente ${dto.customerId}`);
    return { activationId, status: 'PENDING' };
  }

  /** RF-09: estado actual de la activación e historial de eventos. */
  async findOne(id: string) {
    const activation = await this.repo.findOneBy({ id });
    if (!activation) {
      throw new NotFoundException(`No existe la activación ${id}`);
    }
    const { id: activationId, ...rest } = activation;
    return { activationId, ...rest };
  }
}
