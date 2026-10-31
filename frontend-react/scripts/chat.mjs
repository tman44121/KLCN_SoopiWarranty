// Browser regression with a shared mock store for both authenticated participants; no real messages sent.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { browser, login, session } from './smoke.mjs';
const base = process.env.E2E_BASE_URL || 'http://localhost:5173';
try {
  for (const width of [1440, 375]) {
    const customer = await session('CUSTOMER', '/account', width);
    const staff = await session('TECHNICIAN', '/technician', width);
    const messages = [];
    const read = { customer: 0, staff: 0 };
    const requests = [];
    let canSend = true, conversation = false, failAfterSave = false, failDirectory = false;
    let next = 1;
    for (const [s, who, name, role] of [[customer, 'customer', 'Nguyễn Văn KTV', 'Kỹ thuật viên'], [staff, 'staff', 'Khách kiểm tra', 'Khách hàng']]) {
      await s.context.route('**/api/v1/chat/**', async route => {
        const request = route.request();
        const url = new URL(request.url());
        const path = url.pathname.replace('/api/v1/chat', '');
        if (path === '/contacts') {
          if (failDirectory && who === 'customer') return route.fulfill({ status: 503, json: { detail: 'Không thể tải danh bạ thử.' } });
          const contact = { ticketCode: 'TN-CHAT-01', staffAccountId: '10', conversationId: conversation ? '1' : null,
            name, role, productName: 'Thiết bị thử', serial: 'SERIAL-CHAT', canSend,
            unreadCount: messages.filter(m => m.who !== who && Number(m.id) > read[who]).length };
          return route.fulfill({ json: { items: url.searchParams.get('q') === 'không tìm thấy' ? [] : [contact], hasMore: false, unreadCount: contact.unreadCount } });
        }
        if (path === '/conversations') {
          assert.deepEqual(request.postDataJSON(), { ticketCode: 'TN-CHAT-01', staffAccountId: '10' });
          conversation = true;
          return route.fulfill({ json: { id: '1' } });
        }
        if (path.endsWith('/read')) {
          read[who] = Math.max(read[who], Number(request.postDataJSON().lastMessageId));
          return route.fulfill({ status: 204 });
        }
        if (request.method() === 'POST') {
          const body = request.postDataJSON(); requests.push(body);
          if (!canSend) return route.fulfill({ status: 403, json: { detail: 'Không còn phụ trách phiếu.' } });
          let message = messages.find(m => m.requestId === body.requestId);
          if (!message) { message = { id: String(next++), text: body.text, requestId: body.requestId, who, createdAt: new Date().toISOString() }; messages.push(message); }
          if (failAfterSave) { failAfterSave = false; return route.abort('failed'); }
          return route.fulfill({ json: { ...message, mine: message.who === who } });
        }
        const before = Number(url.searchParams.get('before') || Number.MAX_SAFE_INTEGER);
        const after = url.searchParams.get('after');
        const rows = messages.filter(m => after === null ? Number(m.id) < before : Number(m.id) > Number(after));
        return route.fulfill({ json: { items: (after === null ? rows.slice(-50) : rows.slice(0, 50)).map(m => ({ ...m, mine: m.who === who })), hasMore: rows.length > 50, canSend } });
      });
      await login(s.page);
      await s.page.waitForURL(base + (who === 'customer' ? '/account' : '/technician'));
      await s.page.locator('header [data-chat-open]').waitFor();
      assert.equal(await s.page.locator('.chat-bubble-fab, .live-chat-root').count(), 0, 'no floating chat obscures tables');
    }
    await customer.page.getByRole('button', { name: 'Mở chat hỗ trợ', exact: true }).click();
    assert.equal(await customer.page.locator('.chat-window').getAttribute('aria-modal'), 'false');
    assert.equal(await customer.page.evaluate(() => document.body.style.overflow), '');
    await customer.page.locator('.chat-contact').filter({ hasText: 'Nguyễn Văn KTV' }).click();
    await customer.page.getByLabel('Nhập tin nhắn').fill('Khách nhắn 🌟\n<img src=x onerror=alert(1)>');
    await customer.page.getByRole('button', { name: 'Gửi tin nhắn', exact: true }).click();
    await customer.page.locator('.chat-bubble-msg').filter({ hasText: 'Khách nhắn' }).waitFor();
    assert.equal(await customer.page.locator('.chat-bubble-msg img').count(), 0);
    await staff.page.getByRole('button', { name: 'Mở chat hỗ trợ', exact: true }).click();
    await staff.page.locator('.chat-contact').filter({ hasText: 'Khách kiểm tra' }).click();
    await staff.page.locator('.chat-msg-row--them').filter({ hasText: 'Khách nhắn' }).waitFor();
    await staff.page.getByLabel('Nhập tin nhắn').fill('KTV trả lời');
    await staff.page.getByRole('button', { name: 'Gửi tin nhắn', exact: true }).click();
    await customer.page.locator('.chat-msg-row--them').filter({ hasText: 'KTV trả lời' }).waitFor();
    await customer.page.getByLabel('Nhập tin nhắn').fill('Bản nháp chưa gửi');
    await customer.page.getByRole('button', { name: 'Đóng chat', exact: true }).click();
    await customer.page.locator('.chat-window').waitFor({ state: 'detached' });
    assert.equal(await customer.page.evaluate(() => document.body.style.overflow), '');
    assert(await customer.page.locator('[data-chat-open]').evaluate(el => el === document.activeElement));
    await customer.page.getByRole('button', { name: 'Mở chat hỗ trợ', exact: true }).click();
    assert.equal(await customer.page.getByLabel('Nhập tin nhắn').inputValue(), 'Bản nháp chưa gửi');
    await customer.page.reload();
    await customer.page.getByRole('button', { name: 'Mở chat hỗ trợ', exact: true }).click();
    await customer.page.locator('.chat-contact').click();
    await customer.page.locator('.chat-bubble-msg').filter({ hasText: 'KTV trả lời' }).waitFor();
    failAfterSave = true;
    await customer.page.getByLabel('Nhập tin nhắn').fill('Retry safe');
    await customer.page.getByRole('button', { name: 'Gửi tin nhắn', exact: true }).click();
    await customer.page.getByRole('alert').filter({ hasText: 'kết nối' }).waitFor();
    assert.equal(await customer.page.getByLabel('Nhập tin nhắn').inputValue(), 'Retry safe');
    await customer.page.getByRole('button', { name: 'Gửi tin nhắn', exact: true }).click();
    await customer.page.waitForFunction(() => document.querySelector('.chat-input-field').value === '');
    assert.equal(requests.at(-1).requestId, requests.at(-2).requestId);
    assert.equal(messages.filter(m => m.text === 'Retry safe').length, 1);
    await customer.page.getByLabel('Nhập tin nhắn').fill('Retry safe');
    await customer.page.getByRole('button', { name: 'Gửi tin nhắn', exact: true }).click();
    await customer.page.waitForFunction(() => document.querySelector('.chat-input-field').value === '');
    assert.equal(messages.filter(m => m.text === 'Retry safe').length, 2, 'intentionally repeating text must create a new message');
    assert.notEqual(requests.at(-1).requestId, requests.at(-2).requestId);
    for (let n = 0; n < 55; n++) messages.push({ id: String(next++), text: `Cũ ${n}`, who: 'staff', createdAt: new Date().toISOString() });
    await customer.page.getByRole('button', { name: 'Danh sách người liên hệ' }).click();
    await customer.page.locator('.chat-contact').click();
    await customer.page.getByRole('button', { name: 'Tải tin nhắn cũ hơn' }).click();
    await customer.page.locator('.chat-bubble-msg').filter({ hasText: 'Khách nhắn' }).waitFor();
    assert.equal(await customer.page.locator('.chat-bubble-msg').count(), messages.length);
    for (let n = 0; n < 65; n++) messages.push({ id: String(next++), text: `Tin mới ${n}`, who: 'staff', createdAt: new Date().toISOString() });
    await customer.page.locator('.chat-bubble-msg').filter({ hasText: 'Tin mới 64', exact: true }).waitFor();
    assert.equal(await customer.page.locator('.chat-bubble-msg').count(), messages.length, 'polling must not skip a burst larger than one page');
    canSend = false;
    await customer.page.waitForFunction(() => document.querySelector('.chat-input-field')?.disabled);
    await staff.page.waitForFunction(() => document.querySelector('.chat-input-field')?.disabled);
    await customer.page.getByText('Cuộc trò chuyện chỉ xem lịch sử.', { exact: false }).waitFor();
    assert.equal(await customer.page.getByText('Đang trực tuyến', { exact: true }).count(), 0);
    await customer.page.screenshot({ path: fileURLToPath(new URL(`../test-results/chat-${width}.png`, import.meta.url)) });
    const box = await customer.page.locator('.chat-window').boundingBox();
    assert(box.x >= 0 && box.x + box.width <= width + 1, 'chat fits viewport');
    assert(box.width <= 340 && box.height <= 440, 'chat stays compact');
    assert(box.y + box.height <= 900 && box.y > 0, 'chat sits near the bottom of viewport');
    await customer.page.keyboard.press('Escape');
    await customer.page.locator('.chat-window').waitFor({ state: 'detached' });
    await customer.page.locator('.chat-mini').waitFor();
    assert.equal(await customer.page.locator('.chat-window').count(), 0);
    await customer.page.getByRole('button', { name: 'Mở chat hỗ trợ', exact: true }).click();
    assert.equal(await customer.page.locator('.chat-mini').count(), 0);
    await customer.page.getByRole('button', { name: 'Danh sách người liên hệ' }).click();
    await customer.page.locator('.chat-search input').fill('không tìm thấy');
    await customer.page.getByText('Không tìm thấy người liên hệ phù hợp.', { exact: true }).waitFor();
    failDirectory = true;
    await customer.page.getByRole('alert').filter({ hasText: 'Không thể tải danh bạ thử.' }).waitFor({ timeout: 10000 });
    failDirectory = false;
    await customer.page.getByRole('button', { name: 'Thử lại', exact: true }).click();
    await customer.page.locator('.chat-search input').fill('TN-CHAT');
    await customer.page.locator('.chat-contact').waitFor();
    assert(customer.errors.every(e => /Failed to load resource:/.test(e)), customer.errors.join('\n'));
    assert.deepEqual(staff.errors, []);
    await customer.context.close(); await staff.context.close();
    console.log(`PASS chat ${width}px: two-way, persistence, retry idempotency, safe text, older history, reassignment, search, errors, keyboard`);
  }
} finally { await browser.close(); }
