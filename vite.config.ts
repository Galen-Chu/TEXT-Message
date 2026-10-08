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
    // vitest 5 預設 forks pool 在本機 Windows 會 worker 啟動逾時(檔案隨機被丟、
    // 套裝測試數短少且不報失敗)——回到升級前的 threads pool(2026-10-08 實測修正)
    pool: 'threads',
  },
});
