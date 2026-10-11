// Escucha el WebSocket de activation-api e imprime cada cambio de activación.
// Sirve para ver lo mismo que va a ver la UI de React, sin necesidad de armar la UI.
//   pnpm ws:listen
const { io } = require('socket.io-client');

const url = process.env.API_URL ?? 'http://localhost:3000';
const socket = io(url);

socket.on('connect', () => console.log(`Conectado a ${url} (id ${socket.id}). Esperando eventos...\n`));
socket.on('connect_error', (err) => console.log(`No se pudo conectar: ${err.message}`));
socket.on('disconnect', (reason) => console.log(`Desconectado: ${reason}`));

socket.on('activation.updated', (a) => {
  const hora = new Date().toLocaleTimeString();
  const pasos = ['billing', 'provisioning'].map((s) => `${s}=${a.steps?.[s]?.status ?? '-'}`).join(' ');
  console.log(`[${hora}] ${a.activationId}  ${a.status}  (${pasos})`);
  console.log(`          historial: ${a.history.map((h) => h.eventType).join(' -> ')}\n`);
});
