import test from 'node:test';
import assert from 'node:assert/strict';
import initializeApi from '../src/behaviors/api.js';
import initializeHtml from '../src/behaviors/html.js';
import { internalRoute } from '../src/navigation.ts';

function setup(fetch) {
  const values = new Map();
  globalThis.sessionStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  globalThis.location = { origin: 'http://localhost:5173', pathname: '/tickets', search: '?q=TN01', hash: '#notes', replace(url) { this.redirect = url; } };
  globalThis.fetch = fetch;
  const window = { crypto };
  initializeApi(window);
  return window.LML_API;
}
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/problem+json' } });

test('parallel staff 401 responses share one refresh and retry with the new token', async () => {
  let refreshes = 0;
  const api = setup(async (url, options) => {
    assert.equal(options.credentials, 'include');
    if (url.endsWith('/auth/refresh')) {
      refreshes++;
      await new Promise(resolve => setTimeout(resolve, 10));
      return json({ accessToken: 'test-new', user: { roles: [] } });
    }
    return options.headers.Authorization === 'Bearer test-new' ? json(['ok']) : json({}, 401);
  });
  api.tokens.set('test-old');
  assert.deepEqual(await Promise.all([api.get('/tickets'), api.get('/customers')]), [['ok'], ['ok']]);
  assert.equal(refreshes, 1);
});
test('expired portal access is cleared and never uses staff refresh', async () => {
  let calls = 0;
  const api = setup(async (_, options) => { calls++; assert.equal(options.headers.Authorization, 'Bearer test-portal'); return json({ detail: 'Hết hạn' }, 401); });
  api.portalTokens.set({ accessToken: 'test-portal' });
  await assert.rejects(api.portal.ticket('TN01'), error => error.status === 401 && error.detail === 'Hết hạn');
  assert.equal(calls, 1);
  assert.equal(api.portalTokens.get(), null);
});
test('JSON field errors remain available to forms; 204 succeeds', async () => {
  const api = setup(async () => json({ code: 'VALIDATION_FAILED', detail: 'Dữ liệu không hợp lệ', fieldErrors: [{ field: 'phone', message: 'Sai số điện thoại' }] }, 400));
  await assert.rejects(api.post('/customers', {}), error => error.fieldErrors[0].field === 'phone' && error.status === 400 && error.detail.includes('Sai số điện thoại'));
  globalThis.fetch = async () => new Response(null, { status: 204 });
  assert.equal(await api.post('/notifications/read-all'), null);
});
test('uploads send JSON data and files without overriding multipart boundary', async () => {
  const api = setup(async (_, options) => {
    assert.equal(options.headers['Content-Type'], undefined);
    assert(options.body instanceof FormData);
    assert.deepEqual(JSON.parse(await options.body.get('data').text()), { phone: '0900000000' });
    assert.equal(await options.body.get('files').text(), 'test-file');
    return json({ code: 'YC01' });
  });
  await api.portal.submitRequest({ phone: '0900000000' }, [new File(['test-file'], 'test.txt')]);
});
test('network errors and failed refresh report errors and preserve return location', async () => {
  const api = setup(async () => { throw new Error('offline'); });
  await assert.rejects(api.portal.catalog(), error => error.status === 0 && error.code === 'NETWORK_ERROR');
  globalThis.fetch = async () => json({}, 401);
  await assert.rejects(api.get('/tickets'), error => error.status === 401);
  assert.equal(location.redirect, '/login?next=%2Ftickets%3Fq%3DTN01%23notes');
  assert.equal(api.tokens.get(), null);
});
test('optional requests (redirect: false) fail without leaving a public page', async () => {
  const api = setup(async () => json({}, 401));
  api.tokens.set('test-stale');
  await assert.rejects(api.get('/portal/my/tickets', null, { redirect: false }), error => error.status === 401);
  assert.equal(location.redirect, undefined);
  assert.equal(api.tokens.get(), null);
  globalThis.fetch = async () => json({ code: 'AUTH_PASSWORD_CHANGE_REQUIRED', detail: 'Đổi mật khẩu' }, 403);
  await assert.rejects(api.get('/portal/my/tickets', null, { redirect: false }), error => error.code === 'AUTH_PASSWORD_CHANGE_REQUIRED');
  assert.equal(location.redirect, undefined);
});
test('legacy navigation keeps query/hash and rejects external redirects', () => {
  setup(async () => json({}));
  assert.equal(internalRoute('pages/warehouse.html?station=A#stockout'), '/warehouse?station=A#stockout');
  assert.equal(internalRoute('/index.html?ticket=TN01'), '/dispatch?ticket=TN01');
  assert.equal(internalRoute('/'), '/');
  assert.equal(internalRoute('/?x=1#hoi-dap'), '/?x=1#hoi-dap');
  for (const value of ['https://evil.example/portal', '//evil.example/login', 'javascript:alert(1)', '/unknown', '/\\evil.example/login']) assert.equal(internalRoute(value), null);
});
test('HTML rendering escapes data and keeps nested safe markup', () => {
  const window = {};
  initializeHtml(window);
  assert.equal(String(window.html`<p>${'<img src=x onerror=alert(1)>'}</p>`), '<p>&lt;img src=x onerror=alert(1)&gt;</p>');
  assert.equal(String(window.html`<p>${window.html`<b>${'a&b'}</b>`}</p>`), '<p><b>a&amp;b</b></p>');
});
