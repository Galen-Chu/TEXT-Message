/** 後端輔助(階段三前端串接)的建置期設定;與 gmail/youtube config 同一唯讀 env 哲學。 */

/**
 * 平台代發後端(Cloudflare Workers)的網址,如 https://text-message-worker.xxx.workers.dev。
 * 未設定時 = 完整半自動模式(一鍵複製 + 平台深連結),建置不得失敗。
 */
export const BACKEND_API_BASE: string = (import.meta.env.VITE_API_BASE ?? '')
  .trim()
  .replace(/\/+$/, '');

export const BACKEND_ENABLED: boolean = BACKEND_API_BASE.length > 0;
