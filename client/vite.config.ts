import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Objetivo del proxy hacia la API local (SPEC.md §3: el cliente consume la API
// mediante el proxy de Vite). Se puede cambiar con la variable de entorno
// API_PROXY_TARGET sin tocar el código.
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/equipment': { target: apiTarget, changeOrigin: true },
      '/reservations': { target: apiTarget, changeOrigin: true },
    },
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    proxy: {
      '/equipment': { target: apiTarget, changeOrigin: true },
      '/reservations': { target: apiTarget, changeOrigin: true },
    },
  },
});
