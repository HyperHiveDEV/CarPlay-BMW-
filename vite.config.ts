import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' : chemins relatifs obligatoires pour la WebView Android (Capacitor).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: { three: ['three'], r3f: ['@react-three/fiber', '@react-three/drei'] },
      },
    },
  },
  test: { environment: 'node' },
} as any);
