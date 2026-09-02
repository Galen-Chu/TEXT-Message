/**
 * KV 存取層:token(加密)與佇列項目的讀寫。
 * 佇列值不加密(內容僅為排程貼文文字——依資料邊界紅線,後端只收這類內容);
 * token 一律 AES-GCM 加密後落地。
 */
import type { KvLike } from '../config';
import { aesDecrypt, aesEncrypt } from './crypto';
import type { ThreadsToken } from '../threads/oauth';
import { parseQueueItem, type QueueItem } from '../queue/due';

const TOKEN_PREFIX = 'token:threads:';

function tokenKey(installId: string): string {
  return `${TOKEN_PREFIX}${installId}`;
}

export async function saveThreadsToken(
  kv: KvLike,
  installId: string,
  token: ThreadsToken,
  encryptionKey: string,
): Promise<void> {
  const payload = await aesEncrypt(JSON.stringify(token), encryptionKey);
  // token 60 天效期;保存期 90 天後自動由 KV 清除(過期即須重新授權)
  await kv.put(tokenKey(installId), payload, { expirationTtl: 90 * 24 * 60 * 60 });
}

export async function loadThreadsToken(
  kv: KvLike,
  installId: string,
  encryptionKey: string,
): Promise<ThreadsToken | null> {
  const payload = await kv.get(tokenKey(installId));
  if (!payload) return null;
  try {
    const parsed = JSON.parse(await aesDecrypt(payload, encryptionKey)) as Partial<ThreadsToken>;
    if (typeof parsed.accessToken !== 'string' || typeof parsed.userId !== 'string') return null;
    return { accessToken: parsed.accessToken, userId: parsed.userId, expiresAt: parsed.expiresAt ?? 0 };
  } catch {
    return null;
  }
}

export async function saveQueueItem(kv: KvLike, item: QueueItem): Promise<void> {
  await kv.put(`queue:${item.installId}:${item.id}`, JSON.stringify(item));
}

export async function loadQueueItem(
  kv: KvLike,
  installId: string,
  itemId: string,
): Promise<QueueItem | null> {
  return parseQueueItem(await kv.get(`queue:${installId}:${itemId}`));
}

/** 列出指定 installId 的所有佇列項目(處理 KV list 分頁)。 */
export async function listQueueItems(kv: KvLike, prefix: string): Promise<QueueItem[]> {
  const items: QueueItem[] = [];
  let cursor: string | undefined;
  do {
    const page = await kv.list({ prefix, cursor });
    for (const { name } of page.keys) {
      const item = parseQueueItem(await kv.get(name));
      if (item) items.push(item);
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return items;
}
