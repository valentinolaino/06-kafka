import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Activation } from './activation.entity';
import { ActivationsController } from './activations.controller';
import { ActivationsService } from './activations.service';

@Module({
  // forFeature registra la entidad Activation y habilita inyectar su Repository.
  imports: [TypeOrmModule.forFeature([Activation])],
  controllers: [ActivationsController],
  providers: [ActivationsService],
})
export class ActivationsModule {}
