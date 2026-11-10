import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    esbuild: {
      target: 'es2020',
      legalComments: 'none',
    },
    build: {
      target: ['es2020', 'chrome70', 'firefox65', 'safari12', 'edge79'],
      cssTarget: ['chrome61', 'firefox60', 'safari11'],
      minify: 'esbuild',
    },
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.RAILWAY_DEPLOYMENT_ID': JSON.stringify(process.env.RAILWAY_DEPLOYMENT_ID || process.env.RAILWAY_SNAPSHOT_ID || ''),
      'process.env.RAILWAY_GIT_COMMIT_SHA': JSON.stringify(process.env.RAILWAY_GIT_COMMIT_SHA || ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
