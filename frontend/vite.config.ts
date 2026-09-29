import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 3080 },
  test: { exclude: ['e2e/**', 'node_modules/**', 'dist/**'] },
});
