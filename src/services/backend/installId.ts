/**
 * installId:識別「這個瀏覽器安裝」的隨機 id,worker 以它對應保管中的 Threads token
 * (KV key `token:threads:<installId>`)。隨機生成、不含任何個人資料;
 * localStorage 不可用時退回記憶體(該次工作階段內保持一致)。
 */
const KEY = 'text-message:install-id';
const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

let cached: string | null = null;

function randomId(): string {
  const uuid = typeof crypto !== 'undefined' ? crypto.randomUUID?.() : undefined;
  const raw = uuid ? uuid.replace(/-/g, '') : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  return 'ins-' + raw.slice(0, 24);
}

export function getInstallId(): string {
  if (cached) return cached;
  let id = '';
  try {
    id = localStorage.getItem(KEY) ?? '';
    if (!ID_RE.test(id)) {
      id = randomId();
      localStorage.setItem(KEY, id);
    }
  } catch {
    id = randomId();
  }
  cached = id;
  return id;
}
