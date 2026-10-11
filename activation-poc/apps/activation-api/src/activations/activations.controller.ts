import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ActivationsService } from './activations.service';
import { CreateActivationDto } from './dto/create-activation.dto';

/** Todas las rutas de este controlador empiezan con /activations. */
@Controller('activations')
export class ActivationsController {
  constructor(private readonly activations: ActivationsService) {}

  /** POST /activations -> 202 Accepted con { activationId, status: "PENDING" } (RF-02). */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  create(@Body() dto: CreateActivationDto) {
    return this.activations.create(dto);
  }

  /** GET /activations/:id -> estado actual e historial (RF-09). 404 si no existe. */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.activations.findOne(id);
  }
}
