/**
 * 「在 Gmail 建立篩選器」深連結(唯讀輔助):
 * Gmail 沒有直接開啟「建立篩選器」對話框的 URL,最接近的做法是以預填的
 * from: 搜尋開啟 Gmail——使用者再從搜尋選項建立篩選器(伺服器端 24/7 生效,
 * 套用標籤/略過收件匣皆由 Gmail 自己完成,本 App 不碰任何寫入權限)。
 */
export function gmailFilterSearchUrl(senderEmail: string): string {
  return `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(`from:${senderEmail}`)}`;
}
