import { Injectable } from '@nestjs/common';
import { createTransport, Transporter } from 'nodemailer';
import { config } from '../config';
import { EmailMessage } from './email-templates';

/**
 * Envía emails por SMTP. En el POC el servidor SMTP es Mailhog (localhost:1025): acepta todo
 * y lo muestra en su bandeja de entrada web (http://localhost:8025), sin mandar nada a internet.
 */
@Injectable()
export class MailerService {
  private readonly transporter: Transporter = createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: false,
    ignoreTLS: true, // Mailhog no usa TLS
  });

  /** Si Mailhog no responde, lanza el error: quien llama decide qué hacer. */
  async send(message: EmailMessage): Promise<void> {
    await this.transporter.sendMail({ from: config.mailFrom, ...message });
  }
}
