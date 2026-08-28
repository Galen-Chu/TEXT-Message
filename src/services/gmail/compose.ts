/**
 * Gmail 網頁版撰寫視窗 URL:已登入 Google 的使用者點擊後直接開啟新郵件
 * (比 mailto: 更適合驗收情境——測試者的瀏覽器已有 Google 工作階段,
 * 不會跳到未設定的本機郵件軟體)。
 */
export function gmailComposeUrl(to: string, subject: string, body = ''): string {
  const params = new URLSearchParams({ view: 'cm', fs: '1', to, su: subject });
  if (body) params.set('body', body);
  return `https://mail.google.com/mail/?${params.toString()}`;
}
