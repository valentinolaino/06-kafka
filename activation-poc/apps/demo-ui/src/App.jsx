import { ActivationCard } from './components/ActivationCard.jsx';
import { ActivationForm } from './components/ActivationForm.jsx';
import { API_URL } from './api.js';
import { useActivations } from './useActivations.js';

export default function App() {
  const { activations, connected, track, clear } = useActivations();

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>Activación de servicios</h1>
          <p className="topbar-sub">Cada contratación recorre billing y provisioning a través de Kafka.</p>
        </div>
        <p className="live" data-on={connected} role="status">
          <span className="live-dot" aria-hidden="true" />
          {connected ? 'En vivo' : 'Sin conexión con la API'}
        </p>
      </header>

      <main className="layout">
        <ActivationForm onCreated={track} />

        <section className="feed" aria-label="Activaciones">
          {activations.length > 0 && (
            <div className="feed-head">
              <h2>Activaciones</h2>
              <button type="button" className="link-btn" onClick={clear}>
                Limpiar pantalla
              </button>
            </div>
          )}

          {activations.length === 0 ? (
            <div className="empty">
              <h2>Todavía no hay activaciones</h2>
              <p>
                Contratá un plan desde el formulario y seguí cada evento acá, a medida que billing y provisioning
                responden.
              </p>
              {!connected && (
                <p className="empty-warn">
                  No hay conexión con {API_URL}. Levantá activation-api para ver los eventos en vivo.
                </p>
              )}
            </div>
          ) : (
            <ul className="cards">
              {activations.map((a) => (
                <li key={a.activationId}>
                  <ActivationCard activation={a} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
