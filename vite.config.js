import { defineConfig } from 'vite';

// Sitio estático de una sola página; Three.js se empaqueta desde npm (sin depender de una CDN).
export default defineConfig({
  build: { chunkSizeWarningLimit: 1500 },
});
