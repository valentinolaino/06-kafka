import { LANES, metaFor } from '../events.js';

const LANE_COUNT = LANES.length;

/**
 * Recorrido de la activación entre servicios: un carril por servicio y un punto por evento,
 * en el orden en que ocurrieron. La línea une cada evento con el siguiente.
 * Las coordenadas son porcentajes del contenedor, así se adapta a cualquier ancho.
 */
export function Trace({ history }) {
  const points = history.map((entry, i) => {
    const meta = metaFor(entry.eventType);
    const laneIndex = Math.max(0, LANES.findIndex((l) => l.id === meta.lane));
    return {
      key: `${entry.eventType}-${i}`,
      label: meta.label,
      tone: meta.tone,
      x: ((i + 0.5) / history.length) * 100,
      y: ((laneIndex + 0.5) / LANE_COUNT) * 100,
    };
  });

  return (
    <div className="trace" role="img" aria-label={`Recorrido de ${history.length} eventos entre servicios`}>
      <div className="trace-lanes" aria-hidden="true">
        {LANES.map((lane) => (
          <div key={lane.id} className="trace-lane">
            <span>{lane.label}</span>
          </div>
        ))}
      </div>

      <div className="trace-plot" aria-hidden="true">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          {points.slice(1).map((p, i) => (
            <line
              key={p.key}
              className="trace-line"
              data-tone={p.tone}
              x1={points[i].x}
              y1={points[i].y}
              x2={p.x}
              y2={p.y}
            />
          ))}
        </svg>
        {points.map((p) => (
          <span
            key={p.key}
            className="trace-dot"
            data-tone={p.tone}
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
            title={p.label}
          />
        ))}
      </div>
    </div>
  );
}
