import { createRequire } from 'node:module';
const require = createRequire('D:/huit/nosql/Source/warranty-system/warranty-system-soopi/frontend-react/package.json');
const { chromium } = require('playwright-core');
const out = process.argv[2], base = 'http://127.0.0.1:5173';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 2600 }, locale: 'vi-VN' })).newPage();
  await page.goto(base + '/login');
  await page.getByPlaceholder('VD: 0912345678 hoặc ten@gmail.com').fill('admin');
  await page.getByPlaceholder('Nhập mật khẩu của bạn').fill('admin123');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.waitForURL(base + '/admin');
  await page.goto(base + '/admin#reports'); await page.reload(); await page.waitForLoadState('networkidle'); await page.waitForTimeout(900);
  await page.addStyleTag({ content: '.chat-fab, [data-chat-launcher], .chat-launcher { display: none !important; }' });
  await page.getByRole('tab', { name: 'Đánh giá' }).click(); await page.waitForLoadState('networkidle'); await page.waitForTimeout(800);
  await page.mouse.move(5, 5);
  const b = await page.locator('#report-panel-reviews').boundingBox();
  await page.screenshot({ path: `${out}/f13.png`, clip: { x: b.x, y: b.y, width: b.width, height: Math.min(b.height, 560) } });
} finally { await browser.close(); }
