// Chụp toàn bộ màn hình và luồng nghiệp vụ trên API + database THẬT (ghi dữ liệu vào DB đang cấu hình).
// Chạy khi API (8080) và Vite (5173) đang chạy: node scripts/screenshots.mjs [giai-doan...]
// Ảnh lưu vào docs/screenshots/, trạng thái giữa các giai đoạn (mã phiếu…) ở test-results/screenshots-state.json.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../../../warranty-system-mysql/e2e/package.json', import.meta.url));
const { chromium } = require('playwright-core');

export const base = process.env.E2E_BASE_URL || 'http://localhost:5173';
const out = new URL('../../docs/screenshots/', import.meta.url);
const stateFile = new URL('../test-results/screenshots-state.json', import.meta.url);
mkdirSync(out, { recursive: true });
mkdirSync(new URL('../test-results/', import.meta.url), { recursive: true });
export const state = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : {};
export const save = () => writeFileSync(stateFile, JSON.stringify(state, null, 2));

export const browser = await chromium.launch({ channel: 'msedge', headless: true });

export async function open(width = 1440) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' });
  const page = await context.newPage();
  page.on('pageerror', (error) => console.log('  [pageerror]', error.message));
  page.on('response', async (response) => {
    if (response.url().includes('/api/') && response.request().method() !== 'GET' && process.env.DEBUG_API)
      console.log('  [api]', response.request().method(), new URL(response.url()).pathname, response.status(), (await response.text().catch(() => '')).slice(0, 300));
  });
  return { context, page };
}

/** Chụp cả trang: kéo cao viewport bằng chiều cao nội dung để header/sidebar cố định của màn nội bộ nằm đúng chỗ. */
export async function shot(page, name, fullPage = true) {
  await page.waitForTimeout(400); // chờ hiệu ứng chuyển màu/toast ổn định
  const size = page.viewportSize();
  if (fullPage) {
    const height = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight));
    await page.setViewportSize({ width: size.width, height: Math.min(Math.max(height, size.height), 8000) });
    await page.waitForTimeout(150);
  }
  name = name.replace(/^\d+/, (n) => n.padStart(3, '0')); // 001…147 để thư mục xếp đúng thứ tự
  await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, out)) });
  if (fullPage) await page.setViewportSize(size);
  console.log('  ✓', name);
}

/** Lỗi đang hiện trên trang (toast, lỗi trường) — in ra khi một bước không thành công. */
export async function visibleErrors(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll('.toast, [role="alert"], .form-field__error, .auth-card__error'))
    .filter((el) => el.offsetParent !== null && el.textContent.trim()).map((el) => el.textContent.trim()));
}

export async function login(page, username, password, expectPath) {
  await page.goto(base + '/login');
  await page.fill('#login-username', username);
  await page.fill('#login-password', password);
  await page.click('[data-login-form] button[type="submit"]');
  if (expectPath) await page.waitForURL((url) => url.pathname === expectPath, { timeout: 20000 });
  await page.waitForLoadState('networkidle');
}

export async function settled(page) {
  await page.waitForFunction(() => !document.body.hasAttribute('aria-busy'));
  await page.waitForLoadState('networkidle');
}

const stages = {};
export const stage = (name, fn) => { stages[name] = fn; };

/* ------------------------------------------------------------------ 1. Công khai */
stage('public', async () => {
  const { context, page } = await open();
  await page.goto(base + '/login');
  await page.waitForLoadState('networkidle');
  await shot(page, '01-dang-nhap', false);
  await page.click('[data-login-form] button[type="submit"]');
  await shot(page, '02-dang-nhap-thieu-thong-tin', false);
  await page.goto(base + '/register');
  await page.waitForLoadState('networkidle');
  await shot(page, '03-dang-ky', false);
  await page.click('form button[type="submit"]');
  await shot(page, '04-dang-ky-bao-loi', false);
  await page.goto(base + '/portal');
  await page.waitForLoadState('networkidle');
  await shot(page, '05-tra-cuu-cong-khai');
  await page.locator('.nav-menu').getByRole('link', { name: 'Gửi yêu cầu bảo hành' }).click();
  await page.locator('[data-register-section]').waitFor({ state: 'visible' });
  await shot(page, '06-tra-cuu-form-yeu-cau-cong-khai');
  await context.close();
});

/* ------------------------------------------------------------------ 2. Lễ tân tiếp nhận */
stage('intake', async () => {
  const { context, page } = await open();
  await login(page, 'tiepnhan.an', '1234', '/receptionist');
  await settled(page);
  await shot(page, '10-le-tan-man-tiep-nhan');
  await page.fill('#phone', '0912223001');
  await page.click('[data-customer-lookup]');
  await page.waitForLoadState('networkidle');
  await page.locator('[data-device-category] [data-value]', { hasText: 'Điện thoại' }).click();
  await page.locator('[data-device-type] [data-value]').first().click();
  await page.locator('[data-product-choices] [data-value]').first().click();
  state.imei = '35' + String(Date.now()).slice(-13);
  await page.fill('#identifier', state.imei);
  await page.locator('#identifier').blur();
  await page.waitForLoadState('networkidle');
  await page.fill('#symptom', 'Màn hình chớp tắt và có sọc xanh sau khi rơi, cảm ứng lúc được lúc không.');
  for (const [group, value] of [['scratches', 'LIGHT'], ['dents', 'false'], ['cracks', 'false'], ['moisture', 'NONE'], ['accessories', 'COMPLETE']]) {
    await page.locator(`[data-cosmetic="${group}"] [data-value="${value}"]`).click();
  }
  await page.check('#ack');
  await shot(page, '11-le-tan-dien-phieu');
  await page.click('[data-submit-intake]');
  await page.locator('[data-result-section]').waitFor({ state: 'visible', timeout: 20000 })
    .catch(async (error) => { console.log('  lỗi:', await visibleErrors(page)); throw error; });
  state.ticket = (await page.locator('[data-created-ticket-id]').textContent()).trim();
  save();
  await shot(page, '12-le-tan-tao-phieu-thanh-cong');
  console.log('  phiếu:', state.ticket);
  await context.close();
});

/* ------------------------------------------------------------------ 3. Điều phối phân công */
stage('assign', async () => {
  const { context, page } = await open();
  await login(page, 'dieuphoi', '1234', '/dispatch');
  await settled(page);
  await page.locator(`[data-toggle-detail="${state.ticket}"]`).waitFor();
  await shot(page, '20-dieu-phoi-danh-sach-phieu');
  await page.click(`[data-toggle-detail="${state.ticket}"]`);
  await shot(page, '21-dieu-phoi-chi-tiet-phieu');
  await page.click(`[data-open-assign="${state.ticket}"]`);
  const candidate = page.locator('[data-candidate]:not(.is-disabled)').first();
  await candidate.waitFor();
  await shot(page, '22-dieu-phoi-chon-ky-thuat-vien', false);
  state.technician = await candidate.getAttribute('data-candidate');
  await candidate.locator('input').check();
  await page.click('[data-confirm-assign]');
  await page.locator('[data-assign-modal]').waitFor({ state: 'hidden', timeout: 20000 })
    .catch(async (error) => { console.log('  lỗi:', await visibleErrors(page)); throw error; });
  save();
  await settled(page);
  await shot(page, '23-dieu-phoi-da-phan-cong');
  console.log('  kỹ thuật viên:', state.technician);
  await context.close();
});

/** Chờ một bước ghi xong: phần tử mục tiêu xuất hiện, hoặc in lỗi đang hiện rồi dừng. */
export async function until(page, selector, options = {}) {
  await page.locator(selector).first().waitFor({ timeout: 20000, ...options })
    .catch(async (error) => { console.log('  lỗi:', await visibleErrors(page)); throw error; });
}

const inDays = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

/* ------------------------------------------------------------------ 4. Kỹ thuật chẩn đoán + báo giá */
stage('diagnose', async () => {
  const { context, page } = await open();
  await login(page, state.technician, '1234', '/technician');
  await settled(page);
  await shot(page, '30-ky-thuat-hang-doi');
  await page.click(`[data-ticket-id="${state.ticket}"]`);
  await until(page, '[data-save-inspection], [data-edit-inspection]');
  await shot(page, '31-ky-thuat-mo-phieu');
  // Phiếu đã chẩn đoán (chạy lại): mở lại form bằng "Sửa lại phân loại".
  if (await page.locator('[data-edit-inspection]').count()) {
    await page.click('[data-edit-inspection]');
    await until(page, '[data-save-inspection]');
  }
  await page.fill('[data-insp="findings"]', 'Màn hình OLED hỏng do va đập, mainboard và pin hoạt động bình thường.');
  const items = page.locator('[data-check-index]');
  for (let i = 0; i < await items.count(); i++) {
    const label = await page.locator(`[data-check-index="${i}"]`).innerText();
    await page.locator(`[data-check-index="${i}"] [data-check-result="${/màn hình/i.test(label) ? 'FAIL' : 'PASS'}"]`).click();
  }
  await page.click('[data-classification="OUT_OF_WARRANTY"]');
  await page.fill('[data-insp="outOfWarrantyReason"]', 'Thiết bị chưa kích hoạt bảo hành và có dấu hiệu rơi vỡ.');
  await page.fill('[data-insp="proposedFix"]', 'Thay cụm màn hình chính hãng.');
  if (await page.locator('[data-insp="reclassNote"]').count())
    await page.fill('[data-insp="reclassNote"]', 'Cập nhật checklist: lỗi nằm ở màn hình.');
  await shot(page, '32-ky-thuat-nhap-chan-doan');
  await page.click('[data-save-inspection]');
  await until(page, '[data-submit-quote]');
  await settled(page);
  await shot(page, '33-ky-thuat-da-chan-doan-form-bao-gia');
  // Linh kiện và bảng giá công đúng loại điện thoại.
  const sku = page.locator('[data-quote-line="0"] [data-q="sku"]');
  const options = await sku.locator('option').evaluateAll((list) => list.map((o) => ({ value: o.value, text: o.textContent })));
  const part = options.find((o) => o.value && /màn hình|galaxy|samsung|điện thoại/i.test(o.text)) || options.find((o) => o.value);
  await sku.selectOption(part.value);
  const service = page.locator('[data-quote-service]');
  const services = await service.locator('option').evaluateAll((list) => list.map((o) => ({ value: o.value, text: o.textContent })));
  const phoneService = services.find((o) => o.value && /điện thoại|smartphone/i.test(o.text));
  if (phoneService) await service.selectOption(phoneService.value);
  await page.fill('[data-quote-valid]', inDays(7));
  await shot(page, '34-ky-thuat-lap-bao-gia');
  await page.click('[data-submit-quote]');
  await page.waitForFunction(() => !document.querySelector('[data-submit-quote]'), null, { timeout: 20000 })
    .catch(async (error) => { console.log('  lỗi:', await visibleErrors(page)); throw error; });
  await settled(page);
  await shot(page, '35-ky-thuat-da-gui-bao-gia');
  await context.close();
});

/** Mã báo giá đang hoạt động của phiếu (đọc qua API bằng phiên trong trang). */
async function activeQuotation(page) {
  return page.evaluate(async (code) => (await window.LML_API.tickets.get(code)).activeQuotationCode, state.ticket);
}

/* ------------------------------------------------------------------ 5. Điều phối duyệt báo giá */
stage('approve', async () => {
  const { context, page } = await open();
  await login(page, 'dieuphoi', '1234', '/dispatch');
  await settled(page);
  state.quotation = await activeQuotation(page);
  save();
  const view = page.locator(`[data-view-quotation="${state.quotation}"]`);
  await view.scrollIntoViewIfNeeded();
  await shot(page, '40-dieu-phoi-bao-gia-cho-duyet');
  await view.click();
  await until(page, '[data-quotation-approve]', { state: 'visible' });
  await page.fill('[data-quotation-dispatch-note]', 'Giá linh kiện hợp lý, chuyển khách xác nhận.');
  await shot(page, '41-dieu-phoi-xem-bao-gia', false);
  await page.click('[data-quotation-approve]');
  await page.locator('[data-quotation-drawer]').waitFor({ state: 'hidden', timeout: 20000 })
    .catch(async (error) => { console.log('  lỗi:', await visibleErrors(page)); throw error; });
  await settled(page);
  await shot(page, '42-dieu-phoi-da-duyet-bao-gia');
  await context.close();
});

/* ------------------------------------------------------------------ 6. Khách hàng */
stage('customer', async () => {
  for (const width of [1440, 390]) {
    const { context, page } = await open(width);
    const suffix = width === 390 ? '-mobile' : '';
    await login(page, 'kh.tuan', '1234', '/account');
    await page.getByRole('heading', { name: /Xin chào/ }).waitFor();
    await settled(page);
    await shot(page, `50-khach-trang-chu${suffix}`);
    if (width === 390) { await context.close(); continue; }
    await page.click('.user-profile-trigger');
    await shot(page, '51-khach-menu-tai-khoan', false);
    await page.keyboard.press('Escape');
    await page.goto(base + '/account#lich-su');
    await page.locator('.ticket-card-box').first().waitFor();
    await shot(page, '52-khach-lich-su');
    await page.goto(base + `/account#phieu/${state.ticket}`);
    await page.getByRole('button', { name: 'Đồng ý báo giá' }).waitFor();
    await shot(page, '53-khach-chi-tiet-phieu-bao-gia');
    await page.getByRole('button', { name: 'Đồng ý báo giá' }).click();
    await page.locator('.quote-card').waitFor({ state: 'detached', timeout: 20000 })
      .catch(async (error) => { console.log('  lỗi:', await visibleErrors(page)); throw error; });
    await shot(page, '54-khach-da-dong-y-bao-gia');
    await page.goto(base + '/account#ho-so');
    await page.locator('#pf-email').waitFor();
    await shot(page, '55-khach-ho-so-thiet-bi');
    await page.goto(base + '/account#doi-mat-khau');
    await page.locator('#pw-current').waitFor();
    await shot(page, '56-khach-doi-mat-khau');
    await context.close();
  }
});

/* ------------------------------------------------------------------ 6b. Khách gửi yêu cầu bảo hành trực tuyến */
stage('request', async () => {
  const { context, page } = await open();
  await login(page, 'kh.tuan', '1234', '/account');
  await page.goto(base + '/account#yeu-cau-moi');
  await page.waitForSelector('#req-category option:nth-child(2)', { state: 'attached' });
  await page.selectOption('#req-category', 'LAPTOP_TABLET');
  await page.fill('#req-brand-model', 'Samsung Galaxy Tab S9');
  await page.fill('#req-serial', 'R54W' + String(Date.now()).slice(-8));
  await page.fill('#req-symptom', 'Máy sạc không vào pin, cắm sạc báo lỗi nhiệt độ.');
  await page.selectOption('#req-station', { index: 1 });
  await page.fill('#req-time', new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 11) + '09:30');
  await shot(page, '57-khach-gui-yeu-cau');
  await page.click('form.form-card-panel button[type="submit"]');
  await until(page, '.kh-alert--success');
  state.request = (await page.locator('.kh-alert--success .mono').textContent()).trim();
  save();
  await shot(page, '58-khach-gui-yeu-cau-thanh-cong');
  await context.close();
});

/* ------------------------------------------------------------------ 7. Kỹ thuật yêu cầu linh kiện */
stage('parts', async () => {
  const { context, page } = await open();
  await login(page, state.technician, '1234', '/technician');
  await settled(page);
  await page.click(`[data-ticket-id="${state.ticket}"]`);
  await until(page, '[data-request-quote-parts]');
  await shot(page, '60-ky-thuat-khach-da-dong-y');
  await page.click('[data-request-quote-parts]');
  await page.waitForFunction(() => !document.querySelector('[data-request-quote-parts]'), null, { timeout: 20000 })
    .catch(async (error) => { console.log('  lỗi:', await visibleErrors(page)); throw error; });
  await settled(page);
  await shot(page, '61-ky-thuat-da-yeu-cau-linh-kien');
  await context.close();
});

/* ------------------------------------------------------------------ 8. Kho duyệt xuất */
stage('warehouse', async () => {
  const { context, page } = await open();
  await login(page, 'khovattu', '1234', '/warehouse');
  await settled(page);
  for (const [tab, name] of [['inventory', '70-kho-ton-kho'], ['stockin', '71-kho-nhap-kho'], ['transfer', '72-kho-dieu-chuyen'], ['stockout', '73-kho-xuat-kho']]) {
    await page.goto(base + '/warehouse#' + tab);
    await page.locator(`[data-page-panel="${tab}"]`).waitFor({ state: 'visible' });
    await settled(page);
    await shot(page, name);
  }
  const issue = await page.evaluate((ticket) => Array.from(document.querySelectorAll('[data-stockout-list] [data-view-issue]'))
    .find((button) => button.parentElement.closest('[data-stockout-list] > *').textContent.includes(ticket)).getAttribute('data-view-issue'), state.ticket);
  await page.click(`[data-view-issue="${issue}"]`);
  await until(page, '[data-stockout-approve]', { state: 'visible' });
  await shot(page, '74-kho-xem-phieu-xuat', false);
  await page.click('[data-stockout-approve]');
  await page.locator('[data-stockout-drawer]').waitFor({ state: 'hidden', timeout: 20000 })
    .catch(async (error) => { console.log('  lỗi:', await visibleErrors(page)); throw error; });
  await settled(page);
  await shot(page, '75-kho-da-duyet-xuat');
  await context.close();
});

/* ------------------------------------------------------------------ 9. Kỹ thuật sửa chữa + QC */
stage('repair', async () => {
  const { context, page } = await open();
  await login(page, state.technician, '1234', '/technician');
  await settled(page);
  await page.click(`[data-ticket-id="${state.ticket}"]`);
  await until(page, '[data-parts-ready], [data-start-repair], [data-submit-qc]');
  await shot(page, '80-ky-thuat-da-co-linh-kien');
  for (const action of ['[data-parts-ready]', '[data-start-repair]']) {
    if (await page.locator(action).count()) {
      await page.click(action);
      await until(page, '[data-submit-qc]');
    }
  }
  await settled(page);
  await page.fill('[data-qc-work]', 'Thay cụm màn hình mới, kiểm tra cảm ứng đa điểm, độ sáng và màu hiển thị.');
  const steps = await page.locator('[data-qc-step][data-qc-value="PASS"]').evaluateAll((list) => list.map((b) => b.getAttribute('data-qc-step')));
  for (const step of steps) await page.click(`[data-qc-step="${step}"][data-qc-value="PASS"]`);
  await page.fill('[data-qc-details]', 'Chạy thử 30 phút, không còn chớp tắt.');
  await shot(page, '81-ky-thuat-nhap-ket-qua-qc');
  await page.click('[data-submit-qc]');
  await page.waitForFunction(() => !document.querySelector('[data-submit-qc]'), null, { timeout: 20000 })
    .catch(async (error) => { console.log('  lỗi:', await visibleErrors(page)); throw error; });
  await settled(page);
  await shot(page, '82-ky-thuat-hoan-tat-sua-chua');
  await context.close();
});

/* ------------------------------------------------------------------ 10. Thu ngân + bàn giao */
stage('cashier', async () => {
  const { context, page } = await open();
  await login(page, 'thungan.nhu', '1234', '/cashier');
  await settled(page);
  await shot(page, '90-thu-ngan-danh-sach');
  await page.click(`[data-ticket="${state.ticket}"]`);
  await until(page, '[data-complete-handover]');
  await settled(page);
  await shot(page, '91-thu-ngan-chi-tiet-thanh-toan');
  if (await page.locator('[data-confirm-payment]').count()) {
    if (await page.locator('[data-payment-method]').count()) await page.selectOption('[data-payment-method]', 'CASH');
    await page.click('[data-confirm-payment]');
    await page.waitForFunction(() => !document.querySelector('[data-confirm-payment]'), null, { timeout: 20000 })
      .catch(async (error) => { console.log('  lỗi:', await visibleErrors(page)); throw error; });
    await settled(page);
    await shot(page, '92-thu-ngan-da-thu-tien');
  }
  for (const box of await page.locator('[data-recheck]').all()) await box.check();
  await page.check('[data-customer-confirmed]');
  const canvas = await page.locator('[data-signature]').boundingBox();
  await page.mouse.move(canvas.x + 40, canvas.y + 110);
  await page.mouse.down();
  for (let i = 0; i <= 24; i++) await page.mouse.move(canvas.x + 40 + i * 14, canvas.y + 80 + Math.sin(i / 2.2) * 35, { steps: 3 });
  await page.mouse.up();
  await shot(page, '93-thu-ngan-ky-ban-giao');
  await page.click('[data-complete-handover]');
  await page.waitForFunction((code) => !document.querySelector(`[data-ticket="${code}"]`), state.ticket, { timeout: 20000 })
    .catch(async (error) => { console.log('  lỗi:', await visibleErrors(page)); throw error; });
  await settled(page);
  await shot(page, '94-thu-ngan-da-ban-giao');
  await context.close();
});

/* ------------------------------------------------------------------ 11. Các màn xem/tra cứu */
async function tabs(page, path, list) {
  for (const [tab, name] of list) {
    await page.goto(base + path + '#' + tab);
    await page.locator(`[data-page-panel="${tab}"]`).waitFor({ state: 'visible' });
    await settled(page);
    await page.waitForTimeout(600); // biểu đồ vẽ xong
    await shot(page, name);
  }
}

stage('browse', async () => {
  let { context, page } = await open();
  // Tài khoản hai vai trò: màn chọn vai trò.
  await page.goto(base + '/login');
  await page.fill('#login-username', 'letan');
  await page.fill('#login-password', '1234');
  await page.click('[data-login-form] button[type="submit"]');
  await page.locator('.role-choice').first().waitFor();
  await shot(page, '07-dang-nhap-chon-vai-tro', false);
  await page.locator('.role-choice', { hasText: 'Tiếp nhận' }).click();
  await page.waitForURL((url) => url.pathname === '/receptionist');
  await settled(page);
  await page.locator('[data-yc-list]').scrollIntoViewIfNeeded();
  await shot(page, '13-le-tan-yeu-cau-truc-tuyen', false);
  // Phiếu sửa chữa: tìm và xem chi tiết.
  await page.goto(base + '/tickets');
  await settled(page);
  await shot(page, '100-phieu-sua-chua-danh-sach');
  await page.click(`[data-view-ticket="${state.ticket}"]`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  await shot(page, '101-phieu-sua-chua-chi-tiet', false);
  await context.close();

  ({ context, page } = await open());
  await login(page, 'dieuphoi', '1234', '/dispatch');
  await settled(page);
  await page.fill('[data-global-search]', state.ticket);
  await page.locator('[data-global-search-results]').waitFor({ state: 'visible' });
  await page.waitForLoadState('networkidle');
  await shot(page, '24-tim-kiem-nhanh', false);
  await page.keyboard.press('Escape');
  await page.click('[data-notification-bell]');
  await page.locator('[data-notification-popover]').waitFor({ state: 'visible' });
  await page.waitForLoadState('networkidle');
  await shot(page, '25-thong-bao', false);
  await tabs(page, '/reports', [['sla', '110-bao-cao-sla'], ['performance', '111-bao-cao-hieu-suat'], ['audit', '112-bao-cao-lich-su-thao-tac']]);
  await context.close();

  ({ context, page } = await open());
  await login(page, 'admin', 'admin123', '/admin');
  await settled(page);
  await tabs(page, '/admin', [['accounts', '120-quan-tri-tai-khoan'], ['catalogs', '121-quan-tri-danh-muc'], ['reports', '122-quan-tri-bao-cao']]);
  await page.goto(base + '/admin#accounts');
  await settled(page);
  await page.click('[data-open-add-employee]');
  await page.locator('[data-add-employee-drawer]').waitFor({ state: 'visible' });
  await shot(page, '123-quan-tri-them-nhan-vien', false);
  await context.close();

  // Tra cứu công khai theo mã phiếu + SĐT sau khi bàn giao.
  ({ context, page } = await open());
  await page.goto(base + '/portal');
  await page.fill('#lookupId', state.ticket);
  await page.fill('#lookupPhone', '0912223001');
  await page.click('[data-lookup-submit]');
  await page.locator('[data-lookup-result]').waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForLoadState('networkidle');
  await shot(page, '130-tra-cuu-ket-qua');
  await context.close();

  // Khách: phiếu đã bàn giao và giao diện mobile.
  ({ context, page } = await open());
  await login(page, 'kh.tuan', '1234', '/account');
  await page.goto(base + `/account#phieu/${state.ticket}`);
  await page.locator('.ticket-hero-card').waitFor();
  await page.waitForLoadState('networkidle');
  await shot(page, '59-khach-phieu-da-ban-giao');
  await context.close();
  ({ context, page } = await open(390));
  await login(page, 'kh.tuan', '1234', '/account');
  await page.getByRole('heading', { name: /Xin chào/ }).waitFor();
  await page.waitForLoadState('networkidle');
  await shot(page, '140-mobile-khach-trang-chu');
  for (const [hash, name, ready] of [['lich-su', '141-mobile-khach-lich-su', '.ticket-card-box'], [`phieu/${state.ticket}`, '142-mobile-khach-chi-tiet-phieu', '.ticket-hero-card'],
    ['yeu-cau-moi', '143-mobile-khach-gui-yeu-cau', '#req-category'], ['ho-so', '144-mobile-khach-ho-so', '#pf-email']]) {
    await page.goto(base + '/account#' + hash);
    await page.locator(ready).first().waitFor();
    await page.waitForLoadState('networkidle');
    await shot(page, name);
  }
  await context.close();
  ({ context, page } = await open(390));
  for (const [path, name] of [['/login', '145-mobile-dang-nhap'], ['/register', '146-mobile-dang-ky'], ['/portal', '147-mobile-tra-cuu']]) {
    await page.goto(base + path);
    await page.waitForLoadState('networkidle');
    await shot(page, name);
  }
  await context.close();
});

/* ------------------------------------------------------------------ chạy */
const wanted = process.argv.slice(2);
try {
  for (const name of wanted.length ? wanted : Object.keys(stages)) {
    console.log(`== ${name}`);
    await stages[name]();
  }
} finally {
  await browser.close();
}
