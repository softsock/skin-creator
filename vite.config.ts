import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

// adds a strict content security policy to production builds, dev needs inline scripts for hot reload
const contentSecurityPolicy: Plugin = {
  name: 'skin-studio-csp',
  apply: 'build',
  transformIndexHtml: () => [
    {
      tag: 'meta',
      injectTo: 'head-prepend',
      attrs: {
        'http-equiv': 'Content-Security-Policy',
        content:
          "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; script-src 'self'",
      },
    },
  ],
};

// relative base lets one build load from a dev server, a cloud preview proxy and electron's file protocol
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), contentSecurityPolicy],
  server: { host: true, port: 5173, strictPort: true, allowedHosts: true },
  preview: { host: true, port: 4173, strictPort: true, allowedHosts: true },
  build: { chunkSizeWarningLimit: 1200 },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
