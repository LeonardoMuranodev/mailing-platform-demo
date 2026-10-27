import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const rootDir = path.resolve(__dirname, '..');
  const env = loadEnv(mode, rootDir, '');
  const backendPort = env.PORT || '3000';
  const backendUrl = env.BACKEND_URL || `http://localhost:${backendPort}`;
  const maxAdjuntos = env.MAX_ADJUNTOS || env.VITE_MAX_ADJUNTOS || '6';
  
  return {
    envDir: rootDir,
    define: {
      'import.meta.env.VITE_MAX_ADJUNTOS': JSON.stringify(maxAdjuntos),
    },
    plugins: [
      react(),
      tailwindcss(),
    ],
    server: {
      host: true,
      port: 5173,
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
        },
        '/uploads': {
          target: backendUrl,
          changeOrigin: true,
        },
      },
    },
  };
});
