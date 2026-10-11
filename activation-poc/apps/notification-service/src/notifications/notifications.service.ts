import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { buildEmail, NotifiableEvent } from './email-templates';
import { MailerService } from './mailer.service';
import { Notification } from './notification.entity';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification) private readonly repo: Repository<Notification>,
    private readonly mailer: MailerService,
  ) {}

  /**
   * RF-07: manda un email por cada ActivationCompleted o ActivationFailed.
   *
   * Kafka entrega "al menos una vez", así que el mismo evento puede llegar dos veces. Para no
   * mandar dos emails se usa la tabla notifications (índice único activationId + eventType):
   *  1) Se registra la notificación como PENDING antes de enviar.
   *  2) Se envía el email.
   *  3) Se marca como SENT.
   * Si el evento se repite: SENT -> se ignora; PENDING (el envío anterior no terminó) -> se reintenta.
   * La idempotencia general por eventId (tabla processed_events) llega en la fase 3.
   */
  async handle(event: NotifiableEvent): Promise<void> {
    const activationId = event.correlationId;
    this.logger.log(`${event.eventType} recibido (activación ${activationId})`);

    const email = buildEmail(event);
    const key = { activationId, eventType: event.eventType };

    let record = await this.repo.findOneBy(key);
    if (!record) {
      try {
        record = await this.repo.save(
          this.repo.create({
            id: `notif-${randomUUID().slice(0, 8)}`,
            ...key,
            recipient: email.to,
            subject: email.subject,
            status: 'PENDING',
            sentAt: null,
          }),
        );
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
        // Otro mensaje igual la registró justo antes: seguimos con esa fila.
        record = await this.repo.findOneBy(key);
      }
    }

    if (!record || record.status === 'SENT') {
      this.logger.warn(`El email de ${event.eventType} para ${activationId} ya se envió; se ignora el evento`);
      return;
    }

    // Si esto falla (por ejemplo, Mailhog está apagado) el error sube y la fila queda PENDING.
    await this.mailer.send(email);

    record.status = 'SENT';
    record.sentAt = new Date();
    await this.repo.save(record);
    this.logger.log(`Email enviado a ${record.recipient}: "${record.subject}"`);
  }
}

/** Error 23505 de PostgreSQL: se violó un índice único. */
function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; driverError?: { code?: string } };
  return e?.code === '23505' || e?.driverError?.code === '23505';
}
