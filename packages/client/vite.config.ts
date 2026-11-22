import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:9096',
    },
  },
  build: {
    // Monaco is large by design. It is served from localhost, so the warning is not useful.
    chunkSizeWarningLimit: 6000,
  },
});
