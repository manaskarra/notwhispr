import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist/main',
      sourcemap: true,
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist/preload',
      sourcemap: 'inline',
      rollupOptions: {
        output: {
          format: 'cjs',
          inlineDynamicImports: true,
          entryFileNames: 'index.cjs',
        },
      },
    },
  },
  renderer: {
    root: '.',
    plugins: [react()],
    server: {
      port: 5174,
      strictPort: true,
    },
    build: {
      outDir: 'dist/renderer',
      rollupOptions: {
        input: path.resolve(rootDir, 'index.html'),
      },
    },
  },
});
