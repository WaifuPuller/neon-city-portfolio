import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
  },
  build: {
    target: 'es2020',
    // Three.js alone is ~600kB; splitting keeps the initial HTML+CSS payload
    // small so the start screen paints before the engine finishes streaming.
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber', '@react-three/drei'],
          postfx: ['@react-three/postprocessing', 'postprocessing'],
          motion: ['framer-motion'],
        },
      },
    },
  },
});
