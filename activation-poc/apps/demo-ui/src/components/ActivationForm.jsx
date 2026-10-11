import { useState } from 'react';
import { createActivation } from '../api.js';
import { PLANS } from '../events.js';

const FAILURE_OPTIONS = [
  { value: 'none', label: 'Sin fallo', hint: 'Todo sale bien' },
  { value: 'billing', label: 'Falla billing', hint: 'No se crea la cuenta' },
  { value: 'provisioning', label: 'Falla provisioning', hint: 'Se cancela la cuenta' },
];

export function ActivationForm({ onCreated }) {
  const [customerId, setCustomerId] = useState('C-1234');
  const [planId, setPlanId] = useState(PLANS[1].id);
  const [simulateFailure, setSimulateFailure] = useState('none');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    const id = customerId.trim();
    if (!id) {
      setError('Ingresá el código del cliente.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const created = await createActivation({ customerId: id, planId, simulateFailure });
      await onCreated(created.activationId);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel form" onSubmit={handleSubmit} noValidate>
      <h2>Contratar plan</h2>

      <div className="field">
        <label htmlFor="customerId">Cliente</label>
        <input
          id="customerId"
          value={customerId}
          maxLength={60}
          autoComplete="off"
          onChange={(e) => setCustomerId(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="planId">Plan</label>
        <select id="planId" value={planId} onChange={(e) => setPlanId(e.target.value)}>
          {PLANS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="field failure">
        <legend>Resultado a simular</legend>
        <div className="segments">
          {FAILURE_OPTIONS.map((o) => (
            <label key={o.value} className="segment" data-value={o.value}>
              <input
                type="radio"
                name="simulateFailure"
                value={o.value}
                checked={simulateFailure === o.value}
                onChange={() => setSimulateFailure(o.value)}
              />
              <span className="segment-label">{o.label}</span>
              <span className="segment-hint">{o.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <button type="submit" className="primary" disabled={busy}>
        {busy ? 'Enviando…' : 'Contratar plan'}
      </button>
    </form>
  );
}
