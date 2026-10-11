import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { buildEmail, NotifiableEvent } from './email-templates';
import { MailerService } from './mailer.service';
import { Notification } from './notification.entity';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly mailer: MailerService) {}

  /**
   * RF-07: manda un email por cada ActivationCompleted o ActivationFailed.
   *
   * Corre dentro de la transacción de EventConsumer, que ya descarta los eventId repetidos
   * (processed_events). La tabla notifications (índice único activationId + eventType) es una
   * segunda red de seguridad y deja el registro de cada email enviado (sección 07 del PDF):
   *  1) Se registra la notificación como PENDING.
   *  2) Se envía el email.
   *  3) Se marca como SENT.
   * Si el envío falla (por ejemplo, Mailhog está apagado) el error sube, la transacción se deshace
   * y EventConsumer reintenta; si sigue fallando, el evento va a la DLQ.
   * Límite conocido: si el email sale y justo después falla el commit, el reintento lo vuelve a enviar.
   */
  async handle(event: NotifiableEvent, manager: EntityManager): Promise<void> {
    const activationId = event.correlationId;
    this.logger.log(`${event.eventType} recibido (activación ${activationId})`);

    const repo = manager.getRepository(Notification);
    const key = { activationId, eventType: event.eventType };

    const existing = await repo.findOneBy(key);
    if (existing?.status === 'SENT') {
      this.logger.warn(`El email de ${event.eventType} para ${activationId} ya se envió; se ignora el evento`);
      return;
    }

    const email = buildEmail(event);
    const record =
      existing ??
      (await repo.save(
        repo.create({
          id: `notif-${randomUUID().slice(0, 8)}`,
          ...key,
          recipient: email.to,
          subject: email.subject,
          status: 'PENDING',
          sentAt: null,
        }),
      ));

    await this.mailer.send(email);

    record.status = 'SENT';
    record.sentAt = new Date();
    await repo.save(record);
    this.logger.log(`Email enviado a ${record.recipient}: "${record.subject}"`);
  }
}
