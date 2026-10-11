import { ActivationCompletedEvent, ActivationFailedEvent } from '@activation-poc/contracts';

export type NotifiableEvent = ActivationCompletedEvent | ActivationFailedEvent;

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Los eventos no traen el email del cliente (solo su código), así que se arma una casilla de demo. */
export function recipientFor(customerId: string): string {
  return `${customerId.toLowerCase()}@clientes.demo`;
}

const STEP_NAME: Record<'billing' | 'provisioning', string> = {
  billing: 'la creación de tu cuenta de facturación',
  provisioning: 'la instalación del servicio',
};

/** Evita que un texto del evento se interprete como HTML dentro del email. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Cuerpo del email con un formato mínimo; el texto plano y el HTML dicen lo mismo. */
function layout(title: string, paragraphs: string[]): { text: string; html: string } {
  const text = [title, '', ...paragraphs].join('\n');
  const html = `<!doctype html>
<html lang="es"><body style="margin:0;padding:24px;background:#e8edf1;font-family:Arial,Helvetica,sans-serif;color:#13233a">
  <div style="max-width:520px;margin:0 auto;padding:24px;background:#ffffff;border-radius:8px">
    <h1 style="margin:0 0 16px;font-size:20px">${escapeHtml(title)}</h1>
    ${paragraphs.map((p) => `<p style="margin:0 0 12px;line-height:1.5">${escapeHtml(p)}</p>`).join('\n    ')}
  </div>
</body></html>`;
  return { text, html };
}

/**
 * RF-07: arma el email que corresponde al resultado de la activación.
 * Es una función pura (no envía nada), así que se prueba sola.
 */
export function buildEmail(event: NotifiableEvent): EmailMessage {
  const activationId = event.correlationId;
  const to = recipientFor(event.customerId);

  if (event.eventType === 'ActivationCompleted') {
    const subject = `Tu servicio ya está activo (${activationId})`;
    return {
      to,
      subject,
      ...layout('¡Tu servicio ya está activo!', [
        `Hola ${event.customerId}, completamos la activación ${activationId}.`,
        'Ya podés usar tu servicio. Gracias por elegirnos.',
      ]),
    };
  }

  const step = STEP_NAME[event.payload.failedStep] ?? event.payload.failedStep;
  const subject = `No pudimos activar tu servicio (${activationId})`;
  return {
    to,
    subject,
    ...layout('No pudimos activar tu servicio', [
      `Hola ${event.customerId}, la activación ${activationId} no se completó: falló ${step}.`,
      `Motivo: ${event.payload.reason}.`,
      'No se te cobró nada. Podés volver a intentarlo.',
    ]),
  };
}
