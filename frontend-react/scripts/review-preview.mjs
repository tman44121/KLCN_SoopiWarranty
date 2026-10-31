import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { browser, session } from './smoke.mjs';
const base = process.env.E2E_BASE_URL || 'http://localhost:5173';
try {
  for (const width of [1440, 390]) {
    const s = await session('CUSTOMER', '/account', width);
    await s.page.goto(base + '/?reviewPreview=1');
    const panel = s.page.getByLabel('Đánh giá khách hàng', { exact: true });
    await panel.getByText('24', { exact: true }).waitFor();
    assert.match(await panel.textContent(), /Đánh giá mẫu — chỉ để xem giao diện/);
    assert.equal(s.calls.filter(path => path === '/public/reviews').length, 0);
    assert.equal(await panel.locator('.home-review').count(), 2);
    assert.equal(await panel.getByText('Đã nhận thiết bị', { exact: true }).count(), 0);
    await panel.getByRole('button', { name: 'Xem thêm đánh giá', exact: true }).click();
    assert.equal(await panel.locator('.home-review').count(), 24);
    assert.equal(await panel.getByRole('img', { name: '1 trên 5 sao', exact: true }).count(), 1);
    assert(await panel.locator('.home-review-list').evaluate(el => el.scrollHeight > el.clientHeight));
    assert.equal(await s.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await panel.screenshot({ path: fileURLToPath(new URL(`../test-results/review-preview-${width}.png`, import.meta.url)) });
    await panel.getByRole('link', { name: 'Thoát xem thử', exact: true }).click();
    await s.page.getByRole('heading', { name: 'An tâm bảo hành tại Soopi', exact: true }).waitFor();
    assert.equal(await s.page.locator('.home-review').count(), 0);
    assert.deepEqual(s.errors, []);
    await s.context.close();
  }
  console.log('PASS review preview: 24 labelled samples, 1–5 stars, scroll, mobile/desktop, zero public review API calls, exit restores real data.');
} finally { await browser.close(); }
