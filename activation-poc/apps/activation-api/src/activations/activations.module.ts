import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Activation } from './activation.entity';
import { ActivationAggregatorService } from './activation-aggregator.service';
import { ActivationResultsController } from './activation-results.controller';
import { ActivationsController } from './activations.controller';
import { ActivationsService } from './activations.service';

@Module({
  // forFeature registra la entidad Activation y habilita inyectar su Repository.
  imports: [TypeOrmModule.forFeature([Activation])],
  // ActivationsController atiende HTTP; ActivationResultsController atiende eventos de Kafka.
  controllers: [ActivationsController, ActivationResultsController],
  providers: [ActivationsService, ActivationAggregatorService],
})
export class ActivationsModule {}
