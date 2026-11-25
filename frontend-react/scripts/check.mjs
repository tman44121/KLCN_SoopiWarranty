import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
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
console.log('PASS: controller syntax');
