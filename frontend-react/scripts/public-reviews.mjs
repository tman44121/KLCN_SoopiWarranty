// All API calls are mocked. Never publishes customer data to a real database.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { browser, login, session } from './smoke.mjs';
const base = process.env.E2E_BASE_URL || 'http://localhost:5173';
const items = Array.from({ length: 6 }, (_, i) => ({ id: `opaque-${i}`, rating: i ? 4 : 2,
  comment: i === 5 ? null : i ? `Nhận xét đã duyệt ${i}` : '<img src=x onerror=alert(1)> ' + 'Dịch vụ cần cải thiện 🌟 '.repeat(12), reviewedOn: i === 5 ? null : '2026-10-31' }));
try {
  for (const width of [1440, 390]) {
    const s = await session('CUSTOMER', '/account', width);
    await s.context.route('**/api/v1/public/reviews', route => {
      assert.equal(route.request().headers().authorization, undefined);
      return route.fulfill({ json: { reviewCount: 61, averageRating: 3.7, items } });
    });
    await s.page.goto(base + '/');
    const panel = s.page.getByLabel('Đánh giá khách hàng', { exact: true });
    await panel.getByText('61', { exact: true }).waitFor();
    await s.page.getByRole('heading', { name: 'Máy của bạn được xử lý thế nào?', exact: true }).waitFor({ timeout: 10000 });
    assert.equal(await s.page.locator('.home-process-steps li').count(), 6);
    assert.equal(await s.page.locator('.hero-section .home-reviews-card').count(), 0);
    assert.match(await panel.locator('.home-review-summary').textContent(), /3,7\/5/);
    assert.equal(await panel.locator('.home-review').count(), 2);
    assert.equal(await panel.getByText('Khách hàng ẩn danh', { exact: true }).count(), 2);
    assert.equal(await panel.locator('img').count(), 0);
    assert.equal(await panel.getByRole('img', { name: '2 trên 5 sao', exact: true }).count(), 1);
    assert.equal(await s.page.getByText('Ví dụ minh họa', { exact: true }).count(), 0);
    assert.equal(await s.page.locator('.ticket-item-row, .dark-metrics-grid').count(), 0);
    assert.doesNotMatch(await panel.textContent(), /TN-2026|0900000000|Nguyễn Văn/);
    await panel.getByRole('button', { name: 'Đọc tiếp', exact: true }).click();
    assert.match(await panel.locator('blockquote').first().textContent(), /🌟 $/);
    await panel.getByRole('button', { name: 'Xem thêm đánh giá', exact: true }).click();
    assert.equal(await panel.locator('.home-review').count(), 6);
    assert.equal(await panel.getByText('Điểm trên phiếu bàn giao', { exact: true }).count(), 1);
    assert.equal(await panel.getByText('Chưa lưu ngày đánh giá', { exact: true }).count(), 1);
    assert.equal(await panel.getByText('Chỉ chấm sao, không kèm nhận xét.', { exact: true }).count(), 1);
    assert.doesNotMatch(await panel.textContent(), /Invalid Date|NaN/);
    await panel.getByRole('button', { name: 'Thu gọn', exact: true }).last().click();
    assert.equal(await panel.locator('.home-review').count(), 2);
    assert.equal(await s.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await s.page.screenshot({ path: fileURLToPath(new URL(`../test-results/public-reviews-${width}.png`, import.meta.url)), animations: 'disabled' });
    assert.deepEqual(s.errors, []);
    await login(s.page); await s.page.waitForURL(base + '/account');
    await s.page.goto(base + '/');
    await s.page.getByRole('heading', { name: 'Tiến độ sửa chữa thiết bị của bạn', exact: true }).waitFor();
    await panel.getByText('61', { exact: true }).waitFor();
    assert.equal(await s.page.locator('.hero-section .ticket-item-row').count(), 3);
    assert.equal(await panel.locator('.home-review').count(), 2);
    await s.context.close();
  }
  for (const width of [1440, 390]) {
    const sample = await session('CUSTOMER', '/account', width);
    let hasRealReview = false;
    await sample.context.route('**/api/v1/public/reviews', route => route.fulfill({ json: {
      reviewCount: 366, averageRating: 4.3,
      items: hasRealReview ? [{ ...items[5], rating: 4 }] : [], sampleItems: items,
    } }));
    await sample.page.goto(base + '/');
    const panel = sample.page.getByLabel('Đánh giá khách hàng', { exact: true });
    await sample.page.waitForLoadState('networkidle');
    await sample.page.getByRole('heading', { name: 'Máy của bạn được xử lý thế nào?', exact: true }).waitFor();
    assert.equal(await panel.count(), 0, 'Unpublished scores must not show a review section or aggregate');
    assert.equal(await sample.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    hasRealReview = true;
    await sample.page.reload();
    await panel.getByText('Chỉ chấm sao, không kèm nhận xét.', { exact: true }).waitFor();
    assert.equal(await panel.getByText('Dữ liệu minh họa', { exact: true }).count(), 0);
    assert.equal(await panel.getByText('Phiếu bàn giao ẩn danh', { exact: true }).count(), 1);
    await panel.getByText('366', { exact: true }).waitFor();
    await sample.page.screenshot({ path: fileURLToPath(new URL(`../test-results/legacy-public-review-${width}.png`, import.meta.url)), fullPage: true });
    hasRealReview = false;
    await sample.page.reload(); await sample.page.waitForLoadState('networkidle');
    assert.equal(await panel.count(), 0, 'Hiding the last publication also hides the aggregate');
    assert.equal(await sample.page.locator('.home-process-steps li').count(), 6);
    assert.deepEqual(sample.errors, []);
    await sample.context.close();
  }
  const empty = await session('CUSTOMER', '/account', 390);
  let failed = true;
  await empty.context.route('**/api/v1/public/reviews', route => failed
    ? route.fulfill({ status: 503, json: { detail: 'Thử kết nối lỗi' } })
    : route.fulfill({ json: { reviewCount: 0, averageRating: null, items: [] } }));
  await empty.page.goto(base + '/');
  const panel = empty.page.getByLabel('Đánh giá khách hàng', { exact: true });
  await panel.getByRole('button', { name: 'Thử lại', exact: true }).waitFor();
  assert.equal(new URL(empty.page.url()).pathname, '/');
  failed = false;
  await panel.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await panel.waitFor({ state: 'detached' });
  assert.equal(await panel.count(), 0);
  assert.equal(await empty.page.locator('.home-process-steps li').count(), 6);
  await empty.context.route('**/api/v1/portal/my/tickets', route => route.fulfill({ json: [] }));
  await login(empty.page); await empty.page.waitForURL(base + '/account');
  await empty.page.goto(base + '/');
  await empty.page.getByText('Bạn chưa có phiếu bảo hành.', { exact: true }).first().waitFor();
  assert.equal(await empty.page.locator('.ticket-item-row').count(), 0);
  assert.deepEqual(await empty.page.locator('.hero-dashboard-card .dash-stat-val').allTextContents(), ['0', '0', '0']);
  assert.deepEqual(empty.errors.filter(e => !e.includes('503')), []);
  await empty.context.close();

  const admin = await session('ADMIN', '/admin');
  const review = { ticketCode: 'TN-REVIEW', customerCode: 'KH-PRIVATE', fullName: 'Tên riêng', phone: '0900000001', productName: 'Thiết bị', stationName: 'Trạm thử',
    rating: 2, comment: 'Cần cải thiện 🌟', ratedAt: '2026-10-31T03:00:00Z', published: false };
  const legacy = { ...review, ticketCode: 'TN-LEGACY', ratedAt: null, comment: null };
  const writes = []; let conflict = false;
  await admin.context.route('**/api/v1/reports/customer-reviews**', route => route.fulfill({ json: {
    reviews: { items: [review, legacy], page: 0, size: 25, totalPages: 1, totalItems: 2 }, customerReviewCount: 1, averageRating: 2, legacyCount: 1,
  } }));
  await admin.context.route('**/api/v1/admin/reviews/*/publication', route => {
    const body = route.request().postDataJSON(); writes.push(body);
    if (conflict) return route.fulfill({ status: 409, json: { code: 'CONCURRENT_MODIFICATION', detail: 'Đánh giá vừa thay đổi. Tải lại báo cáo.' } });
    (route.request().url().includes('TN-LEGACY') ? legacy : review).published = body.published;
    return route.fulfill({ status: 204 });
  });
  await login(admin.page); await admin.page.waitForURL(base + '/admin');
  await admin.page.locator('[data-page-tab="reports"]').click();
  const button = admin.page.locator('[data-review-publish="TN-REVIEW"]');
  await button.waitFor();
  assert(await admin.page.locator('[data-review-publish="TN-LEGACY"]').isEnabled());
  await button.click(); await admin.page.locator('[role="dialog"]:visible [data-confirm-cancel]').click();
  assert.equal(writes.length, 0);
  await button.click(); await admin.page.locator('[role="dialog"]:visible [data-confirm-ok]').click();
  await button.filter({ hasText: 'Ẩn' }).waitFor();
  assert.deepEqual(writes[0], { published: true, rating: 2, ratedAt: review.ratedAt, comment: review.comment });
  await button.click(); await button.filter({ hasText: 'Hiển thị' }).waitFor();
  assert.equal(writes[1].published, false);
  conflict = true;
  await button.click(); await admin.page.locator('[role="dialog"]:visible [data-confirm-ok]').click();
  await admin.page.getByText('Đánh giá vừa thay đổi. Tải lại báo cáo.', { exact: false }).waitFor();
  assert.equal(await button.textContent(), 'Hiển thị');
  conflict = false;
  const legacyButton = admin.page.locator('[data-review-publish="TN-LEGACY"]');
  await legacyButton.click(); await admin.page.locator('[role="dialog"]:visible [data-confirm-ok]').click();
  await legacyButton.filter({ hasText: 'Ẩn' }).waitFor();
  assert.deepEqual(writes.at(-1), { published: true, rating: 2, ratedAt: null, comment: null });
  await legacyButton.click(); await legacyButton.filter({ hasText: 'Hiển thị' }).waitFor();
  assert.equal(writes.at(-1).published, false);
  await admin.page.screenshot({ path: fileURLToPath(new URL('../test-results/public-reviews-admin.png', import.meta.url)), animations: 'disabled' });
  assert.deepEqual(admin.errors.filter(e => !e.includes('409')), []);
  await admin.context.close();
  console.log('PASS public reviews: anonymous guest cards, honest aggregate, Unicode/XSS, expand, empty/error/retry, real customer zero state, admin approval/hide/cancel/conflict/legacy, desktop/mobile.');
} finally { await browser.close(); }
