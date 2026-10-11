import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { API_URL, getActivation } from './api.js';

const STORAGE_KEY = 'activation-poc:ids';
const MAX_TRACKED = 20;

// localStorage puede no estar disponible (modo privado, datos bloqueados): la pantalla funciona igual.
function loadIds() {
  try {
    const ids = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
}

function saveIds(ids) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(0, MAX_TRACKED)));
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
}

/**
 * Mantiene las activaciones que muestra la pantalla.
 *  - Recibe cada cambio por WebSocket (evento "activation.updated").
 *  - Recuerda los ids en localStorage para volver a cargarlos si se recarga la página.
 *  - Al (re)conectarse pide de nuevo el estado de esas activaciones, por si se perdió algún mensaje.
 */
export function useActivations() {
  const [byId, setById] = useState({});
  const [connected, setConnected] = useState(false);
  const idsRef = useRef(loadIds());

  const upsert = useCallback((view) => {
    if (!view?.activationId) return;
    if (!idsRef.current.includes(view.activationId)) {
      idsRef.current = [view.activationId, ...idsRef.current].slice(0, MAX_TRACKED);
      saveIds(idsRef.current);
    }
    setById((prev) => {
      const current = prev[view.activationId];
      // El historial solo crece: si llega una versión más corta, es un mensaje atrasado.
      if (current && current.history.length > view.history.length) return prev;
      return { ...prev, [view.activationId]: view };
    });
  }, []);

  const refreshKnown = useCallback(async () => {
    const results = await Promise.all(idsRef.current.map((id) => getActivation(id).catch(() => null)));
    results.forEach((view) => view && upsert(view));
  }, [upsert]);

  useEffect(() => {
    const socket = io(API_URL);
    socket.on('connect', () => {
      setConnected(true);
      refreshKnown();
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('activation.updated', upsert);
    return () => {
      socket.off('activation.updated', upsert);
      socket.disconnect();
    };
  }, [refreshKnown, upsert]);

  /** Empieza a seguir una activación recién creada (sin esperar al primer mensaje del WebSocket). */
  const track = useCallback(
    async (activationId) => {
      upsert(await getActivation(activationId));
    },
    [upsert],
  );

  const clear = useCallback(() => {
    idsRef.current = [];
    saveIds([]);
    setById({});
  }, []);

  const activations = Object.values(byId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return { activations, connected, track, clear };
}
