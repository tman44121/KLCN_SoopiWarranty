// Kiểm tra trình duyệt với API giả lập; không gửi đánh giá hoặc thay đổi DB thật.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { browser, login, session } from './smoke.mjs';
const base = process.env.E2E_BASE_URL || 'http://localhost:5173';
const code = 'TN-2026-1002-00001';
try {
  for (const width of [1440, 375]) {
    const s = await session('CUSTOMER', '/account', width);
    let ticket = { code, productName: 'Galaxy S24', brandName: 'Samsung', serialOrImei: '356000000000001',
      receivedAt: '2026-10-01T02:00:00Z', status: 'DELIVERED', stopped: false, steps: [], customerNotes: [],
      costs: { total: 0, paymentStatus: 'FREE_WARRANTY' }, pendingQuotation: null, handedOverAt: '2026-10-20T03:00:00Z',
      rating: null, canRate: true, ratingComment: null, ratedAt: null };
    const bodies = [];
    let fail = false;
    await s.context.route('**/api/v1/portal/tickets/**', async route => {
      if (route.request().method() === 'POST') {
        if (fail) return route.fulfill({ status: 422, json: { detail: 'Không thể gửi đánh giá thử.' } });
        const data = route.request().postDataJSON(); bodies.push(data);
        ticket = { ...ticket, rating: data.rating, ratingComment: data.comment, ratedAt: '2026-10-22T03:00:00Z' };
      }
      return route.fulfill({ json: ticket });
    });
    await login(s.page);
    await s.page.waitForURL(base + '/account');
    await s.page.goto(`${base}/account#phieu/${code}`);
    const review = s.page.locator('.customer-rating-card');
    await review.waitFor();
    await review.getByRole('radio', { name: /^4 sao/ }).click();
    await review.getByRole('radio', { name: /^4 sao/ }).press('ArrowRight');
    assert.equal(await review.getByRole('radio', { name: /^5 sao/ }).getAttribute('aria-checked'), 'true');
    await review.getByRole('button', { name: '+ Sửa chữa nhanh chóng', exact: true }).click();
    await review.getByLabel('Nhận xét chi tiết').fill('Dịch vụ tốt 🌟\n<img src=x onerror=alert(1)>');
    await review.getByRole('button', { name: 'Gửi đánh giá dịch vụ', exact: true }).click();
    await review.getByRole('button', { name: 'Chỉnh sửa đánh giá', exact: true }).waitFor();
    assert.deepEqual(bodies[0], { rating: 5, comment: '[Sửa chữa nhanh chóng] Dịch vụ tốt 🌟\n<img src=x onerror=alert(1)>' });
    assert.equal(await review.locator('.rating-saved-comment img').count(), 0);
    await s.page.reload();
    await review.getByRole('button', { name: 'Chỉnh sửa đánh giá', exact: true }).click();
    assert.equal(await review.getByLabel('Nhận xét chi tiết').inputValue(), 'Dịch vụ tốt 🌟\n<img src=x onerror=alert(1)>');
    assert.equal(await review.getByRole('button', { name: '✓ Sửa chữa nhanh chóng', exact: true }).getAttribute('aria-pressed'), 'true');
    await review.getByRole('button', { name: '✓ Sửa chữa nhanh chóng', exact: true }).click();
    await review.getByLabel('Nhận xét chi tiết').fill('a'.repeat(1000));
    await review.getByRole('button', { name: '+ Tư vấn chu đáo', exact: true }).click();
    await review.getByRole('alert').filter({ hasText: 'tối đa 1.000 ký tự' }).waitFor();
    assert.equal(await review.getByRole('button', { name: '+ Tư vấn chu đáo', exact: true }).getAttribute('aria-pressed'), 'false');
    await review.getByLabel('Nhận xét chi tiết').fill('');
    await review.getByRole('radio', { name: /^2 sao/ }).click();
    await review.getByRole('button', { name: 'Cập nhật đánh giá', exact: true }).click();
    await review.getByRole('button', { name: 'Chỉnh sửa đánh giá', exact: true }).waitFor();
    assert.deepEqual(bodies[1], { rating: 2, comment: null });
    await s.page.screenshot({ path: fileURLToPath(new URL(`../test-results/reviews-customer-${width}.png`, import.meta.url)), animations: 'disabled' });
    await review.getByRole('button', { name: 'Chỉnh sửa đánh giá', exact: true }).click();
    await review.getByLabel('Nhận xét chi tiết').fill('Giữ bản nháp khi lỗi');
    fail = true;
    await review.getByRole('button', { name: 'Cập nhật đánh giá', exact: true }).click();
    await review.getByRole('alert').filter({ hasText: 'Không thể gửi đánh giá thử' }).waitFor();
    assert.equal(await review.getByLabel('Nhận xét chi tiết').inputValue(), 'Giữ bản nháp khi lỗi');
    ticket = { ...ticket, canRate: false };
    await s.page.reload();
    await s.page.getByRole('heading', { name: 'Galaxy S24', exact: false }).waitFor();
    assert.equal(await review.count(), 0, 'canRate from backend controls visibility');
    assert.deepEqual(s.errors.filter(e => !e.includes('422')), []);
    await s.context.close();
  }

  const admin = await session('ADMIN', '/admin');
  const queries = [];
  let fail = false;
  await admin.context.route('**/api/v1/reports/customer-reviews**', async route => {
    const q = new URL(route.request().url()).searchParams; queries.push(Object.fromEntries(q));
    if (fail) return route.fulfill({ status: 500, json: { detail: 'Lỗi bảng đánh giá thử.' } });
    const page = Number(q.get('page') || 0);
    const empty = q.get('q') === 'không có';
    const rows = [{ ticketCode: code, customerCode: 'KH-01', fullName: 'Nguyễn An', phone: '0900000001', productName: 'Galaxy S24', stationName: 'Trạm thử',
      rating: 4, comment: '<img src=x onerror=alert(1)>', ratedAt: page ? null : '2026-10-22T03:00:00Z' }];
    return route.fulfill({ json: { reviews: { items: empty ? [] : rows, page, size: 25, totalPages: empty ? 0 : 2, totalItems: empty ? 0 : 26 },
      customerReviewCount: empty ? 0 : 25, averageRating: empty ? null : 4.25, legacyCount: empty ? 0 : 1 } });
  });
  await login(admin.page);
  await admin.page.waitForURL(base + '/admin');
  await admin.page.locator('[data-page-tab="reports"]').click();
  const table = admin.page.getByRole('region', { name: 'Đánh giá khách hàng', exact: true });
  await table.getByRole('cell', { name: /Nguyễn An/ }).waitFor({ timeout: 10000 }).catch(async error => {
    console.log({ queries, errors: admin.errors, table: await table.textContent() });
    throw error;
  });
  assert.equal(await table.locator('[data-review-tbody] img').count(), 0);
  assert.match(await table.locator('[data-review-summary]').textContent(), /25 đánh giá khách hàng.*4,25.*1 điểm cũ/);
  await table.getByRole('button', { name: 'Trang sau', exact: true }).click();
  await table.getByText('Chưa xác định nguồn/ngày', { exact: true }).waitFor();
  assert.equal(queries.at(-1).page, '1');
  await table.getByLabel('Số sao', { exact: true }).selectOption('2');
  await table.getByRole('cell', { name: /Nguyễn An/ }).waitFor();
  assert.equal(queries.at(-1).page, '0');
  assert.equal(queries.at(-1).rating, '2');
  await table.getByLabel('Thời gian đánh giá', { exact: true }).selectOption('report');
  await table.getByRole('cell', { name: /Nguyễn An/ }).waitFor();
  assert(queries.at(-1).from && queries.at(-1).to);
  await table.getByLabel('Tìm đánh giá', { exact: true }).fill('không có');
  await table.getByText('Không có đánh giá phù hợp', { exact: true }).waitFor();
  assert.match(await table.locator('[data-review-summary]').textContent(), /Điểm trung bình: Chưa có/);
  assert(await table.getByRole('button', { name: 'Trang sau', exact: true }).isDisabled());
  fail = true;
  await table.getByLabel('Số sao', { exact: true }).selectOption('1');
  await table.getByText('Lỗi bảng đánh giá thử.', { exact: true }).waitFor();
  assert.equal(await admin.page.locator('[data-report-body]').getAttribute('aria-busy'), 'false');
  fail = false;
  await table.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await table.getByText('Không có đánh giá phù hợp', { exact: true }).waitFor();
  await table.getByLabel('Tìm đánh giá', { exact: true }).fill('Nguyễn');
  await table.getByRole('cell', { name: /Nguyễn An/ }).waitFor();
  await admin.page.screenshot({ path: fileURLToPath(new URL('../test-results/reviews-admin.png', import.meta.url)), animations: 'disabled' });
  assert.deepEqual(admin.errors.filter(e => !e.includes('500')), []);
  await admin.context.close();
  console.log('PASS customer reviews: submit/edit/reload/clear, Unicode/tags/limit, safe text, errors, mobile, admin filters/pages/summary');
} finally { await browser.close(); }
