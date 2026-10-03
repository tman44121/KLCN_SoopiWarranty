import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

for (const file of readdirSync(new URL('../src/pages/', import.meta.url))) {
  const page = readFileSync(new URL(`../src/pages/${file}`, import.meta.url), 'utf8');
  assert(page.includes('Soopi'), `${file}: missing app name`);
  assert(!/longmanloc/i.test(page), `${file}: old app name`);
}
assert(readFileSync(new URL('../index.html', import.meta.url), 'utf8').includes('<title>Soopi</title>'));

for (const file of readdirSync(new URL('../src/behaviors/', import.meta.url))) {
  const result = spawnSync(process.execPath, ['--check', fileURLToPath(new URL(`../src/behaviors/${file}`, import.meta.url))], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}
const original = new URL('../../../warranty-system-mysql/src/main/resources/static/', import.meta.url);
if (existsSync(original)) {
  const pages = { dispatch: 'index.html', login: 'login.html', portal: 'pages/customer-portal.html',
    receptionist: 'pages/receptionist.html', technician: 'pages/technician.html', warehouse: 'pages/warehouse.html',
    cashier: 'pages/cashier.html', tickets: 'pages/tickets.html', reports: 'pages/reports.html', admin: 'pages/admin.html' };
  // id của chức năng thêm sau khi chuyển từ bản Java (không có trong trang gốc); mọi id gốc vẫn phải giữ nguyên.
  const added = {
    admin: ['customers-title', 'cust-filter-account', 'cust-filter-status', 'cust-drawer-title', 'cust-contact-title',
      'cust-contact-phone', 'cust-contact-email', 'cust-contact-address', 'cust-merge-title', 'cust-merge-target', 'emp-modal-title'],
  };
  for (const [page, file] of Object.entries(pages)) {
    const before = readFileSync(new URL(file, original), 'utf8').split(/<body[^>]*>/i)[1].split('</body>')[0];
    const after = readFileSync(new URL(`../src/pages/${page}.tsx`, import.meta.url), 'utf8');
    for (const attribute of ['id', 'name']) {
      const values = (text) => [...text.matchAll(new RegExp(`\\s${attribute}="([^"]+)"`, 'g'))].map(m => m[1]).sort();
      const extra = attribute === 'id' ? added[page] || [] : [];
      const current = values(after);
      extra.forEach((id) => assert(current.includes(id), `${page}: added id ${id} no longer exists`));
      assert.deepEqual(current.filter((value) => !extra.includes(value)), values(before), `${page}: ${attribute} mismatch`);
    }
    assert(!after.includes('dangerouslySetInnerHTML'), `${page}: raw HTML page`);
  }
  console.log('PASS: controller syntax and 10 page IDs/names');
} else console.log('PASS: controller syntax (original repository unavailable for parity checks)');
