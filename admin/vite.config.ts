import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3081,
    proxy: {
      '/symbols': 'http://localhost:3080',
    },
  },
  test: { exclude: ['node_modules/**', 'dist/**'], css: false },
});
