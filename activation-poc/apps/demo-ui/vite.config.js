import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// El puerto 5173 es el que activation-api tiene permitido por CORS (config.corsOrigins).
// strictPort: si está ocupado, falla en vez de elegir otro puerto (con otro puerto, CORS bloquearía la UI).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
});
