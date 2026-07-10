import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';


export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@dsaslate/foundation-client': fileURLToPath(new URL('../packages/foundation-client/src/index.ts', import.meta.url)),
    },
  },
});
