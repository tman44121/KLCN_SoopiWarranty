// Giới hạn số phiếu của KTV: modal "Sửa phân công", ô số phiếu khi tạo nhân viên, lỗi 409 ở màn điều phối.
// Mọi API đều giả; không ghi DB.
import assert from 'node:assert/strict';
import { browser, session, login } from './smoke.mjs';

const base = process.env.E2E_BASE_URL || 'http://localhost:5173';
const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
const tech = { employeeId: 'NV-KTV', username: 'ktv', fullName: 'Trần Kỹ Thuật', phone: '0900000001',
  roles: [{ code: 'TECHNICIAN', label: 'Kỹ thuật viên' }], accountStatus: 'ACTIVE', lastLoginAt: null, maxActiveTickets: 10, onSite: true };
const cashier = { ...tech, employeeId: 'NV-TN', username: 'tn', fullName: 'Lê Thu Ngân', roles: [{ code: 'CASHIER', label: 'Thu ngân' }] };
let checks = 0;
try {
  for (const width of [1440, 390]) {
    const s = await session('ADMIN', '/admin', width);
    s.user.username = 'admin'; s.user.isRootAdmin = true;
    const writes = [];
    await s.context.route('**/api/v1/admin/employees**', async route => {
      const r = route.request();
      if (r.method() === 'GET') return route.fulfill(json([tech, cashier]));
      const body = r.postDataJSON(); writes.push({ method: r.method(), url: r.url(), body });
      await route.fulfill(json(r.method() === 'POST' ? { employee: { ...tech, employeeId: 'NV-NEW' }, temporaryPassword: 'Tmp-mock' } : { ...tech, ...body }));
    });
    await login(s.page);
    await s.page.waitForURL(base + '/admin');
    const p = s.page;

    // Nhân viên không phải KTV: không có nút Sửa phân công, không có dòng số phiếu.
    await p.locator('[data-row-open="NV-TN"]').click();
    await p.locator('[data-emp-modal]:not([hidden])').waitFor();
    assert.equal(await p.locator('[data-emp-action="work"]').count(), 0); checks++;
    assert.equal(await p.getByText('Số phiếu tối đa', { exact: true }).locator('visible=true').count(), 0); checks++;
    await p.locator('[data-emp-modal-close]').click();

    // KTV: chi tiết hiện số phiếu; Sửa phân công điền sẵn giá trị hiện tại.
    await p.locator('[data-row-open="NV-KTV"]').click();
    await p.locator('[data-emp-modal]').getByText('10 phiếu', { exact: true }).waitFor(); checks++;
    await p.locator('[data-emp-action="work"]').click();
    await p.locator('[data-edit-work-modal]:not([hidden])').waitFor();
    assert.equal(await p.locator('[data-edit-work-max]').inputValue(), '10'); checks++;
    assert.equal(await p.locator('[data-edit-work-onsite]').isChecked(), true); checks++;

    // 31 → lỗi tại ô, focus về ô, không gọi API.
    await p.locator('[data-edit-work-max]').fill('31');
    await p.locator('[data-edit-work-save]').click();
    assert.equal(await p.locator('[data-edit-work-max-error]').isVisible(), true); checks++;
    assert.equal(await p.locator('[data-edit-work-max]').getAttribute('aria-invalid'), ''); checks++;
    assert.equal(await p.evaluate(() => document.activeElement?.hasAttribute('data-edit-work-max')), true); checks++;
    assert.equal(writes.length, 0); checks++;

    // 15 + bỏ có mặt → PATCH đúng body, đóng modal, toast.
    await p.locator('[data-edit-work-max]').fill('15');
    await p.locator('[data-edit-work-onsite]').uncheck();
    await p.locator('[data-edit-work-save]').click();
    await p.locator('[data-edit-work-modal]').waitFor({ state: 'hidden' });
    assert.equal(writes.length, 1); checks++;
    assert.equal(writes[0].method, 'PATCH'); checks++;
    assert.match(writes[0].url, /\/admin\/employees\/NV-KTV$/); checks++;
    assert.deepEqual(writes[0].body, { maxActiveTickets: 15, onSite: false }); checks++;
    await p.getByText('Đã cập nhật phân công của Trần Kỹ Thuật.').waitFor(); checks++;

    // Esc đóng modal Sửa phân công.
    await p.locator('[data-row-open="NV-KTV"]').click();
    await p.locator('[data-emp-action="work"]').click();
    await p.locator('[data-edit-work-modal]:not([hidden])').waitFor();
    await p.keyboard.press('Escape');
    await p.locator('[data-edit-work-modal]').waitFor({ state: 'hidden' }); checks++;

    // Tạo nhân viên: mặc định 10, 0 bị chặn, 12 gửi lên API.
    await p.locator('[data-open-add-employee]').click();
    assert.equal(await p.locator('[data-add-emp-max]').inputValue(), '10'); checks++;
    await p.locator('[data-add-emp-name]').fill('Nguyễn Mới');
    await p.locator('[data-add-emp-username]').fill('nguyenmoi');
    await p.locator('[data-add-emp-phone]').fill('0900000009');
    await p.locator('[data-add-emp-roles] input[value="TECHNICIAN"]').check();
    await p.locator('[data-add-emp-max]').fill('0');
    await p.locator('[data-add-employee-submit]').click();
    await p.getByRole('status').getByText('Số phiếu tối đa phải từ 1 đến 30.').waitFor(); checks++;
    assert.equal(writes.length, 1); checks++;
    await p.locator('[data-add-emp-max]').fill('12');
    await p.locator('[data-add-employee-submit]').click();
    await p.locator('[data-add-employee-drawer]').waitFor({ state: 'hidden' });
    assert.equal(writes[1].method, 'POST'); checks++;
    assert.equal(writes[1].body.maxActiveTickets, 12); checks++;

    assert.deepEqual(s.errors, []); checks++;
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); checks++;
    await s.context.close();
    console.log(`PASS ticket limit admin UI ${width}px`);
  }

  // Điều phối: API từ chối 409 TECHNICIAN_OVERLOADED (vd hai người giao cùng lúc) → hiện đúng thông báo.
  const s = await session('DISPATCHER', '/dispatch', 1440);
  const ticket = { code: 'TN-2026-1125-00001', status: 'RECEIVED', receivedAt: '2026-11-25T02:00:00Z', requestType: 'WARRANTY', priority: 'NORMAL',
    sla: { level: 'STANDARD_48H', dueAt: '2026-11-27T02:00:00Z' }, device: { deviceTypeName: 'Điện thoại', productName: 'Galaxy S24', serialOrImei: '356000000000001' },
    customer: { fullName: 'Nguyễn Văn Khách', phone: '0900000000' }, assignment: null };
  const detail = 'Kỹ thuật viên đang xử lý 10/10 phiếu — đã đủ số phiếu tối đa, không thể giao thêm.';
  await s.context.route('**/api/v1/tickets/open**', r => r.fulfill(json([ticket])));
  await s.context.route('**/api/v1/technicians/workload**', r => r.fulfill(json([])));
  await s.context.route('**/api/v1/tickets/*/assignment-candidates', r => r.fulfill(json([{ technicianId: 'NV-KTV', fullName: 'Trần Kỹ Thuật',
    skills: [], activeTickets: 9, maxActiveTickets: 10, atRiskSla: 0, onSite: true, overloaded: false, skillMatch: true, reason: null }])));
  await s.context.route('**/api/v1/tickets/*/assignment', r => r.fulfill({ status: 409, contentType: 'application/problem+json',
    body: JSON.stringify({ status: 409, code: 'TECHNICIAN_OVERLOADED', detail, title: 'Conflict' }) }));
  await login(s.page);
  await s.page.waitForURL(base + '/dispatch');
  await s.page.locator(`[data-open-assign="${ticket.code}"]`).click();
  await s.page.locator('[data-candidate="NV-KTV"] input').check();
  await s.page.locator('[data-assign-modal] button:has-text("Xác nhận giao việc")').click();
  await s.page.getByText(detail).first().waitFor(); checks++;
  await s.context.close();
  console.log('PASS dispatch shows TECHNICIAN_OVERLOADED');
  console.log(`PASS: ${checks} ticket limit UI checks; no live writes`);
} finally { await browser.close(); }
