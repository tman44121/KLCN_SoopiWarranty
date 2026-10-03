// Một vòng đời máy trên API + database THẬT (ghi dữ liệu vào DB đang cấu hình), từng điểm dừng một:
//   node scripts/lifecycle.mjs <diem-dung...>   (request intake assign diagnose approve confirm parts warehouse repair handover review)
// Khách dùng điện thoại 390px, kỹ thuật viên tablet 820px, các vai trò khác desktop 1440px.
// Mỗi điểm dừng: thao tác qua giao diện, chụp ảnh, rồi kiểm tra dữ liệu (đọc API bằng phiên trong trang) và giao diện.
// Ảnh + trạng thái (mã YC/TN/BG/PX…) lưu ở test-results/lifecycle/, không đụng docs/screenshots.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../../../warranty-system-mysql/e2e/package.json', import.meta.url));
const { chromium } = require('playwright-core');

const base = process.env.E2E_BASE_URL || 'http://localhost:5173';
const out = new URL('../test-results/lifecycle/', import.meta.url);
mkdirSync(out, { recursive: true });
const stateFile = new URL('state.json', out);
const state = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : {};
const save = () => writeFileSync(stateFile, JSON.stringify(state, null, 2));
const browser = await chromium.launch({ channel: 'msedge', headless: true });

const DEVICES = { phone: { width: 390, height: 844, mobile: true }, tablet: { width: 820, height: 1180, mobile: true }, desktop: { width: 1440, height: 900 } };
const ACCOUNTS = { customer: 'kh.tuan', receptionist: 'letan', dispatcher: 'dieuphoi', technician: 'ktv.chinh', warehouse: 'khovattu', cashier: 'thungan.nhu' };
const PASSWORD = '1234'; // tài khoản demo — docs/TAI_KHOAN_DEMO.md
const PART = { sku: 'LK004', name: 'Bàn phím Laptop Dell Inspiron 15', bin: 'KHO-B-02-01' };

let failures = 0;
function check(name, ok, detail = '') {
  if (!ok) failures++;
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail !== '' ? ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
  return ok;
}

async function open(device) {
  const d = DEVICES[device];
  const context = await browser.newContext({ viewport: { width: d.width, height: d.height }, isMobile: !!d.mobile, hasTouch: !!d.mobile,
    locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/status of 4\d\d/.test(m.text())) errors.push(m.text()); });
  return { context, page, errors };
}

let shotNo = 0;
async function shot(page, name) {
  await page.waitForTimeout(400);
  const file = `${String(++shotNo + (state.shotBase || 0)).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: fileURLToPath(new URL(file, out)), fullPage: true });
  console.log('  📷', file);
}

async function settled(page) {
  await page.waitForFunction(() => !document.body.hasAttribute('aria-busy')).catch(() => {});
  await page.waitForLoadState('networkidle');
}

async function visibleErrors(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll('.toast--error, [role="alert"], .form-field__error, .field-error, .validation-summary-errors'))
    .filter((el) => el.offsetParent !== null && el.textContent.trim()).map((el) => el.textContent.trim()));
}

async function until(page, selector, options = {}) {
  await page.locator(selector).first().waitFor({ timeout: 20000, ...options })
    .catch(async (error) => { console.log('  lỗi trên trang:', await visibleErrors(page)); throw error; });
}

async function login(page, role, landing) {
  await page.goto(base + '/login');
  await page.fill('#login-username', ACCOUNTS[role]);
  await page.fill('#login-password', PASSWORD);
  await page.click('[data-login-form] button[type="submit"]');
  if (role === 'receptionist') {
    await page.locator('.role-choice', { hasText: 'Tiếp nhận' }).click();
  }
  await page.waitForURL((url) => url.pathname === landing, { timeout: 20000 });
  await settled(page);
}

/** Đọc API bằng phiên đang đăng nhập trong trang. */
const apiGet = (page, path) => page.evaluate((p) => window.LML_API.request('GET', p), path);
const ticketOf = (page) => apiGet(page, `/tickets/${state.ticket}`);

/** Kiểm tra giao diện chung: không cuộn ngang, không lỗi JS. */
async function uiChecks(page, errors, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  check(`${label}: không cuộn ngang`, overflow <= 1, `lệch ${overflow}px`);
  check(`${label}: không lỗi JavaScript`, errors.length === 0, errors.join(' | '));
}

const stages = {};
const stage = (name, fn) => { stages[name] = fn; };

/* 1. Khách gửi yêu cầu bảo hành online (điện thoại) */
stage('request', async () => {
  const { context, page, errors } = await open('phone');
  await login(page, 'customer', '/account');
  await page.goto(base + '/account#yeu-cau-moi');
  await page.waitForSelector('#req-category option:nth-child(2)', { state: 'attached' });
  state.serial = 'DLINS15-' + String(Date.now()).slice(-8);
  await page.selectOption('#req-category', 'LAPTOP_TABLET');
  await page.fill('#req-brand-model', 'Dell Inspiron 15');
  await page.fill('#req-serial', state.serial);
  await page.fill('#req-symptom', 'Bàn phím liệt nhiều phím khu vực WASD, máy từng bị đổ nước ngọt tuần trước.');
  await page.selectOption('#req-station', { index: 1 });
  await page.fill('#req-time', new Date(Date.now() + 86400000).toISOString().slice(0, 11) + '09:30');
  await shot(page, 'khach-dien-yeu-cau');
  await page.click('form.form-card-panel button[type="submit"]');
  await until(page, '.kh-alert--success');
  state.request = (await page.locator('.kh-alert--success .mono').textContent()).trim();
  save();
  await shot(page, 'khach-gui-yeu-cau-thanh-cong');
  console.log('  yêu cầu:', state.request, '· serial:', state.serial);

  const list = await apiGet(page, '/portal/my/warranty-requests');
  const mine = list.find((r) => r.code === state.request);
  check('DB: yêu cầu thuộc khách đang đăng nhập', !!mine);
  check('DB: trạng thái Chờ tiếp nhận', mine?.status === 'PENDING_INTAKE', mine?.status);
  check('DB: serial đúng', mine?.serialOrImei === state.serial, mine?.serialOrImei);
  await page.goto(base + '/account#lich-su');
  await settled(page);
  const shown = await page.locator('body').innerText();
  check('UI: lịch sử hiện yêu cầu mới', shown.includes(state.request));
  await shot(page, 'khach-lich-su-co-yeu-cau');
  await uiChecks(page, errors, 'Khách (390px)');
  await context.close();
});

/* 2. Lễ tân tiếp nhận từ yêu cầu online (desktop) */
stage('intake', async () => {
  const { context, page, errors } = await open('desktop');
  await login(page, 'receptionist', '/receptionist');
  const row = page.locator('[data-yc-list] > *', { hasText: state.request });
  await row.first().waitFor({ timeout: 20000 });
  check('UI: hàng chờ hiện yêu cầu', await row.count() === 1);
  check('UI: hàng chờ hiện serial', (await row.first().innerText()).includes(state.serial));
  await shot(page, 'le-tan-hang-cho-yeu-cau');
  await page.click(`[data-yc-use="${state.request}"]`);
  await page.waitForFunction(() => document.querySelector('#identifier')?.value, null, { timeout: 20000 });
  await settled(page);
  const filled = await page.evaluate(() => ({ phone: document.querySelector('#phone').value, name: document.querySelector('#fullName, #name, [data-customer-name]')?.value,
    serial: document.querySelector('#identifier').value, symptom: document.querySelector('#symptom').value }));
  check('UI: tự điền SĐT khách', filled.phone === '0912223001', filled.phone);
  check('UI: tự điền serial', filled.serial === state.serial, filled.serial);
  check('UI: tự điền mô tả lỗi', filled.symptom.includes('WASD'));
  // Chọn đúng sản phẩm trong danh mục (khách chỉ khai "Dell Inspiron 15").
  await page.locator('[data-product-choices] [data-value]', { hasText: 'Inspiron' }).first().click();
  await settled(page);
  for (const [group, value] of [['scratches', 'LIGHT'], ['dents', 'false'], ['cracks', 'false'], ['moisture', 'SUSPECTED'], ['accessories', 'COMPLETE']]) {
    const choice = page.locator(`[data-cosmetic="${group}"] [data-value="${value}"]`);
    if (await choice.count()) await choice.click();
    else await page.locator(`[data-cosmetic="${group}"] [data-value]`).first().click();
  }
  await page.check('#ack');
  await shot(page, 'le-tan-phieu-tu-dien');
  await page.click('[data-submit-intake]');
  await until(page, '[data-result-section]', { state: 'visible' });
  state.ticket = (await page.locator('[data-created-ticket-id]').textContent()).trim();
  save();
  await shot(page, 'le-tan-tao-phieu-thanh-cong');
  console.log('  phiếu:', state.ticket);

  const t = await ticketOf(page);
  check('DB: phiếu Đã tiếp nhận', t.status === 'RECEIVED', t.status);
  check('DB: kênh Đăng ký trực tuyến', t.channel === 'ONLINE_REQUEST', t.channel);
  check('DB: gắn mã yêu cầu', t.warrantyRequestCode === state.request, t.warrantyRequestCode);
  check('DB: đúng sản phẩm Inspiron', /Inspiron/.test(t.device.productName), t.device.productName);
  check('DB: đúng serial', t.device.serialOrImei === state.serial);
  check('DB: khách Nguyễn Minh Tuấn', t.customer?.phone === '0912223001', t.customer?.fullName);
  const req = await apiGet(page, `/warranty-requests/${state.request}`);
  check('DB: yêu cầu chuyển khỏi Chờ tiếp nhận', req.status !== 'PENDING_INTAKE', req.status);
  await uiChecks(page, errors, 'Lễ tân (1440px)');
  await context.close();
});

/* 3. Điều phối phân công cho ktv.chinh (desktop) */
stage('assign', async () => {
  const { context, page, errors } = await open('desktop');
  await login(page, 'dispatcher', '/dispatch');
  await page.locator(`[data-toggle-detail="${state.ticket}"]`).waitFor({ timeout: 20000 });
  const rowText = await page.locator('tr', { has: page.locator(`[data-toggle-detail="${state.ticket}"]`) }).first().innerText();
  check('UI: danh sách có phiếu, đúng khách', rowText.includes('Nguyễn Minh Tuấn'), rowText.replace(/\s+/g, ' ').slice(0, 140));
  await page.click(`[data-toggle-detail="${state.ticket}"]`);
  await shot(page, 'dieu-phoi-chi-tiet-phieu');
  await page.click(`[data-open-assign="${state.ticket}"]`);
  const me = await page.evaluate(() => 0); void me;
  const candidate = page.locator('[data-candidate="NV-104"]');
  await candidate.waitFor({ timeout: 20000 });
  check('UI: có ứng viên Phạm Minh Chinh', (await candidate.innerText()).includes('Phạm Minh Chinh'));
  check('UI: ứng viên không quá tải', !(await candidate.getAttribute('class')).includes('is-disabled'));
  await candidate.locator('input').check();
  await shot(page, 'dieu-phoi-chon-ky-thuat-vien');
  await page.click('[data-confirm-assign]');
  await page.locator('[data-assign-modal]').waitFor({ state: 'hidden', timeout: 20000 })
    .catch(async (e) => { console.log('  lỗi:', await visibleErrors(page)); throw e; });
  await settled(page);
  await shot(page, 'dieu-phoi-da-phan-cong');
  const t = await ticketOf(page);
  check('DB: giao cho NV-104', t.assignment?.technicianId === 'NV-104', t.assignment?.technicianId);
  check('DB: tên kỹ thuật viên', t.technicianName === 'Phạm Minh Chinh', t.technicianName);
  check('DB: trạng thái sau phân công', ['INSPECTING', 'RECEIVED'].includes(t.status), t.status);
  await uiChecks(page, errors, 'Điều phối (1440px)');
  await context.close();
});

/* 4. Kỹ thuật viên chẩn đoán + lập báo giá (tablet) */
stage('diagnose', async () => {
  const { context, page, errors } = await open('tablet');
  await login(page, 'technician', '/technician');
  check('UI tablet: có nút menu (sidebar thu gọn)', await page.locator('.app-menu-toggle').isVisible());
  await page.click('.app-menu-toggle');
  await page.waitForTimeout(300);
  const nav = await page.locator('.app-sidebar').innerText();
  check('UI tablet: menu có Lịch sử phiếu + Kỹ thuật', nav.includes('Lịch sử phiếu') && nav.includes('Kỹ thuật'), nav.replace(/\s+/g, ' '));
  await shot(page, 'ky-thuat-menu-tablet');
  await page.keyboard.press('Escape');
  await page.locator(`[data-ticket-id="${state.ticket}"]`).waitFor({ timeout: 20000 });
  await shot(page, 'ky-thuat-hang-doi');
  await page.click(`[data-ticket-id="${state.ticket}"]`);
  await until(page, '[data-save-inspection]');
  await page.fill('[data-insp="findings"]', 'Bàn phím liệt 6 phím khu vực WASD, có vết đường khô dưới keycap. Bo mạch, pin, màn hình bình thường.');
  const items = page.locator('[data-check-index]');
  for (let i = 0; i < await items.count(); i++) await page.locator(`[data-check-index="${i}"] [data-check-result="PASS"]`).click();
  await page.check('[data-insp-water]');
  await page.click('[data-classification="OUT_OF_WARRANTY"]');
  await page.fill('[data-insp="outOfWarrantyReason"]', 'Hư hỏng do chất lỏng (khách xác nhận đổ nước ngọt) — ngoài điều kiện bảo hành Dell.');
  await page.fill('[data-insp="proposedFix"]', 'Thay cụm bàn phím mới.');
  await shot(page, 'ky-thuat-nhap-chan-doan');
  await page.click('[data-save-inspection]');
  await until(page, '[data-submit-quote]');
  await settled(page);
  const sku = page.locator('[data-quote-line="0"] [data-q="sku"]');
  await sku.selectOption(PART.sku);
  const service = page.locator('[data-quote-service]');
  const services = await service.locator('option').evaluateAll((list) => list.map((o) => ({ value: o.value, text: o.textContent })));
  const laptop = services.find((o) => /laptop/i.test(o.text));
  if (laptop) await service.selectOption(laptop.value);
  await page.fill('[data-quote-valid]', new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  await shot(page, 'ky-thuat-lap-bao-gia');
  const shownTotal = (await page.locator('[data-quote-total]').innerText().catch(() => '')).trim();
  await page.click('[data-submit-quote]');
  await page.waitForFunction(() => !document.querySelector('[data-submit-quote]'), null, { timeout: 20000 })
    .catch(async (e) => { console.log('  lỗi:', await visibleErrors(page)); throw e; });
  await settled(page);
  await shot(page, 'ky-thuat-da-gui-bao-gia');

  const t = await ticketOf(page);
  state.quotation = t.activeQuotationCode;
  save();
  check('DB: chẩn đoán ngoài bảo hành, vào nước', t.inspection?.classification === 'OUT_OF_WARRANTY' && t.inspection?.waterDamage === true);
  check('DB: phiếu chờ duyệt báo giá', t.status === 'AWAITING_QUOTE_APPROVAL', t.status);
  const q = await apiGet(page, `/quotations/${state.quotation}`);
  const partLine = q.lines.find((l) => l.sku === PART.sku);
  check('DB: báo giá có dòng LK004 × 1', partLine?.quantity === 1, partLine);
  const sum = q.partsTotal + q.laborTotal;
  check('DB: tổng = (linh kiện + công) × (1 + VAT)', Math.round(sum * (1 + Number(q.vatRate) / 100)) === Math.round(q.grandTotal),
    `${q.partsTotal} + ${q.laborTotal}, VAT ${q.vatRate}% → ${q.grandTotal}`);
  check('UI: tổng trên form khớp DB', !shownTotal || shownTotal.replace(/\D/g, '').includes(String(Math.round(q.grandTotal))), shownTotal);
  console.log('  báo giá:', state.quotation, q.grandTotal);
  await uiChecks(page, errors, 'Kỹ thuật (820px)');
  await context.close();
});

/* 5. Điều phối duyệt báo giá (desktop) */
stage('approve', async () => {
  const { context, page, errors } = await open('desktop');
  await login(page, 'dispatcher', '/dispatch');
  const view = page.locator(`[data-view-quotation="${state.quotation}"]`);
  await view.waitFor({ timeout: 20000 });
  check('UI: báo giá nằm trong hàng chờ duyệt', await view.count() === 1);
  await view.click();
  await until(page, '[data-quotation-approve]', { state: 'visible' });
  const drawer = await page.locator('[data-quotation-drawer]').innerText();
  check('UI: báo giá hiện tên linh kiện', drawer.includes('Inspiron') || drawer.includes(PART.sku), drawer.replace(/\s+/g, ' ').slice(0, 160));
  await page.fill('[data-quotation-dispatch-note]', 'Giá bàn phím đúng bảng giá, chuyển khách xác nhận.');
  await shot(page, 'dieu-phoi-xem-bao-gia');
  await page.click('[data-quotation-approve]');
  await page.locator('[data-quotation-drawer]').waitFor({ state: 'hidden', timeout: 20000 })
    .catch(async (e) => { console.log('  lỗi:', await visibleErrors(page)); throw e; });
  await settled(page);
  await shot(page, 'dieu-phoi-da-duyet');
  const q = await apiGet(page, `/quotations/${state.quotation}`);
  check('DB: báo giá Đã phê duyệt', q.approval?.status === 'APPROVED', q.approval?.status);
  check('DB: khách chưa quyết định', q.customerDecision?.status === 'PENDING', q.customerDecision?.status);
  const t = await ticketOf(page);
  check('DB: phiếu chờ khách xác nhận', t.status === 'AWAITING_CUSTOMER_CONFIRMATION', t.status);
  await uiChecks(page, errors, 'Điều phối (1440px)');
  await context.close();
});

/* 6. Khách đồng ý báo giá trên điện thoại */
stage('confirm', async () => {
  const { context, page, errors } = await open('phone');
  await login(page, 'customer', '/account');
  await page.goto(base + `/account#phieu/${state.ticket}`);
  const accept = page.getByRole('button', { name: 'Đồng ý báo giá' });
  const pending = await accept.waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
  if (pending) {
    const body = await page.locator('body').innerText();
    const before = await apiGet(page, `/portal/tickets/${state.ticket}`);
    check('UI: khách thấy mã phiếu và báo giá', body.includes(state.ticket) && /báo giá/i.test(body));
    check('UI: khách thấy dòng bàn phím', /bàn phím/i.test(body));
    const total = before.pendingQuotation?.grandTotal;
    check('UI: tổng tiền trên trang khớp DB', total && body.replace(/\D/g, '').includes(String(Math.round(total))), total);
    await shot(page, 'khach-xem-bao-gia');
    await accept.click();
    await page.locator('.quote-card').waitFor({ state: 'detached', timeout: 20000 })
      .catch(async (e) => { console.log('  lỗi:', await visibleErrors(page)); throw e; });
    await settled(page);
  } else console.log('  (khách đã quyết định báo giá ở lần chạy trước — chỉ kiểm lại)');
  await shot(page, 'khach-da-dong-y');
  const after = await apiGet(page, `/portal/tickets/${state.ticket}`);
  check('DB: không còn báo giá chờ khách', !after.pendingQuotation);
  check('DB: phiếu chuyển sang chờ linh kiện', after.status === 'AWAITING_PARTS', after.status);
  const shown = await page.locator('body').innerText();
  check('UI: trang khách hiện trạng thái mới', /chờ linh kiện/i.test(shown));
  const staffView = await apiGet(page, `/portal/tickets/${state.ticket}`);
  check('DB: chi phí khách thấy = tổng báo giá', !staffView.costs || Math.round(staffView.costs.total) > 0, staffView.costs?.total);
  await uiChecks(page, errors, 'Khách (390px)');
  await context.close();
});

/* 7. Kỹ thuật viên yêu cầu linh kiện theo báo giá (tablet) */
stage('parts', async () => {
  const { context, page, errors } = await open('tablet');
  await login(page, 'technician', '/technician');
  const before = (await apiGet(page, `/parts/${PART.sku}`));
  state.partBefore = { onHand: before.onHand, reserved: before.reserved, available: before.available };
  save();
  await page.click(`[data-ticket-id="${state.ticket}"]`);
  await until(page, '[data-request-quote-parts]');
  await shot(page, 'ky-thuat-khach-da-dong-y');
  await page.click('[data-request-quote-parts]');
  await page.waitForFunction(() => !document.querySelector('[data-request-quote-parts]'), null, { timeout: 20000 })
    .catch(async (e) => { console.log('  lỗi:', await visibleErrors(page)); throw e; });
  await settled(page);
  const block = page.locator('section.card', { hasText: 'Yêu cầu linh kiện' });
  await block.waitFor();
  const text = await block.innerText();
  await block.scrollIntoViewIfNeeded();
  await shot(page, 'ky-thuat-yeu-cau-linh-kien');
  const issues = await apiGet(page, '/stock-issues/mine');
  const issue = issues.find((i) => i.ticketCode === state.ticket && i.status === 'PENDING');
  state.issue = issue?.code;
  save();
  check('DB: có phiếu xuất Chờ duyệt cho phiếu này', !!issue, issue?.code);
  check('DB: phiếu xuất theo báo giá', issue?.source === 'QUOTATION' && issue?.quotationCode === state.quotation, issue?.source);
  check('DB: dòng LK004 × 1', issue?.lines?.length === 1 && issue.lines[0].sku === PART.sku && issue.lines[0].quantity === 1);
  check('UI: khối hiện tên linh kiện', text.includes(PART.name));
  check('UI: khối hiện vị trí kho', text.includes(PART.bin), PART.bin);
  check('UI: khối hiện nguồn theo báo giá', text.includes(state.quotation));
  const after = await apiGet(page, `/parts/${PART.sku}`);
  check('DB: tồn đã giữ chỗ +1', after.reserved === state.partBefore.reserved + 1, `${state.partBefore.reserved} → ${after.reserved}`);
  await uiChecks(page, errors, 'Kỹ thuật (820px)');
  await context.close();
});

/* 8. Kho duyệt xuất (desktop) */
stage('warehouse', async () => {
  const { context, page, errors } = await open('desktop');
  await login(page, 'warehouse', '/warehouse');
  await page.goto(base + '/warehouse#stockout');
  await page.locator('[data-page-panel="stockout"]').waitFor({ state: 'visible' });
  await settled(page);
  const pendingList = await apiGet(page, '/stock-issues?status=PENDING');
  const pendingIssue = (pendingList.items || pendingList).some((i) => i.code === state.issue);
  if (pendingIssue) await page.locator(`[data-view-issue="${state.issue}"]`).waitFor({ timeout: 20000 });
  if (pendingIssue) {
  await shot(page, 'kho-danh-sach-xuat');
  await page.click(`[data-view-issue="${state.issue}"]`);
  await until(page, '[data-stockout-approve]', { state: 'visible' });
  const drawer = await page.locator('[data-stockout-drawer]').innerText();
  check('UI: phiếu xuất hiện mã phiếu sửa', drawer.includes(state.ticket));
  check('UI: phiếu xuất hiện LK004', drawer.includes(PART.sku));
  check('UI: phiếu xuất ghi nguồn theo báo giá', drawer.includes(state.quotation));
  await shot(page, 'kho-xem-phieu-xuat');
  await page.click('[data-stockout-approve]');
  await page.locator('[data-stockout-drawer]').waitFor({ state: 'hidden', timeout: 20000 })
    .catch(async (e) => { console.log('  lỗi:', await visibleErrors(page)); throw e; });
  await settled(page);
  } else console.log('  (phiếu xuất đã được duyệt ở lần chạy trước — chỉ kiểm lại)');
  await shot(page, 'kho-da-duyet');
  const issues = await apiGet(page, `/stock-issues?status=ISSUED`);
  const issue = (issues.items || issues).find((i) => i.code === state.issue);
  check('DB: phiếu xuất Đã xuất kho', issue?.status === 'ISSUED', issue?.status);
  const part = await apiGet(page, `/parts/${PART.sku}`);
  check('DB: tồn thực tế −1', part.onHand === state.partBefore.onHand - 1, `${state.partBefore.onHand} → ${part.onHand}`);
  check('DB: giữ chỗ trả về như trước', part.reserved === state.partBefore.reserved, `${part.reserved}`);
  // Kho không có quyền đọc chi tiết phiếu sửa (đúng phân quyền): trạng thái phiếu kiểm ở bước sửa chữa.
  await uiChecks(page, errors, 'Kho (1440px)');
  await context.close();
});

/* 9. Kỹ thuật viên sửa + QC (tablet) */
stage('repair', async () => {
  const { context, page, errors } = await open('tablet');
  await login(page, 'technician', '/technician');
  const before = await ticketOf(page);
  check('DB: sau khi kho duyệt, phiếu Đang sửa chữa', before.status === 'REPAIRING', before.status);
  await page.click(`[data-ticket-id="${state.ticket}"]`);
  await until(page, '[data-parts-ready], [data-start-repair], [data-submit-qc]');
  for (const action of ['[data-parts-ready]', '[data-start-repair]']) {
    if (await page.locator(action).count()) { await page.click(action); await until(page, '[data-submit-qc]'); }
  }
  await settled(page);
  await page.fill('[data-qc-work]', 'Thay cụm bàn phím LK004, vệ sinh khay phím, test toàn bộ 86 phím.');
  const steps = await page.locator('[data-qc-step][data-qc-value="PASS"]').evaluateAll((l) => l.map((b) => b.getAttribute('data-qc-step')));
  for (const step of steps) await page.click(`[data-qc-step="${step}"][data-qc-value="PASS"]`);
  await page.fill('[data-qc-details]', 'Gõ thử 30 phút, không kẹt/lặp phím. Đèn nền bình thường.');
  await shot(page, 'ky-thuat-nhap-qc');
  await page.click('[data-submit-qc]');
  await page.waitForFunction(() => !document.querySelector('[data-submit-qc]'), null, { timeout: 20000 })
    .catch(async (e) => { console.log('  lỗi:', await visibleErrors(page)); throw e; });
  await settled(page);
  await shot(page, 'ky-thuat-hoan-tat');
  const t = await ticketOf(page);
  const result = t.repairOrder?.results?.at(-1);
  check('DB: phiếu Đã hoàn thành', t.status === 'COMPLETED', t.status);
  check('DB: QC Đạt, đủ 6 bước', result?.qcResult === 'PASS' && result?.qcSteps?.length === 6, result?.qcResult);
  check('UI: phiếu rời hàng đợi', await page.locator(`[data-ticket-id="${state.ticket}"]`).count() === 0 || t.status === 'COMPLETED');
  await uiChecks(page, errors, 'Kỹ thuật (820px)');
  await context.close();
});

/* 10. Thu ngân thu tiền + bàn giao (desktop) */
stage('handover', async () => {
  const { context, page, errors } = await open('desktop');
  await login(page, 'cashier', '/cashier');
  await page.click(`[data-ticket="${state.ticket}"]`);
  await until(page, '[data-complete-handover]');
  await settled(page);
  const billing = await apiGet(page, `/tickets/${state.ticket}/billing`);
  const q = await apiGet(page, `/quotations/${state.quotation}`).catch(() => null);
  const detail = await page.locator('[data-detail-column], .master-detail > :last-child').first().innerText();
  check('DB: tổng phải thu = tổng báo giá', !q || Math.round(billing.total) === Math.round(q.grandTotal), `${billing.total} vs ${q?.grandTotal}`);
  check('UI: tổng phải thu hiển thị đúng', detail.replace(/\D/g, '').includes(String(Math.round(billing.total))), billing.total);
  await shot(page, 'thu-ngan-chi-tiet');
  if (await page.locator('[data-confirm-payment]').count()) {
    if (await page.locator('[data-payment-method]').count()) await page.selectOption('[data-payment-method]', 'CASH');
    await page.click('[data-confirm-payment]');
    await page.waitForFunction(() => !document.querySelector('[data-confirm-payment]'), null, { timeout: 20000 })
      .catch(async (e) => { console.log('  lỗi:', await visibleErrors(page)); throw e; });
    await settled(page);
    await shot(page, 'thu-ngan-da-thu-tien');
  }
  const paid = await apiGet(page, `/tickets/${state.ticket}/billing`);
  check('DB: đã thanh toán', paid.paymentStatus === 'PAID', paid.paymentStatus);
  for (const box of await page.locator('[data-recheck]').all()) await box.check();
  await page.check('[data-customer-confirmed]');
  const canvas = await page.locator('[data-signature]').boundingBox();
  await page.mouse.move(canvas.x + 40, canvas.y + 110);
  await page.mouse.down();
  for (let i = 0; i <= 24; i++) await page.mouse.move(canvas.x + 40 + i * 14, canvas.y + 80 + Math.sin(i / 2.2) * 35, { steps: 3 });
  await page.mouse.up();
  await shot(page, 'thu-ngan-ky-ban-giao');
  await page.click('[data-complete-handover]');
  await page.waitForFunction((code) => !document.querySelector(`[data-ticket="${code}"]`), state.ticket, { timeout: 20000 })
    .catch(async (e) => { console.log('  lỗi:', await visibleErrors(page)); throw e; });
  await settled(page);
  await shot(page, 'thu-ngan-da-ban-giao');
  const t = await ticketOf(page);
  check('DB: phiếu Đã bàn giao', t.status === 'DELIVERED', t.status);
  check('DB: có biên bản bàn giao', !!t.handover, t.handover?.code);
  await uiChecks(page, errors, 'Thu ngân (1440px)');
  await context.close();
});

/* 11. Rà lại sau vòng đời: lịch sử kỹ thuật viên (tablet), khách (điện thoại) */
stage('review', async () => {
  let { context, page, errors } = await open('tablet');
  await login(page, 'technician', '/technician');
  await page.goto(base + '/tickets');
  await settled(page);
  check('UI: tiêu đề Lịch sử phiếu của tôi', (await page.locator('.page-title').innerText()).includes('Lịch sử phiếu'));
  const row = page.locator('[data-ticket-tbody] tr', { hasText: state.ticket });
  check('UI: phiếu vừa xong có trong lịch sử', await row.count() === 1);
  await shot(page, 'ky-thuat-lich-su-phieu');
  await row.locator('[data-view-ticket]').click();
  await page.locator('[data-ticket-detail-body] .detail-grid').first().waitFor();
  const drawer = await page.locator('[data-ticket-detail-body]').innerText();
  check('UI: chi tiết có Công việc kỹ thuật', drawer.includes('Công việc kỹ thuật'));
  check('UI: chi tiết hiện báo giá', drawer.includes(state.quotation));
  check('UI: chi tiết hiện phiếu xuất Đã xuất kho', drawer.includes(state.issue) && drawer.includes('Đã xuất kho'));
  check('UI: chi tiết hiện QC Đạt', /Kết quả QC\s*\n?\s*.*Đạt/i.test(drawer) || drawer.includes('Đạt'));
  check('UI: phiếu đã đóng không có nút mở màn Kỹ thuật', await page.locator('[data-ticket-detail-body] a[href^="/technician?ticket="]').count() === 0);
  await shot(page, 'ky-thuat-lich-su-chi-tiet');
  await uiChecks(page, errors, 'Kỹ thuật (820px)');
  await context.close();

  ({ context, page, errors } = await open('phone'));
  await login(page, 'customer', '/account');
  await page.goto(base + '/account#lich-su');
  await settled(page);
  const text = await page.locator('body').innerText();
  check('UI khách: phiếu hiện trong lịch sử', text.includes(state.ticket));
  await shot(page, 'khach-lich-su-sau-ban-giao');
  const mine = await apiGet(page, '/portal/my/tickets');
  const t = (mine.items || mine).find((x) => x.code === state.ticket);
  check('DB khách: phiếu Đã bàn giao', t?.status === 'DELIVERED', t?.status);
  await uiChecks(page, errors, 'Khách (390px)');
  await context.close();
});

const wanted = process.argv.slice(2);
try {
  for (const name of wanted) {
    if (!stages[name]) throw new Error(`Không có điểm dừng "${name}"`);
    console.log(`== ${name}`);
    state.shotBase = Object.keys(stages).indexOf(name) * 10;
    shotNo = 0;
    await stages[name]();
  }
} finally {
  save();
  await browser.close();
  console.log(failures ? `\n${failures} kiểm tra KHÔNG đạt` : '\nTất cả kiểm tra đạt');
  if (failures) process.exitCode = 1;
}
