/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // GitHub Pages 部署於 https://<user>.github.io/TEXT-Message/ 子路徑
  base: '/TEXT-Message/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'worker/src/**/*.test.ts'],
  },
});
