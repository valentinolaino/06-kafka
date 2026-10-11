import { Injectable, Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { config } from '../config';
import { Activation } from './activation.entity';
import { toActivationView } from './activation-view';

/** Nombre del evento WebSocket que recibe la UI cada vez que una activación cambia. */
export const ACTIVATION_UPDATED = 'activation.updated';

/**
 * RF-08: empuja a la UI cada cambio de una activación.
 *
 * Socket.IO comparte el puerto HTTP de la API (3000). Cada vez que una activación cambia
 * (se crea, llega un resultado, se completa o falla, se compensa) se emite UN mensaje
 * "activation.updated" a todos los clientes conectados, con el estado completo
 * (status, steps e historial). La UI se queda con el último mensaje de cada activationId y
 * dibuja la timeline a partir de "history".
 *
 * Se emite a todos (no a una "sala" por activación) para que no haya carrera: si la UI se
 * suscribiera recién después del POST, podría perderse los primeros eventos.
 */
@Injectable()
@WebSocketGateway({ cors: { origin: config.corsOrigins } })
export class ActivationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ActivationsGateway.name);

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket): void {
    this.logger.log(`Cliente WebSocket conectado (${client.id})`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Cliente WebSocket desconectado (${client.id})`);
  }

  /**
   * Avisa a la UI que la activación cambió. Nunca lanza error: la notificación es un extra
   * y no debe romper el procesamiento del evento ni el POST.
   */
  notify(activation: Activation): void {
    try {
      this.server.emit(ACTIVATION_UPDATED, toActivationView(activation));
    } catch (err) {
      this.logger.warn(`No se pudo notificar por WebSocket: ${(err as Error).message}`);
    }
  }
}
