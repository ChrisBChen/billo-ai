import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const port = Number(process.env.PORT ?? 5173);

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
    // Local dev: forward API calls to the Express server (`pnpm dev:api`).
    proxy: {
      '/api': process.env.API_URL ?? 'http://localhost:3001',
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
