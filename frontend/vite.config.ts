/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/three/')) return 'three-core';
          if (id.includes('/node_modules/three-stdlib/')) return 'three-stdlib';
          if (id.includes('/node_modules/@react-three/fiber/')) return 'react-three-fiber';
          if (id.includes('/node_modules/@react-three/drei/')) return 'react-three-drei';
          if (id.includes('/node_modules/@pixiv/three-vrm/')) return 'three-vrm';
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
});

