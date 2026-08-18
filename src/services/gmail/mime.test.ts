import { describe, expect, it } from 'vitest';
import {
  decodeBase64Url,
  decodeMimeEncodedWords,
  decodeQuotedPrintable,
  extractBodyText,
  getHeader,
  htmlToText,
  parseFromHeader,
} from './mime';
import type { GmailMimePart } from './types';

function b64url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

describe('decodeBase64Url', () => {
  it('ascii 與缺少 padding', () => {
    expect(decodeBase64Url(btoa('hello').replace(/=+$/, ''))).toBe('hello');
  });

  it('-_ 字母表', () => {
    // '??~'(0x3F 0x3F 0x7E)→ base64 'Pz9+',url-safe 形式把 '+' 換成 '-'
    expect(btoa('??~')).toBe('Pz9+');
    expect(decodeBase64Url('Pz9-')).toBe('??~');
  });

  it('多位元組中文 → UTF-8', () => {
    expect(decodeBase64Url(b64url('中文內容'))).toBe('中文內容');
  });
});

describe('decodeQuotedPrintable', () => {
  it('=XX 十六進位位元組', () => {
    // 「中」的 UTF-8 = E4 B8 AD
    expect(decodeQuotedPrintable('=E4=B8=AD')).toBe('中');
  });

  it('軟換行 =\\n 移除', () => {
    expect(decodeQuotedPrintable('abc=\ndef')).toBe('abcdef');
  });

  it('字面 = 以 =3D 表示', () => {
    expect(decodeQuotedPrintable('a=3Db')).toBe('a=b');
  });
});

describe('decodeMimeEncodedWords', () => {
  it('B 編碼中文主旨', () => {
    const encoded = `=?UTF-8?B?${b64url('會議記錄:第三季規劃')}?=`;
    expect(decodeMimeEncodedWords(encoded)).toBe('會議記錄:第三季規劃');
  });

  it('Q 編碼:_ 是空格、=XX 是位元組', () => {
    expect(decodeMimeEncodedWords('=?UTF-8?Q?hello_world=E4=B8=AD?=')).toBe('hello world中');
  });

  it('編碼詞與明文混合', () => {
    const encoded = `=?UTF-8?B?${b64url('週報')}?= 第52期`;
    expect(decodeMimeEncodedWords(encoded)).toBe('週報 第52期');
  });

  it('相鄰 encoded-word 之間空白移除', () => {
    const a = `=?UTF-8?B?${b64url('甲')}?=`;
    const b = `=?UTF-8?B?${b64url('乙')}?=`;
    expect(decodeMimeEncodedWords(`${a} ${b}`)).toBe('甲乙');
  });

  it('未知字集不丟例外(優雅降級)', () => {
    expect(() => decodeMimeEncodedWords('=?X-UNKNOWN?B?QUJD?=')).not.toThrow();
  });
});

describe('getHeader', () => {
  const part: GmailMimePart = {
    headers: [
      { name: 'Subject', value: 'A' },
      { name: 'from', value: 'b@c' },
    ],
  };
  it('大小寫不敏感', () => {
    expect(getHeader(part, 'subject')).toBe('A');
    expect(getHeader(part, 'FROM')).toBe('b@c');
  });
  it('缺漏回空字串', () => {
    expect(getHeader(part, 'Date')).toBe('');
    expect(getHeader(undefined, 'Date')).toBe('');
  });
});

describe('parseFromHeader', () => {
  it('名稱 <位址>', () => {
    const r = parseFromHeader('光影香氛 Studio <marketing@studio.example>');
    expect(r.name).toBe('光影香氛 Studio');
    expect(r.email).toBe('marketing@studio.example');
    expect(r.local).toBe('marketing');
    expect(r.domain).toBe('studio.example');
  });

  it('純位址', () => {
    const r = parseFromHeader('wenwen@gmail.com');
    expect(r.name).toBe('');
    expect(r.email).toBe('wenwen@gmail.com');
    expect(r.domain).toBe('gmail.com');
  });

  it('encoded-word 顯示名稱先解碼', () => {
    const encoded = `=?UTF-8?B?${b64url('換日線')}?= <news@crossing.example>`;
    const r = parseFromHeader(encoded);
    expect(r.name).toBe('換日線');
    expect(r.domain).toBe('crossing.example');
  });
});

describe('extractBodyText', () => {
  it('單一 text/plain', () => {
    const part: GmailMimePart = { mimeType: 'text/plain', body: { data: b64url('你好,\n世界') } };
    expect(extractBodyText(part)).toBe('你好,\n世界');
  });

  it('multipart/alternative 優先 text/plain', () => {
    const part: GmailMimePart = {
      mimeType: 'multipart/alternative',
      parts: [
        { mimeType: 'text/html', body: { data: b64url('<p>HTML版本</p>') } },
        { mimeType: 'text/plain', body: { data: b64url('純文字版本') } },
      ],
    };
    expect(extractBodyText(part)).toBe('純文字版本');
  });

  it('僅有 html 時轉為文字', () => {
    const part: GmailMimePart = {
      mimeType: 'multipart/alternative',
      parts: [{ mimeType: 'text/html', body: { data: b64url('<p>第一段</p><p>第二段<br>換行</p>') } }],
    };
    const text = extractBodyText(part);
    expect(text).toContain('第一段');
    expect(text).toContain('第二段');
    expect(text).toContain('換行');
    expect(text).not.toContain('<');
  });

  it('multipart/mixed 跳過附件,取正文', () => {
    const part: GmailMimePart = {
      mimeType: 'multipart/mixed',
      parts: [
        { mimeType: 'text/plain', body: { data: b64url('正文內容') } },
        { mimeType: 'application/pdf', filename: 'doc.pdf', body: { data: b64url('%PDF-1.4') } },
      ],
    };
    expect(extractBodyText(part)).toBe('正文內容');
  });

  it('quoted-printable 內層編碼解碼', () => {
    const qpBytes = new TextEncoder().encode('=E4=B8=AD=E6=96=87=20QP');
    let wire = '';
    qpBytes.forEach((b) => (wire += String.fromCharCode(b)));
    const part: GmailMimePart = {
      mimeType: 'text/plain',
      headers: [{ name: 'Content-Transfer-Encoding', value: 'quoted-printable' }],
      body: { data: b64url(wire) },
    };
    expect(extractBodyText(part)).toBe('中文 QP');
  });

  it('深層巢狀 multipart 找得到內文', () => {
    const part: GmailMimePart = {
      mimeType: 'multipart/mixed',
      parts: [
        {
          mimeType: 'multipart/alternative',
          parts: [{ mimeType: 'text/plain', body: { data: b64url('巢狀正文') } }],
        },
      ],
    };
    expect(extractBodyText(part)).toBe('巢狀正文');
  });

  it('無內文回空字串', () => {
    expect(extractBodyText(undefined)).toBe('');
  });
});

describe('htmlToText', () => {
  it('script/style 移除', () => {
    expect(htmlToText('<style>a{}</style><script>bad()</script>ok')).toBe('ok');
  });
  it('實體解碼', () => {
    expect(htmlToText('&lt;b&gt;&amp;&nbsp;&quot;')).toBe('<b>& "');
  });
  it('數字實體', () => {
    expect(htmlToText('&#20013;')).toBe('中');
  });
});
