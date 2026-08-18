import { expect, test } from '@playwright/test';

const PATH = '/TEXT-message/';

/** 點擊側邊欄導覽(限定 nav 範圍,避免與畫面內其他按鈕撞名)。 */
async function gotoTab(page: import('@playwright/test').Page, name: string) {
  await page.locator('nav').getByText(name, { exact: true }).click();
}

test('載入:標題與側邊欄六個分頁', async ({ page }) => {
  await page.goto(PATH);
  await expect(page).toHaveTitle('文管庫');
  for (const nav of ['首頁總覽', 'Gmail 郵件匣', '社群媒體', '排程管理', '草稿撰寫', '文管庫']) {
    await expect(page.locator('nav').getByText(nav, { exact: true })).toBeVisible();
  }
  await expect(page.getByText('近期排程')).toBeVisible();
});

test('分頁切換:各頁主標題正確', async ({ page }) => {
  await page.goto(PATH);
  for (const nav of ['Gmail 郵件匣', '社群媒體', '排程管理', '草稿撰寫', '文管庫']) {
    await gotoTab(page, nav);
    await expect(page.locator('main').getByText(nav, { exact: true }).first()).toBeVisible();
  }
  // 回首頁
  await gotoTab(page, '首頁總覽');
  await expect(page.getByText('近期排程')).toBeVisible();
});

test('郵件匣:示範模式與連線入口的狀態一致', async ({ page }) => {
  await page.goto(PATH);
  await gotoTab(page, 'Gmail 郵件匣');
  const connectButton = page.getByRole('button', { name: '連接 Gmail 帳號' });
  const unconfigured = await page.getByText('未設定 Gmail 連線').count();
  if (unconfigured > 0) {
    // 示範模式建置(無 Client ID):不應出現連接按鈕
    await expect(page.getByText('示範模式')).toBeVisible();
    await expect(connectButton).toHaveCount(0);
  } else {
    // 已設定 Client ID 的建置:顯示示範資料 + 連接按鈕
    await expect(connectButton).toBeVisible();
  }
});

test('文管庫:雙分頁切換與新增內容 modal', async ({ page }) => {
  await page.goto(PATH);
  await gotoTab(page, '文管庫');
  await expect(page.getByRole('button', { name: '訊息管理', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '文案管理', exact: true }).click();
  await expect(page.getByRole('button', { name: '品牌故事', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '+ 新增內容' }).click();
  await expect(page.getByText('新增內容', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '取消' }).click();
  await expect(page.getByText('新增內容', { exact: true })).toHaveCount(0);
});

test('核心流程:郵件轉為草稿', async ({ page }) => {
  await page.goto(PATH);
  await gotoTab(page, 'Gmail 郵件匣');
  await page.getByRole('button', { name: '轉為草稿' }).first().click();
  await expect(page.locator('main').getByText('草稿撰寫', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('原始郵件參考')).toBeVisible();
  const textarea = page.locator('textarea');
  await expect(textarea).toHaveValue(/.+/);
});

test('排程:手動新增與刪除', async ({ page }) => {
  await page.goto(PATH);
  await gotoTab(page, '排程管理');
  await page.getByRole('button', { name: '+ 新增排程' }).click();
  await page.getByPlaceholder('例如:週末生活分享').fill('E2E測試排程');
  await page.getByRole('button', { name: '新增', exact: true }).click();
  // 項目會同時出現在「選定日排程」與「所有排程」兩張卡,取第一筆
  await expect(page.getByText('E2E測試排程').first()).toBeVisible();

  // 標題 → 內層 flex div → 整列 row(刪除按鈕在 row 層),上溯兩層
  const row = page.getByText('E2E測試排程').first().locator('../..');
  await row.getByRole('button', { name: '刪除' }).click();
  await expect(page.getByText('E2E測試排程')).toHaveCount(0);
});

test('持久化:新增範本重新整理後仍在', async ({ page }) => {
  await page.goto(PATH);
  await gotoTab(page, '文管庫');
  await page.getByRole('button', { name: '+ 新增內容' }).click();
  await page.getByPlaceholder('例如:感謝訂閱電子報').fill('E2E持久化範本');
  await page.getByRole('button', { name: '儲存範本' }).click();
  await expect(page.getByText('E2E持久化範本')).toBeVisible();

  await page.reload();
  await gotoTab(page, '文管庫');
  await expect(page.getByText('E2E持久化範本')).toBeVisible();
});
