/**
 * 家族交接佇列(U3,2026-10-12)。文管庫目前只當**寫入端**:把文案 append 進
 * `family:handoff:v1`,媒管庫媒庫的收件匣讀取並刪除 `to` 是自己的項目
 * (反向「存回文管庫文庫」另議——`parseHandoff`/`pruneHandoff` 已可支援,
 * 屆時只要加讀取端)。
 *
 * 契約形狀見 `config.ts` 註解與媒管庫 `docs/IA-PLAN.md` §3.2。所有解析一律防禦式:
 * 版本不符/格式壞=**當作不存在**(回空佇列),不報錯、不拋例外——與降級模式同精神。
 */
import {
  HANDOFF_KEY,
  HANDOFF_MAX_ITEMS,
  PEER_PRODUCT,
  STALE_MS,
  THIS_PRODUCT,
  type FamilyProduct,
} from './config';

export interface HandoffItem {
  id: string;
  from: FamilyProduct;
  to: FamilyProduct;
  /** 目前僅 'caption'(文案);新增種類時兩邊契約文件同步。 */
  kind: 'caption';
  text: string;
  createdAt: number;
}

/** 可注入的儲存介面(比照 `services/backend/client` 的 fetch 注入,供測試)。 */
export interface FamilyStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function isProduct(v: unknown): v is FamilyProduct {
  return v === 'text-message' || v === 'media-message';
}

function isHandoffItem(v: unknown): v is HandoffItem {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    isProduct(o.from) &&
    isProduct(o.to) &&
    o.kind === 'caption' &&
    typeof o.text === 'string' &&
    typeof o.createdAt === 'number' &&
    Number.isFinite(o.createdAt)
  );
}

/** 解析佇列;版本不符或形狀壞一律回 []。單筆壞掉只丟那一筆,不連坐整個佇列。 */
export function parseHandoff(raw: string | null): HandoffItem[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (typeof parsed !== 'object' || parsed === null) return [];
  const envelope = parsed as Record<string, unknown>;
  if (envelope.v !== 1 || !Array.isArray(envelope.items)) return [];
  return envelope.items.filter(isHandoffItem);
}

/** 陳舊項目剔除(超過 STALE_MS 視為不存在)。 */
export function pruneHandoff(items: HandoffItem[], now: number): HandoffItem[] {
  return items.filter((i) => now - i.createdAt <= STALE_MS);
}

/** 純函式 append:先剔除陳舊,再放新項目,超量淘汰最舊(佇列尾端為最新)。 */
export function appendHandoff(items: HandoffItem[], item: HandoffItem, now: number): HandoffItem[] {
  const next = [...pruneHandoff(items, now), item];
  return next.slice(-HANDOFF_MAX_ITEMS);
}

export function serializeHandoff(items: HandoffItem[]): string {
  return JSON.stringify({ v: 1, items });
}

/**
 * 送一筆文案給媒管庫。回傳**待媒管庫取用的筆數**(不含反向的 inbound 項目,
 * 與 `pendingToPeerCount` 同義,UI 才不會把對方送來的也算進去);
 * 儲存不可用(隱私模式/配額滿)回 null,呼叫端據此提示失敗——交接是使用者明確
 * 發起的動作,不可靜默吞掉。
 */
export function sendCaptionToPeer(
  text: string,
  deps: { storage: FamilyStorage; now: number; id: string },
): number | null {
  const item: HandoffItem = {
    id: deps.id,
    from: THIS_PRODUCT,
    to: PEER_PRODUCT,
    kind: 'caption',
    text,
    createdAt: deps.now,
  };
  try {
    const next = appendHandoff(parseHandoff(deps.storage.getItem(HANDOFF_KEY)), item, deps.now);
    deps.storage.setItem(HANDOFF_KEY, serializeHandoff(next));
    return next.filter((i) => i.to === PEER_PRODUCT).length;
  } catch {
    return null;
  }
}

/** 本機待取用的交接筆數(送給媒管庫、尚未被它取走的)。 */
export function pendingToPeerCount(deps: { storage: FamilyStorage; now: number }): number {
  try {
    const items = pruneHandoff(parseHandoff(deps.storage.getItem(HANDOFF_KEY)), deps.now);
    return items.filter((i) => i.to === PEER_PRODUCT).length;
  } catch {
    return 0;
  }
}
