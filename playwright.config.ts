import { defineConfig } from '@playwright/test';

/**
 * E2E smoke:跑在 `npm run preview`(serve dist,含 base 路徑)。
 * CI 環境為「示範模式建置」(無 Client ID),因此 smoke 不觸碰 Google 網路;
 * 若本機 .env.local 有值,第 3 條案例會自動改驗證「已設定連線」的路徑。
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'list' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
  },
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173/TEXT-message/',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
