// 正式站驗證 v2:導覽用文字定位,按鈕用寬鬆定位,加狀態列文字檢查
import { chromium } from '@playwright/test';

const URL = 'https://galen-chu.github.io/TEXT-Message/';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(URL, { waitUntil: 'networkidle', timeout: 45000 });

// 點側邊欄「Gmail 郵件匣」(文字定位,不限元素型別)
const nav = page.getByText('Gmail 郵件匣', { exact: false });
console.log('nav candidates:', await nav.count());
if (await nav.count()) {
  await nav.first().click();
  await page.waitForTimeout(1500);
}

const status = await page.textContent('body');
const hasDemoHint = status.includes('示範模式');
const hasDisconnected = status.includes('可連接真實 Gmail 帳號');
console.log('page shows demo hint:', hasDemoHint);
console.log('page shows "可連接真實 Gmail 帳號":', hasDisconnected);

const btn = page.getByRole('button', { name: /連接/ });
const count = await btn.count();
console.log('connect button count:', count);

if (count > 0) {
  console.log('button text:', (await btn.first().textContent()).trim());
  const popupPromise = page.waitForEvent('popup', { timeout: 20000 });
  await btn.first().click();
  try {
    const popup = await popupPromise;
    await popup.waitForLoadState('domcontentloaded', { timeout: 20000 });
    console.log('popup URL:', popup.url().slice(0, 100));
    console.log('is Google OAuth page:', popup.url().includes('accounts.google.com'));
    await popup.screenshot({ path: 'output-oauth-popup.png' });
    console.log('oauth popup screenshot saved');
  } catch (e) {
    console.log('no popup within 20s:', String(e).split('\n')[0]);
  }
} else {
  await page.screenshot({ path: 'output-live-page.png', fullPage: true });
  console.log('still no button — screenshot saved for inspection');
}
await browser.close();
