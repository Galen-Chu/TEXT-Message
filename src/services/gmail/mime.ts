/**
 * DOM-free MIME 工具(可在 node 環境單元測試)。
 * Gmail API 的 body.data 一律是 base64url;原始信件可能再有
 * quoted-printable / base64 內層編碼,中文主旨/寄件者則以 RFC 2047
 * encoded-words(=?UTF-8?B/Q?...?=)編碼——都必須解開,否則分類全錯。
 */
import type { GmailMimePart } from './types';

function base64UrlToBytes(b64: string): Uint8Array {
  const normalized = b64.replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
}

/** base64url 解碼為 UTF-8 字串。 */
export function decodeBase64Url(b64: string): string {
  return decodeBytes(base64UrlToBytes(b64), 'utf-8');
}

function decodeBytes(bytes: Uint8Array, charset: string): string {
  const cs = charset.toLowerCase();
  if (cs === 'utf-8' || cs === 'utf8' || cs === 'us-ascii' || cs === 'ascii') {
    return new TextDecoder('utf-8').decode(bytes);
  }
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    // 不認得的字集:退回 UTF-8(再失敗退 latin1),寧可亂碼不可炸
    try {
      return new TextDecoder('utf-8').decode(bytes);
    } catch {
      return new TextDecoder('latin1').decode(bytes);
    }
  }
}

/** quoted-printable 位元組級解碼(=XX 十六進位、=\n 軟換行)。 */
function qpDecode(bytes: Uint8Array): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0x3d /* '=' */) {
      if (i + 2 < bytes.length + 1) {
        const hex = String.fromCharCode(bytes[i + 1] ?? 0, bytes[i + 2] ?? 0);
        if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
          out.push(parseInt(hex, 16));
          i += 2;
          continue;
        }
      }
      // 軟換行 =\n 或 =\r\n:連同換行一併略過
      const next = bytes[i + 1];
      if (next === 0x0a) {
        i += 1;
        continue;
      }
      if (next === 0x0d) {
        i += bytes[i + 2] === 0x0a ? 2 : 1;
        continue;
      }
      out.push(bytes[i]);
    } else {
      out.push(bytes[i]);
    }
  }
  return new Uint8Array(out);
}

/** quoted-printable 字串解碼(公開介面,測試與少數路徑使用)。 */
export function decodeQuotedPrintable(text: string): string {
  return decodeBytes(qpDecode(new TextEncoder().encode(text)), 'utf-8');
}

/** RFC 2047 encoded-words:=?charset?B?...?= 與 =?charset?Q?...?=。 */
export function decodeMimeEncodedWords(value: string): string {
  if (!value.includes('=?')) return value;
  // 相鄰 encoded-word 之間的空白依規範應移除
  const joined = value.replace(/(\?=)[ \t]+(=\?)/g, '$1$2');
  return joined.replace(
    /=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g,
    (whole: string, charset: string, enc: string, data: string) => {
      try {
        if (enc.toUpperCase() === 'B') {
          return decodeBytes(base64UrlToBytes(data), charset);
        }
        // Q 編碼:_ 是空格,=XX 是十六進位位元組
        const bytes: number[] = [];
        const s = data.replace(/_/g, ' ');
        for (let i = 0; i < s.length; i++) {
          if (s[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(s.slice(i + 1, i + 3))) {
            bytes.push(parseInt(s.slice(i + 1, i + 3), 16));
            i += 2;
          } else {
            bytes.push(s.charCodeAt(i) & 0xff);
          }
        }
        return decodeBytes(new Uint8Array(bytes), charset);
      } catch {
        return whole; // 無法解碼時退回原字串
      }
    },
  );
}

/** 取指定 header(大小寫不敏感),缺漏回空字串。 */
export function getHeader(part: GmailMimePart | undefined, name: string): string {
  const target = name.toLowerCase();
  const hit = part?.headers?.find((h) => h.name.toLowerCase() === target);
  return hit?.value ?? '';
}

/** 解析 From header:「顯示名稱 <a@b.co>」或純位址;回傳 local/domain(小寫)。 */
export function parseFromHeader(value: string): {
  name: string;
  email: string;
  local: string;
  domain: string;
} {
  const decoded = decodeMimeEncodedWords(value).trim();
  const angle = decoded.match(/^(.*?)<([^>]+)>$/);
  let name = '';
  let email = decoded;
  if (angle) {
    name = angle[1].trim().replace(/^"(.*)"$/, '$1');
    email = angle[2].trim();
  }
  if (!email.includes('@')) {
    return { name: decoded, email: '', local: '', domain: '' };
  }
  const at = email.lastIndexOf('@');
  return {
    name,
    email,
    local: email.slice(0, at).toLowerCase(),
    domain: email.slice(at + 1).toLowerCase(),
  };
}

function charsetOf(part: GmailMimePart): string {
  const ct = getHeader(part, 'Content-Type');
  const m = ct.match(/charset=["']?([\w-]+)["']?/i);
  return m ? m[1] : 'utf-8';
}

/** 移除 html 標籤與常見實體,還原為可讀文字(純 regex,不依賴 DOM)。 */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_m, d: string) => {
      try {
        return String.fromCodePoint(parseInt(d, 10));
      } catch {
        return _m;
      }
    })
    .replace(/&amp;/gi, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 單一葉節點(text/plain 或 text/html)解碼;非文字葉或附件回 null。 */
function leafText(part: GmailMimePart): string | null {
  const mime = (part.mimeType ?? '').toLowerCase();
  if (mime !== 'text/plain' && mime !== 'text/html') return null;
  if (part.filename) return null;
  if (getHeader(part, 'Content-Disposition').toLowerCase().includes('attachment')) return null;
  const data = part.body?.data;
  if (!data) return null;

  const rawBytes = base64UrlToBytes(data); // Gmail 一律 base64url
  const cte = getHeader(part, 'Content-Transfer-Encoding').toLowerCase();
  const charset = charsetOf(part);

  if (cte === 'quoted-printable') {
    return decodeBytes(qpDecode(rawBytes), charset);
  }
  if (cte === 'base64') {
    // 內容本身再包一層標準 base64:先還原成 wire 文字,再解一層
    const wire = decodeBytes(rawBytes, 'us-ascii');
    try {
      const stripped = wire.replace(/\s+/g, '');
      const binary = atob(stripped + '='.repeat((4 - (stripped.length % 4)) % 4));
      return decodeBytes(Uint8Array.from(binary, (ch) => ch.charCodeAt(0)), charset);
    } catch {
      return wire;
    }
  }
  return decodeBytes(rawBytes, charset);
}

interface FoundBody {
  text: string;
  isHtml: boolean;
}

function findBody(part: GmailMimePart | undefined): FoundBody | null {
  if (!part) return null;
  const mime = (part.mimeType ?? '').toLowerCase();
  if (mime.startsWith('multipart/')) {
    const children = part.parts ?? [];
    if (mime === 'multipart/alternative') {
      // 優先 text/plain(草稿參考需要純文字),其次 text/html
      for (const key of ['text/plain', 'text/html'] as const) {
        for (const child of children) {
          if ((child.mimeType ?? '').toLowerCase() === key) {
            const t = leafText(child);
            if (t !== null) return { text: t, isHtml: key === 'text/html' };
          }
        }
      }
    }
    for (const child of children) {
      const r = findBody(child);
      if (r) return r;
    }
    return null;
  }
  const t = leafText(part);
  if (t === null) return null;
  return { text: t, isHtml: mime === 'text/html' };
}

/** 遞迴取出信件內文(multipart 優先純文字;僅有 html 時轉文字)。 */
export function extractBodyText(payload: GmailMimePart | undefined): string {
  const found = findBody(payload);
  if (!found) return '';
  const text = found.isHtml ? htmlToText(found.text) : found.text;
  return text.replace(/\n{3,}/g, '\n\n').trim();
}
