const { chromium } = require('D:/huit/khoaluan/source/warranty-system-mysql/e2e/node_modules/playwright-core');
const path = require('path');
const { pathToFileURL } = require('url');
(async () => {
  const svg = path.resolve(process.argv[2]); const out = process.argv[3]; const scale = Number(process.argv[4] || 2);
  const b = await chromium.launch({ channel: 'msedge', headless: true });
  const p = await b.newPage({ deviceScaleFactor: scale });
  await p.goto(pathToFileURL(svg).href);
  const el = await p.$('svg'); await el.screenshot({ path: out });
  await b.close(); console.log('ok', out);
})();
