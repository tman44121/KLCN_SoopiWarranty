// Mock-only UI checks: no real messages or account changes.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { browser, login, session } from './smoke.mjs';
const base = process.env.E2E_BASE_URL || 'http://localhost:5173';
const ticketCode = 'TN-2026-1002-00001';
try {
  for (const width of [1440, 375]) {
    const s = await session('CUSTOMER', '/account', width, { hasTouch: width === 375 });
    const contacts = [
      { ticketCode, staffAccountId: '10', conversationId: null, name: 'Người tiếp nhận', role: 'Tiếp nhận', productName: 'Galaxy S24', serial: 'SERIAL-01', canSend: true, unreadCount: 1 },
      { ticketCode, staffAccountId: '20', conversationId: null, name: 'KTV phụ trách', role: 'Kỹ thuật viên', productName: 'Galaxy S24', serial: 'SERIAL-01', canSend: true, unreadCount: 2 },
      { ticketCode: ticketCode + 'X', staffAccountId: '30', conversationId: null, name: 'Người của phiếu khác', role: 'Kỹ thuật viên', productName: 'Thiết bị khác', serial: 'SERIAL-02', canSend: true, unreadCount: 0 },
    ];
    const starts = [];
    let incoming = false, unseen = false, readCalls = 0;
    await s.context.route('**/api/v1/chat/**', route => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (path.endsWith('/contacts')) return route.fulfill({ json: { items: contacts, hasMore: false, unreadCount: unseen ? 4 : 3 } });
      if (path.endsWith('/conversations')) { starts.push(request.postDataJSON()); return route.fulfill({ json: { id: '1' } }); }
      if (path.endsWith('/read')) { readCalls++; unseen = false; return route.fulfill({ status: 204 }); }
      return route.fulfill({ json: { items: incoming ? [{ id: '1', mine: false, text: 'Tin đến khi chat thu gọn', createdAt: '2026-10-31T04:00:00Z' }] : [], hasMore: false, canSend: true } });
    });
    await login(s.page); await s.page.waitForURL(base + '/account');
    await s.page.goto(base + '/account#phieu/' + ticketCode);
    await s.page.getByRole('button', { name: 'Nhắn người phụ trách', exact: true }).click();
    const dialog = s.page.getByRole('dialog', { name: 'Chat hỗ trợ', exact: true });
    await dialog.locator('.chat-contact').first().waitFor();
    assert.equal(await dialog.locator('.chat-contact').count(), 2, 'ticket shortcut shows only exact-ticket contacts');
    assert.equal(await dialog.getByText('Người của phiếu khác', { exact: true }).count(), 0);
    assert.equal(await s.page.locator('.navbar-header [data-chat-open] .chat-fab-badge').textContent(), '3');
    assert.match(await dialog.locator('.chat-ticket-filter').textContent(), new RegExp(ticketCode));
    await dialog.getByRole('button', { name: 'Đóng chat', exact: true }).focus();
    await s.page.keyboard.press('Shift+Tab');
    assert.equal(await s.page.evaluate(() => document.body.style.overflow), '', 'compact chat does not lock page scrolling');
    await dialog.locator('.chat-contact').filter({ hasText: 'KTV phụ trách' }).click();
    await s.page.getByLabel('Nhập tin nhắn').fill('Nháp đúng phiếu');
    assert.deepEqual(starts[0], { ticketCode, staffAccountId: '20' });
    if (width === 375) {
      await s.page.setViewportSize({ width, height: 360 });
      const small = await dialog.boundingBox();
      const input = await s.page.getByLabel('Nhập tin nhắn').boundingBox();
      assert(small.y >= 0 && small.y + small.height <= 360);
      assert(input.y + input.height <= 360, 'composer stays inside a short viewport');
      await s.page.setViewportSize({ width, height: 900 });
    }
    await dialog.getByRole('button', { name: 'Thu gọn chat', exact: true }).click();
    await dialog.waitFor({ state: 'detached' });
    const mini = s.page.getByRole('button', { name: 'Mở lại chat với KTV phụ trách', exact: true });
    await mini.waitFor();
    assert.equal(await mini.locator('.chat-fab-badge').textContent(), '3');
    assert((await mini.boundingBox()).width <= 48);
    const readsBeforeMinimized = readCalls;
    incoming = true; unseen = true;
    await s.page.waitForFunction(() => document.querySelector('.chat-mini .chat-fab-badge')?.textContent === '4', null, { timeout: 20000 });
    assert.equal(readCalls, readsBeforeMinimized, 'minimized chat does not mark new messages read');
    await s.page.screenshot({ path: fileURLToPath(new URL(`../test-results/chat-minimized-${width}.png`, import.meta.url)) });
    await mini.click();
    await dialog.getByText('Tin đến khi chat thu gọn', { exact: true }).waitFor();
    assert.equal(await s.page.getByLabel('Nhập tin nhắn').inputValue(), 'Nháp đúng phiếu');
    assert.equal(await s.page.locator('.chat-mini').count(), 0);
    await dialog.getByRole('button', { name: 'Đóng chat', exact: true }).click();
    await dialog.waitFor({ state: 'detached' });
    assert.equal(await s.page.locator('.chat-mini').count(), 0, 'close removes the chat head');
    await s.page.locator('.navbar-header [data-chat-open]').click();
    assert.equal(await s.page.getByLabel('Nhập tin nhắn').inputValue(), 'Nháp đúng phiếu');
    await dialog.getByRole('button', { name: 'Danh sách người liên hệ', exact: true }).click();
    await dialog.getByRole('button', { name: 'Tất cả liên hệ', exact: true }).click();
    await s.page.waitForFunction(() => document.querySelectorAll('.chat-contact').length === 3);
    const box = await dialog.boundingBox();
    assert(box.width <= 340 && box.height <= 440);
    assert(box.x > 0 && box.y > 0 && box.x + box.width < width, 'compact window leaves the page visible');
    assert.equal(await s.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await s.page.screenshot({ path: fileURLToPath(new URL(`../test-results/chat-header-${width}.png`, import.meta.url)) });
    if (width === 1440) {
      await s.page.mouse.click(10, 200);
      assert(await dialog.isVisible(), 'interacting with the page keeps chat open');
    }
    await dialog.getByRole('button', { name: 'Thu gọn chat', exact: true }).click();
    await dialog.waitFor({ state: 'detached' });
    await s.page.getByRole('button', { name: 'Đóng chat thu gọn', exact: true }).click();
    assert.equal(await s.page.locator('.chat-mini').count(), 0);
    for (const path of ['/', '/portal']) {
      await s.page.goto(base + path);
      await s.page.locator('.navbar-header [data-chat-open]').waitFor();
      assert.equal(await s.page.locator('.chat-bubble-fab').count(), 0);
    }
    assert.deepEqual(s.errors, []);
    await s.context.close();

    const admin = await session('ADMIN', '/admin', width, { hasTouch: width === 375 });
    await login(admin.page); await admin.page.waitForURL(base + '/admin');
    const launcher = admin.page.locator('.app-header [data-chat-open]');
    await launcher.waitFor();
    await admin.page.evaluate(() => scrollTo(0, document.body.scrollHeight));
    assert.equal(await admin.page.locator('.chat-bubble-fab, .live-chat-root').count(), 0);
    assert((await launcher.boundingBox()).y < 120, 'launcher remains on header after scrolling table');
    assert.equal(await admin.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await admin.page.screenshot({ path: fileURLToPath(new URL(`../test-results/chat-admin-header-${width}.png`, import.meta.url)) });
    await launcher.click(); await admin.page.getByRole('dialog', { name: 'Chat hỗ trợ', exact: true }).waitFor();
    await admin.page.keyboard.press('Escape');
    await admin.page.locator('.chat-window').waitFor({ state: 'detached' });
    await admin.page.locator('.chat-mini').waitFor();
    assert.deepEqual(admin.errors, []);
    await admin.context.close();
  }
  const guest = await session('CUSTOMER', '/account');
  await guest.page.goto(base + '/'); await guest.page.getByRole('heading', { name: 'Tra cứu & quản lý bảo hành sản phẩm' }).waitFor();
  assert.equal(await guest.page.locator('[data-chat-open]').count(), 0);
  await guest.context.close();
  console.log('PASS compact chat: ticket contacts, badge, minimize/restore/dismiss, drafts, page interaction, Escape, header entry, guest hidden, desktop/mobile.');
} finally { await browser.close(); }
