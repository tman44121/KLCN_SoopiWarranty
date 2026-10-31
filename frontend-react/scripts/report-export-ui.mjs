// Isolated staff session with mocked reports: downloads never touch the live database.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { browser, session, login } from './smoke.mjs';

const base = process.env.E2E_BASE_URL || 'http://localhost:5173';
const payload = Buffer.from([80, 75, 3, 4, 0, 255]);
const output = new URL('../test-results/', import.meta.url);
let checks = 0;
try {
  for (const width of [1440, 768, 390]) {
    const s = await session('ADMIN', '/admin', width);
    s.page.setDefaultTimeout(7000);
    let failExport = false;
    let failReport = false;
    let empty = false;
    let exportedQuery;
    const reportQueries = [];
    let revenueGate = null;
    let revenueHeld;
    await s.context.route('**/api/v1/reports/**', async route => {
      const url = new URL(route.request().url());
      const report = url.pathname.split('/').at(-1);
      if (report === 'export') {
        exportedQuery = url.searchParams;
        await new Promise(resolve => setTimeout(resolve, 150));
        if (failExport) return route.abort('failed');
        return route.fulfill({ status: 200, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', body: payload });
      }
      reportQueries.push({ report, from: url.searchParams.get('from'), to: url.searchParams.get('to') });
      if (report === 'revenue-monthly' && revenueGate) { revenueHeld(); await revenueGate; }
      if (failReport) return route.abort('failed');
      const data = {
        'revenue-monthly': empty ? [] : [{ month: '2026-10', payments: 2, total: 2916000 }],
        'tickets-by-status': empty ? [] : [{ status: 'DELIVERED', count: 3 }],
        turnaround: { delivered: empty ? 0 : 3, avgHours: empty ? null : 12.5, minHours: 2, maxHours: 20, byCategory: empty ? [] : [{ categoryCode: 'PHONE', delivered: 3, avgHours: 12.5 }] },
        'technician-performance': empty ? [] : [{ employeeId: 'NV-001', fullName: 'Kỹ thuật viên thử', assigned: 4, completed: 3, avgRepairHours: 8.25, firstPassQcRate: 100 }],
        'warranty-ratio': { freeWarranty: empty ? 0 : 1, charged: empty ? 0 : 2, freeRatePercent: empty ? null : 33.3 },
        'customer-reviews': { reviews: { items: [], page: 0, totalPages: 1, totalItems: 0 }, customerReviewCount: 0, averageRating: null, legacyCount: 0 },
      }[report];
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    });
    await login(s.page);
    await s.page.waitForURL(base + '/admin');
    await s.page.goto(base + '/admin#reports');
    const button = s.page.getByRole('button', { name: 'Xuất Excel', exact: true });
    await s.page.locator('[data-report-body][data-loaded][aria-busy="false"]').waitFor();
    assert.equal(await button.isEnabled(), true); checks++;
    await s.page.selectOption('[data-admin-range]', 'month');
    await s.page.selectOption('[data-admin-station]', 'ST01');
    await s.page.locator('[data-report-body][aria-busy="false"]').waitFor();
    const downloadPromise = s.page.waitForEvent('download');
    await button.click();
    const download = await downloadPromise;
    assert.match(download.suggestedFilename(), /^soopi-bao-cao-\d{4}-\d{2}-01-\d{4}-\d{2}-\d{2}\.xlsx$/); checks++;
    assert.equal(exportedQuery.get('station'), 'ST01'); checks++;
    assert(exportedQuery.get('from').endsWith('-01')); checks++;
    assert.deepEqual(await readFile(await download.path()), payload); checks++;
    await s.page.locator('[data-export-report]:not([disabled])').waitFor();
    const from = s.page.locator('#admin-report-from');
    const to = s.page.locator('#admin-report-to');
    assert.equal(await from.isVisible(), true); checks++;
    assert.equal(await to.isVisible(), true); checks++;
    await from.fill('2026-09-05');
    assert.equal(await s.page.locator('[data-admin-range]').inputValue(), 'custom'); checks++;
    await to.fill('2026-10-17');
    await s.page.locator('[data-export-report]:not([disabled])').waitFor();
    const customDownload = s.page.waitForEvent('download');
    await button.click();
    assert.equal((await customDownload).suggestedFilename(), 'soopi-bao-cao-2026-09-05-2026-10-17.xlsx'); checks++;
    assert.equal(exportedQuery.get('from'), '2026-09-05'); checks++;
    assert.equal(exportedQuery.get('to'), '2026-10-17'); checks++;
    assert.equal(exportedQuery.get('station'), 'ST01'); checks++;
    await s.page.locator('[data-export-report]:not([disabled])').waitFor();
    for (const report of ['revenue-monthly', 'tickets-by-status', 'turnaround', 'technician-performance', 'warranty-ratio']) {
      const query = reportQueries.findLast(query => query.report === report);
      assert.deepEqual([query.from, query.to], ['2026-09-05', '2026-10-17']); checks++;
    }
    await s.page.selectOption('[data-review-period]', 'report');
    await s.page.getByText('Không có đánh giá phù hợp', { exact: true }).waitFor();
    const requestsBeforeInvalid = reportQueries.length;
    await from.fill('2026-10-18');
    await s.page.getByText('Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.', { exact: true }).waitFor(); checks++;
    assert.equal(await button.isDisabled(), true); checks++;
    assert.equal(reportQueries.length, requestsBeforeInvalid); checks++;
    await from.fill('');
    await s.page.getByText('Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc.', { exact: true }).waitFor(); checks++;
    assert.equal(await button.isDisabled(), true); checks++;
    await from.fill('2026-10-17');
    await s.page.locator('[data-export-report]:not([disabled])').waitFor();
    const sameDayDownload = s.page.waitForEvent('download');
    await button.click();
    assert.equal((await sameDayDownload).suggestedFilename(), 'soopi-bao-cao-2026-10-17-2026-10-17.xlsx'); checks++;
    assert.equal(exportedQuery.get('from'), exportedQuery.get('to')); checks++;
    await s.page.locator('[data-export-report]:not([disabled])').waitFor();
    await from.fill('2026-09-05');
    await s.page.locator('[data-export-report]:not([disabled])').waitFor();
    assert.equal(await s.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); checks++;
    await s.page.screenshot({ path: fileURLToPath(new URL(`report-export-${width}.png`, output)), fullPage: true });
    assert.deepEqual(s.errors, []); checks++;
    if (width === 1440) {
      let releaseRevenue;
      revenueGate = new Promise(resolve => { releaseRevenue = resolve; });
      const held = new Promise(resolve => { revenueHeld = resolve; });
      const staleResponse = s.page.waitForResponse(response => response.url().includes('/reports/revenue-monthly?') && response.url().includes('from=2026-09-06'));
      await from.fill('2026-09-06');
      await held;
      await from.fill('2026-10-18');
      await s.page.getByText('Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.', { exact: true }).waitFor();
      releaseRevenue();
      revenueGate = null;
      await staleResponse;
      assert.equal(await button.isDisabled(), true); checks++;
      await s.page.selectOption('[data-admin-range]', 'month');
      await s.page.locator('[data-export-report]:not([disabled])').waitFor();
      assert.equal(await from.isVisible(), true); checks++;
      assert((await from.inputValue()).endsWith('-01')); checks++;
      failExport = true;
      await button.click();
      await s.page.getByText('Không thể kết nối máy chủ. Vui lòng kiểm tra mạng và thử lại.', { exact: true }).waitFor(); checks++;
      await s.page.locator('[data-export-report]:not([disabled])').waitFor(); checks++;
      empty = true;
      await s.page.selectOption('[data-admin-range]', 'quarter');
      await s.page.locator('[data-report-body][aria-busy="false"]').waitFor();
      assert.equal(await button.isEnabled(), true); checks++;
      failReport = true;
      await s.page.selectOption('[data-admin-range]', 'year');
      await s.page.locator('[data-report-body][aria-busy="false"]').waitFor();
      assert.equal(await button.isDisabled(), true); checks++;
    }
    await s.context.close();
    console.log(`PASS report Excel download, filters and layout: ${width}px`);
  }
  console.log(`PASS: ${checks} report export UI checks; no live database writes`);
} finally { await browser.close(); }
