/**
 * YouTube Data API v3 影片上傳(resumable,兩步):
 * 1. POST 中繼資料 → 取得 Location(上傳作業 URL)
 * 2. PUT 檔案位元組(XHR,支援上傳進度)
 * 僅在瀏覽器執行;錯誤一律抛 YoutubeError。
 */
import { YOUTUBE_UPLOAD_URL } from './config';
import { YoutubeError, fromHttpStatus } from './errors';
import type { VideoMetadata } from './video';

export interface UploadResult {
  id: string;
}

/** 起始 resumable session,回傳上傳作業 URL。 */
async function createUploadSession(
  token: string,
  file: File,
  metadata: VideoMetadata,
): Promise<string> {
  let resp: Response;
  try {
    resp = await fetch(YOUTUBE_UPLOAD_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Length': String(file.size),
        'X-Upload-Content-Type': file.type || 'application/octet-stream',
      },
      body: JSON.stringify(metadata),
    });
  } catch (err) {
    if (err instanceof TypeError) throw new YoutubeError('network', String(err));
    throw err;
  }
  if (!resp.ok) throw fromHttpStatus(resp.status, await resp.text());
  const location = resp.headers.get('Location');
  if (!location) throw new YoutubeError('parse', 'missing upload session Location header');
  return location;
}

/** 以 XHR PUT 上傳位元組(fetch 無法追蹤上傳進度,XHR 的 upload.onprogress 可以)。 */
function putFile(
  sessionUrl: string,
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<UploadResult> {
  return new Promise<UploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', sessionUrl);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onerror = () => reject(new YoutubeError('network', 'upload request failed'));
    xhr.ontimeout = () => reject(new YoutubeError('network', 'upload timed out'));
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(fromHttpStatus(xhr.status, xhr.responseText ?? ''));
        return;
      }
      try {
        const data = JSON.parse(xhr.responseText) as { id?: string };
        if (!data.id) throw new Error('no id');
        resolve({ id: data.id });
      } catch {
        reject(new YoutubeError('parse', 'cannot parse video resource'));
      }
    };
    xhr.send(file);
  });
}

export function uploadVideo(opts: {
  token: string;
  file: File;
  metadata: VideoMetadata;
  onProgress?: (fraction: number) => void;
}): Promise<UploadResult> {
  return createUploadSession(opts.token, opts.file, opts.metadata).then((url) =>
    putFile(url, opts.file, opts.onProgress),
  );
}
