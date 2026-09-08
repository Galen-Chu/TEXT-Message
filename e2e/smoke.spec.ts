import { expect, test } from '@playwright/test';

const PATH = '/TEXT-Message/';

/** 點擊側邊欄導覽(限定 nav 範圍,避免與畫面內其他按鈕撞名)。 */
async function gotoTab(page: import('@playwright/test').Page, name: string) {
  await page.locator('nav').getByText(name, { exact: true }).click();
}

test('載入:標題與側邊欄七個分頁', async ({ page }) => {
  await page.goto(PATH);
  await expect(page).toHaveTitle('TEXT-Message');
  for (const nav of ['文管 Dashboard', '郵件匣 Gmail', '自媒體 Social', '雲端列 Drive', '編發器 Text', '定排程 Task', '文庫 Library']) {
    await expect(page.locator('nav').getByText(nav, { exact: true })).toBeVisible();
  }
  await expect(page.getByText('近期排程')).toBeVisible();
});

test('分頁切換:各頁主標題正確', async ({ page }) => {
  await page.goto(PATH);
  for (const nav of ['郵件匣 Gmail', '自媒體 Social', '雲端列 Drive', '編發器 Text', '定排程 Task', '文庫 Library']) {
    await gotoTab(page, nav);
    await expect(page.locator('main').getByText(nav, { exact: true }).first()).toBeVisible();
  }
  // 回首頁
  await gotoTab(page, '文管 Dashboard');
  await expect(page.getByText('近期排程')).toBeVisible();
  // IA Phase 5:自媒體頁有「最新互動」卡(平台互動通知信)
  await gotoTab(page, '自媒體 Social');
  await expect(page.getByText('最新互動').first()).toBeVisible();
});

test('雲端列:示範文檔可預覽、引用到編發器、設為風格樣本', async ({ page }) => {
  await page.goto(PATH);
  await gotoTab(page, '雲端列 Drive');
  await expect(page.getByText('蘭嶼慢旅記:三天兩夜的手帳筆記').first()).toBeVisible();

  await page.getByText('蘭嶼慢旅記:三天兩夜的手帳筆記').first().click();
  await expect(page.getByRole('button', { name: '引用到編發器' })).toBeVisible();

  // 二期:設為風格樣本 → Esc 關閉 modal → 清單出現 ★ 標記
  await page.getByRole('button', { name: '設為風格樣本' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByText('★').first()).toBeVisible();

  await page.getByText('蘭嶼慢旅記:三天兩夜的手帳筆記').first().click();
  await page.getByRole('button', { name: '引用到編發器' }).click();

  await expect(page.locator('main').getByText('編發器 Text', { exact: true }).first()).toBeVisible();
  await expect(page.locator('textarea').first()).toHaveValue(/蘭嶼慢旅記/);
  // 二期:有風格樣本時,編發器 AI 卡出現參照開關
  await expect(page.getByText('參照我的 Drive 風格(1 篇)')).toBeVisible();
});

test('郵件匣:示範模式與連線入口的狀態一致', async ({ page }) => {
  await page.goto(PATH);
  await gotoTab(page, '郵件匣 Gmail');
  // IA Phase 5:互動通知篩選 chip 存在
  await expect(page.getByText('互動通知').first()).toBeVisible();
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

test('文庫:三分頁切換與新增內容 modal', async ({ page }) => {
  await page.goto(PATH);
  await gotoTab(page, '文庫 Library');
  await expect(page.getByRole('button', { name: '訊息管理', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '文案管理', exact: true }).click();
  await expect(page.getByRole('button', { name: '品牌故事', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '草稿管理', exact: true }).click();
  await expect(page.getByText('感謝來信回覆').first()).toBeVisible();
  await page.getByRole('button', { name: '文案管理', exact: true }).click();
  await page.getByRole('button', { name: '+ 新增內容' }).click();
  await expect(page.getByText('新增內容', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '取消' }).click();
  await expect(page.getByText('新增內容', { exact: true })).toHaveCount(0);
});

test('草稿管理:儲存草稿入文庫,重新整理後仍在,可開啟至編輯器', async ({ page }) => {
  await page.goto(PATH);
  await gotoTab(page, '郵件匣 Gmail');
  await page.getByRole('button', { name: '轉為草稿' }).first().click();
  await page.getByRole('button', { name: '儲存草稿' }).click();

  await gotoTab(page, '文庫 Library');
  await page.getByRole('button', { name: '草稿管理', exact: true }).click();
  await expect(page.getByRole('button', { name: '開啟至編輯器' }).first()).toBeVisible();

  await page.reload();
  await gotoTab(page, '文庫 Library');
  await page.getByRole('button', { name: '草稿管理', exact: true }).click();
  await expect(page.getByRole('button', { name: '開啟至編輯器' }).first()).toBeVisible();

  await page.getByRole('button', { name: '開啟至編輯器' }).first().click();
  await expect(page.locator('main').getByText('編發器 Text', { exact: true }).first()).toBeVisible();
  await expect(page.locator('textarea').first()).toHaveValue(/.+/);
  // IA Phase 3:文檔類型 chips 可見
  await expect(page.getByText('文檔類型')).toBeVisible();
});

test('核心流程:郵件轉為草稿', async ({ page }) => {
  await page.goto(PATH);
  await gotoTab(page, '郵件匣 Gmail');
  await page.getByRole('button', { name: '轉為草稿' }).first().click();
  await expect(page.locator('main').getByText('編發器 Text', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('原始郵件參考')).toBeVisible();
  const textarea = page.locator('textarea');
  await expect(textarea).toHaveValue(/.+/);
});

test('排程:手動新增與刪除', async ({ page }) => {
  await page.goto(PATH);
  await gotoTab(page, '定排程 Task');
  await page.getByRole('button', { name: '+ 新增排程' }).click();
  // IA Phase 4:modal 有文檔類型選擇(預設文案)
  await expect(page.getByText('文檔類型')).toBeVisible();
  await page.getByPlaceholder('例如:週末生活分享').fill('E2E測試排程');
  await page.getByRole('button', { name: '新增', exact: true }).click();
  // 項目會同時出現在「選定日排程」與「所有排程」兩張卡,取第一筆
  await expect(page.getByText('E2E測試排程').first()).toBeVisible();
  // IA Phase 4:類別篩選列與預設文案徽章
  await expect(page.getByText('類別', { exact: true })).toBeVisible();
  await expect(page.locator('span.pill', { hasText: '文案' }).first()).toBeVisible();

  // 標題 → 內層 flex div → 整列 row(刪除按鈕在 row 層),上溯兩層
  const row = page.getByText('E2E測試排程').first().locator('../..');
  await row.getByRole('button', { name: '刪除' }).click();
  await expect(page.getByText('E2E測試排程')).toHaveCount(0);
});

test('持久化:新增範本重新整理後仍在', async ({ page }) => {
  await page.goto(PATH);
  await gotoTab(page, '文庫 Library');
  await page.getByRole('button', { name: '+ 新增內容' }).click();
  await page.getByPlaceholder('例如:感謝訂閱電子報').fill('E2E持久化範本');
  await page.getByRole('button', { name: '儲存範本' }).click();
  await expect(page.getByText('E2E持久化範本')).toBeVisible();

  await page.reload();
  await gotoTab(page, '文庫 Library');
  await expect(page.getByText('E2E持久化範本')).toBeVisible();
});

test('持久化:草稿重新整理後仍在,捨棄後清除', async ({ page }) => {
  await page.goto(PATH);
  await gotoTab(page, '郵件匣 Gmail');
  await page.getByRole('button', { name: '轉為草稿' }).first().click();
  await page.locator('textarea').fill('E2E持久化草稿');

  await page.reload();
  await gotoTab(page, '編發器 Text');
  await expect(page.locator('textarea')).toHaveValue(/E2E持久化草稿/);

  await page.getByRole('button', { name: '捨棄草稿' }).click();
  await expect(page.getByText('還沒有選擇內容來源')).toBeVisible();

  await page.reload();
  await gotoTab(page, '編發器 Text');
  await expect(page.getByText('還沒有選擇內容來源')).toBeVisible();
});

test('文庫:編輯與刪除範本', async ({ page }) => {
  await page.goto(PATH);
  await gotoTab(page, '文庫 Library');
  await page.getByRole('button', { name: '+ 新增內容' }).click();
  await page.getByPlaceholder('例如:感謝訂閱電子報').fill('E2E編輯目標');
  await page.getByRole('button', { name: '儲存範本' }).click();
  await expect(page.getByText('E2E編輯目標')).toBeVisible();

  // 標題 div 的上一層即為卡片,編輯/複製/刪除按鈕在卡片底部
  const card = page.getByText('E2E編輯目標').first().locator('..');
  await card.getByRole('button', { name: '編輯', exact: true }).click();
  await expect(page.getByText('編輯內容', { exact: true })).toBeVisible();
  await page.getByPlaceholder('例如:感謝訂閱電子報').fill('E2E已編輯');
  await page.getByRole('button', { name: '儲存變更' }).click();
  await expect(page.getByText('E2E已編輯')).toBeVisible();

  const editedCard = page.getByText('E2E已編輯').first().locator('..');
  await editedCard.getByRole('button', { name: '刪除' }).click();
  await expect(page.getByText('E2E已編輯')).toHaveCount(0);
});
