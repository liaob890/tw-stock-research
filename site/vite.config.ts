import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import {fileURLToPath, URL} from 'node:url';
export default defineConfig({
  base: process.env.PAGES_BASE_PATH || '/tw-stock-research/',
  plugins: [react()],
  resolve: {alias: {'@': fileURLToPath(new URL('.',import.meta.url))}},
  css: {postcss: {plugins: [tailwindcss()]}},
});
