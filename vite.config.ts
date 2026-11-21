/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

// Use the production (Vercel) security headers in `vite preview` too, so tests catch CSP problems.
const vercel = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')) as {
  headers: { source: string; headers: { key: string; value: string }[] }[];
};
const securityHeaders = Object.fromEntries(
  vercel.headers[0].headers.filter((h) => h.key !== 'Strict-Transport-Security').map((h) => [h.key, h.value]),
);

// BASE_PATH is set by the GitHub Pages workflow (e.g. "/root-locus-studio/").
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  preview: { headers: securityHeaders },
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
