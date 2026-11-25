// Screenshots of the new admin screens against the local dev API (read-only: no save is clicked).
import { createRequire } from 'node:module';
const require = createRequire('D:/huit/nosql/Source/warranty-system/warranty-system-soopi/frontend-react/package.json');
const { chromium } = require('playwright-core');
const out = process.argv[2];
const base = 'http://127.0.0.1:5173';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  await page.goto(base + '/login');
  await page.getByPlaceholder('VD: 0912345678 hoặc ten@gmail.com').fill('admin');
  await page.getByPlaceholder('Nhập mật khẩu của bạn').fill('admin123');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.waitForURL(base + '/admin');
  const settle = () => page.waitForLoadState('networkidle').then(() => page.waitForTimeout(800));
  const hideChat = () => page.addStyleTag({ content: '.chat-fab, [data-chat-launcher], .chat-launcher { display: none !important; }' });
  // Grow the viewport to the content height instead of fullPage, so sticky header/sidebar stay in place.
  const tall = async (path) => {
    const h = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, ...[...document.querySelectorAll('main, .app-main, .content')].map(e => e.scrollHeight)));
    await page.setViewportSize({ width: 1440, height: Math.min(Math.max(h, 900), 3000) });
    await page.waitForTimeout(500);
    await page.mouse.move(5, 5);
    await page.screenshot({ path });
    await page.setViewportSize({ width: 1440, height: 900 });
  };

  // 1) Time settings: SLA, quotation, business hours.
  await page.goto(base + '/admin#time-settings'); await settle(); await hideChat();
  await tall(`${out}/ui_time_settings.png`);

  // 2) Protection sections expanded.
  const panel = page.locator('[data-page-panel="time-settings"]');
  await panel.evaluate(el => el.querySelectorAll('details.time-settings__protection').forEach(d => { d.open = true; }));
  await page.waitForTimeout(400);
  await tall(`${out}/ui_time_settings_protection.png`);

  // 3) Catalog parts tab with inline price editing open (cancelled with Esc, nothing saved).
  await page.goto(base + '/admin#catalogs'); await settle(); await hideChat();
  await page.getByRole('tab', { name: /Linh kiện/ }).click(); await page.waitForTimeout(500);
  const parts = page.locator('#catalog-panel-parts');
  await parts.getByRole('button', { name: /^Sửa giá / }).first().click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/ui_catalog_price_edit.png` });
  await page.keyboard.press('Escape');

  // 4) Reports overview with the SLA late tile, 5) technician performance tab.
  await page.goto(base + '/admin#reports'); await settle(); await hideChat();
  await tall(`${out}/ui_reports_overview.png`);
  const techTab = page.getByRole('tab', { name: /Kỹ thuật viên|Hiệu suất/ });
  if (await techTab.count()) { await techTab.first().click(); await settle(); }
  await tall(`${out}/ui_reports_technicians.png`);
  const tabs = await page.getByRole('tab').allInnerTexts();
  console.log('report tabs', tabs);
} finally {
  await browser.close();
}
