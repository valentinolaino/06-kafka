import { formatDelta, metaFor, planName, STATUS_LABEL } from '../events.js';
import { Trace } from './Trace.jsx';

/** Motivo del fallo, tomado del paso que falló (por ejemplo "Fallo simulado en billing"). */
function failureReason(steps) {
  const failed = Object.values(steps ?? {}).find((s) => s?.status === 'FAILED');
  return failed?.reason ?? '';
}

export function ActivationCard({ activation }) {
  const { activationId, customerId, planId, status, steps, history } = activation;
  const reason = status === 'FAILED' ? failureReason(steps) : '';
  const start = history[0]?.at;

  return (
    <article className="panel card" data-status={status}>
      <header className="card-head">
        <div>
          <h3>
            {customerId} <span className="card-plan">{planName(planId)}</span>
          </h3>
          <p className="card-id">{activationId}</p>
        </div>
        <span className="pill" data-status={status}>
          {STATUS_LABEL[status] ?? status}
        </span>
      </header>

      {reason && <p className="card-reason">Motivo: {reason}</p>}

      <Trace history={history} />

      <ol className="events">
        {history.map((entry, i) => {
          const meta = metaFor(entry.eventType);
          return (
            <li key={`${entry.eventType}-${i}`} className="event" data-tone={meta.tone}>
              <span className="event-dot" aria-hidden="true" />
              <span className="event-body">
                <span className="event-label">{meta.label}</span>
                <span className="event-type">{entry.eventType}</span>
              </span>
              <span className="event-time">{i === 0 ? 'Inicio' : formatDelta(start, entry.at)}</span>
            </li>
          );
        })}
      </ol>
    </article>
  );
}
