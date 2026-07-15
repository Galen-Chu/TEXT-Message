import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // GitHub Pages 部署於 https://<user>.github.io/TEXT-message/ 子路徑
  base: '/TEXT-message/',
  plugins: [react()],
});
