// Retake outdated chapter 4 screenshots against the local dev API. Read-only: dialogs are opened, nothing is saved.
import { createRequire } from 'node:module';
const require = createRequire('D:/huit/nosql/Source/warranty-system/warranty-system-soopi/frontend-react/package.json');
const { chromium } = require('playwright-core');
const [out, staffPassword] = process.argv.slice(2);
const base = 'http://127.0.0.1:5173';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const hide = '.chat-fab, [data-chat-launcher], .chat-launcher { display: none !important; }';

async function session(user, password, landing) {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' })).newPage();
  page.setDefaultTimeout(15000);
  await page.goto(base + '/login');
  await page.getByPlaceholder('VD: 0912345678 hoặc ten@gmail.com').fill(user);
  await page.getByPlaceholder('Nhập mật khẩu của bạn').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  const choice = page.locator('[data-role-choice-list] .role-choice');
  await Promise.race([page.waitForURL(base + landing), choice.first().waitFor()]);
  if (await choice.count()) await choice.filter({ hasText: /Tiếp nhận|Lễ tân/ }).first().click();
  await page.waitForURL(base + landing);
  return page;
}
const settle = page => page.waitForLoadState('networkidle').then(() => page.waitForTimeout(900));
async function open(page, url, height = 900) {
  await page.setViewportSize({ width: 1440, height });
  await page.goto(base + url); await page.reload(); await settle(page);
  await page.addStyleTag({ content: hide });
  await page.mouse.move(5, 5);
}
// Union of the cards that contain the given headings, captured in one clip.
async function cards(page, headings, path) {
  // Each card is captured on its own (the page scrolls inside its own container); Python stacks them afterwards.
  let k = 0;
  for (const h of headings) {
    const card = page.locator('section.card, div.card').filter({ has: page.getByText(h, { exact: true }) }).last();
    await card.scrollIntoViewIfNeeded();
    await card.screenshot({ path: path.replace('.png', `_${k++}.png`) });
  }
}

try {
  if (!process.env.SKIP_ADMIN) {
  const admin = await session('admin', 'admin123', '/admin');
  await open(admin, '/admin#accounts', 1350);
  await admin.screenshot({ path: `${out}/f14.png` });
  await open(admin, '/admin#accounts');
  await admin.getByRole('button', { name: /Thêm nhân viên/ }).click(); await admin.waitForTimeout(700); await admin.mouse.move(5, 5);
  await admin.screenshot({ path: `${out}/f15.png` });
  await open(admin, '/admin#accounts');
  await admin.locator('[data-page-panel="accounts"] table tbody tr').first().click(); await admin.waitForTimeout(800); await admin.mouse.move(5, 5);
  await admin.screenshot({ path: `${out}/f16.png` });
  await open(admin, '/admin#customers', 1350);
  await admin.screenshot({ path: `${out}/f17.png` });
  await open(admin, '/admin#reports', 1400);
  await admin.getByRole('tab', { name: 'Đánh giá' }).click(); await settle(admin);
  await admin.locator('#report-panel-reviews').screenshot({ path: `${out}/f13.png` });
  }

  const reception = await session('letan', staffPassword, '/receptionist');
  await open(reception, '/receptionist', 2600);
  await cards(reception, ['Người gửi máy lần này', 'Thông tin thiết bị'], `${out}/f24.png`);
  await cards(reception, ['Xác nhận tình trạng bảo hành', 'Lỗi khách báo', 'Kiểm tra ngoại quan', 'Khách xác nhận báo giá tại quầy'], `${out}/f25.png`);

  const dispatch = await session('dieuphoi', staffPassword, '/dispatch');
  await open(dispatch, '/reports#sla');
  await dispatch.screenshot({ path: `${out}/f31.png` });
  await open(dispatch, '/reports#performance');
  await dispatch.screenshot({ path: `${out}/f32.png` });
} finally {
  await browser.close();
}
