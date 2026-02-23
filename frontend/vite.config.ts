import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    proxy: {
      // 開発環境のみ: APIリクエストをWorkerにプロキシ
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/inbound': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
});
