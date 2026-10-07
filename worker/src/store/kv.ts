/**
 * KV 存取層:token(加密)與佇列項目的讀寫。
 * 佇列值不加密(內容僅為排程貼文文字——依資料邊界紅線,後端只收這類內容);
 * token 一律 AES-GCM 加密後落地。
 */
import type { KvLike } from '../config';
import { aesDecrypt, aesEncrypt } from './crypto';
import type { FacebookToken } from '../facebook/oauth';
import type { LinkedInToken } from '../linkedin/oauth';
import type { ThreadsToken } from '../threads/oauth';
import { parseQueueItem, type QueueItem } from '../queue/due';

const TOKEN_PREFIX = 'token:threads:';
const FB_TOKEN_PREFIX = 'token:facebook:';
const LI_TOKEN_PREFIX = 'token:linkedin:';

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
    const parsed = JSON.parse(await aesDecrypt(payload, encryptionKey)) as Partial<ThreadsToken> & {
      userId?: unknown;
    };
    // 舊版寫入的 userId 為 JSON number(Meta 回應型別),容錯轉字串
    const userId = typeof parsed.userId === 'number' ? String(parsed.userId) : parsed.userId;
    if (typeof parsed.accessToken !== 'string' || typeof userId !== 'string') return null;
    return { accessToken: parsed.accessToken, userId, expiresAt: parsed.expiresAt ?? 0 };
  } catch {
    return null;
  }
}

/** FB 粉專 page token(加密落地)。與 threads 不同:page token 不隨時間過期,故不設 TTL——
 *  失效時(改密碼/收回權限)由發佈失敗反映,使用者重新授權覆寫即可。 */
export async function saveFacebookToken(
  kv: KvLike,
  installId: string,
  token: FacebookToken,
  encryptionKey: string,
): Promise<void> {
  await kv.put(`${FB_TOKEN_PREFIX}${installId}`, await aesEncrypt(JSON.stringify(token), encryptionKey));
}

export async function loadFacebookToken(
  kv: KvLike,
  installId: string,
  encryptionKey: string,
): Promise<FacebookToken | null> {
  const payload = await kv.get(`${FB_TOKEN_PREFIX}${installId}`);
  if (!payload) return null;
  try {
    const parsed = JSON.parse(await aesDecrypt(payload, encryptionKey)) as Partial<FacebookToken>;
    if (
      typeof parsed.pageId !== 'string' ||
      typeof parsed.pageName !== 'string' ||
      typeof parsed.accessToken !== 'string'
    ) {
      return null;
    }
    return { pageId: parsed.pageId, pageName: parsed.pageName, accessToken: parsed.accessToken };
  } catch {
    return null;
  }
}

/** LinkedIn token(加密落地;access 60 天+選配 refresh token,靠 worker cron 盡力刷新——
 *  無 refresh token 的 App 到期由使用者重新授權覆寫,故不設 TTL)。 */
export async function saveLinkedInToken(
  kv: KvLike,
  installId: string,
  token: LinkedInToken,
  encryptionKey: string,
): Promise<void> {
  await kv.put(`${LI_TOKEN_PREFIX}${installId}`, await aesEncrypt(JSON.stringify(token), encryptionKey));
}

export async function loadLinkedInToken(
  kv: KvLike,
  installId: string,
  encryptionKey: string,
): Promise<LinkedInToken | null> {
  const payload = await kv.get(`${LI_TOKEN_PREFIX}${installId}`);
  if (!payload) return null;
  try {
    const parsed = JSON.parse(await aesDecrypt(payload, encryptionKey)) as Partial<LinkedInToken>;
    if (
      typeof parsed.accessToken !== 'string' ||
      typeof parsed.memberId !== 'string' ||
      typeof parsed.memberName !== 'string'
    ) {
      return null;
    }
    return {
      accessToken: parsed.accessToken,
      memberId: parsed.memberId,
      memberName: parsed.memberName,
      refreshToken: typeof parsed.refreshToken === 'string' ? parsed.refreshToken : '',
      expiresAt: parsed.expiresAt ?? 0,
      refreshExpiresAt: parsed.refreshExpiresAt ?? 0,
    };
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
