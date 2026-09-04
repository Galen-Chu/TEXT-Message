/** GmailMessage → 既有 Email 型別的映射(Email 結構不變,下游元件無感)。 */
import type { Email } from '../../types';
import { shortDateLabel } from '../../utils/date';
import { GMAIL_FULL_BODY_MAX_CHARS } from './config';
import { classifyEmail } from './classify';
import { decodeMimeEncodedWords, extractBodyText, getHeader, parseFromHeader } from './mime';
import type { GmailMessage } from './types';

export function mapGmailMessage(msg: GmailMessage): Email {
  const payload = msg.payload;
  const from = parseFromHeader(getHeader(payload, 'From'));
  const subject = decodeMimeEncodedWords(getHeader(payload, 'Subject')).trim() || '(無主旨)';
  const body = extractBodyText(payload);
  const snippet = (msg.snippet ?? '').trim() || body.slice(0, 90);

  const internal = Number(msg.internalDate);
  let date = new Date();
  if (Number.isFinite(internal) && internal > 0) {
    date = new Date(internal);
  } else {
    const parsed = new Date(getHeader(payload, 'Date'));
    if (!Number.isNaN(parsed.getTime())) date = parsed;
  }

  const sender = from.name || from.local || from.email || '未知寄件者';
  const initial = Array.from(sender)[0]?.toUpperCase() ?? '?';

  const fullBody =
    body.length > GMAIL_FULL_BODY_MAX_CHARS
      ? body.slice(0, GMAIL_FULL_BODY_MAX_CHARS) + '…'
      : body;

  const { tag, suitable } = classifyEmail({
    senderName: from.name,
    senderLocal: from.local,
    senderDomain: from.domain,
    subject,
    snippet,
  });

  return {
    id: msg.id,
    initial,
    sender,
    subject,
    snippet,
    fullBody,
    date: shortDateLabel(date),
    tag,
    suitable,
    labelIds: msg.labelIds,
    senderEmail: from.email,
  };
}
