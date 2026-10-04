// Quy tắc dùng bộ màu soopiwarranty (DESIGN.md → Colors → Named Rules): tương phản WCAG của các cặp token
// thật sự được dùng, và các cách dùng màu bị cấm. Đọc thẳng CSS nên đổi một mã màu là test báo ngay.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import initializeHtml from '../src/behaviors/html.js';
import initializeLabels from '../src/behaviors/labels.js';

const css = (name) => readFileSync(new URL(`../src/styles/${name}`, import.meta.url), 'utf8');

/* Token theo đúng thứ tự nạp: tokens.css rồi brand.css ghi đè. */
const tokens = {};
for (const file of ['tokens.css', 'brand.css']) {
  for (const [, name, hex] of css(file).matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)) tokens[name] = hex.toLowerCase();
}
const hex = (value) => (value.startsWith('#') ? value : tokens[value] ?? assert.fail(`token ${value} không có trong tokens.css/brand.css`));

const channel = (c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const luminance = (value) => {
  const h = hex(value);
  return 0.2126 * channel(parseInt(h.slice(1, 3), 16)) + 0.7152 * channel(parseInt(h.slice(3, 5), 16)) + 0.0722 * channel(parseInt(h.slice(5, 7), 16));
};
export const contrast = (fg, bg) => {
  const [a, b] = [luminance(fg), luminance(bg)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

/* Cặp chữ/nền đang dùng trong app. Thêm cặp mới vào đây trước khi dùng. */
const TEXT_PAIRS = [
  ...['--surface-card', '--surface-page', '--status-processing-bg', '--color-primary-tint', '--chart-series-2', '--color-destructive-border']
    .map((bg) => ['--text-strong', bg]),
  ...['--surface-card', '--surface-page'].map((bg) => ['--text-default', bg]),
  ...['--surface-card', '--surface-page', '--color-primary-tint', '--status-processing-bg', '--status-warning-bg'].map((bg) => ['--text-quiet', bg]),
  ...['--surface-card', '--surface-page'].map((bg) => ['--text-muted', bg]),
  ...['--surface-card', '--surface-page', '--color-primary-tint'].map((bg) => ['--color-primary', bg]),
  ...['--color-primary', '--color-primary-hover', '--color-destructive', '--surface-inverse'].map((bg) => ['#ffffff', bg]),
  ...['success', 'warning', 'danger', 'processing', 'neutral'].map((tone) => [`--status-${tone}-text`, `--status-${tone}-bg`]),
  ['--color-destructive', '--surface-card'],
  // Mật ong / Hồng đào làm chữ: chỉ trên nền tối (banner, footer, bảng tối, băng CTA).
  ...['--chart-series-2', '--color-destructive-border'].flatMap((fg) => [[fg, '--surface-inverse'], [fg, '--color-primary']]),
];

test('text/background token pairs meet WCAG AA (4.5:1)', () => {
  const failing = TEXT_PAIRS.map(([fg, bg]) => ({ fg, bg, ratio: contrast(fg, bg) })).filter((pair) => pair.ratio < 4.5);
  assert.deepEqual(failing.map((p) => `${p.fg} on ${p.bg}: ${p.ratio.toFixed(2)}:1`), []);
});

test('the calculator flags the pairs the colour rules forbid', () => {
  // Đúng các số của bản đánh giá: chữ phụ trên Mint dịu, Mật ong / Hồng đào làm chữ trên nền sáng.
  assert.equal(contrast('--text-muted', '--color-primary-tint').toFixed(2), '4.28');
  assert(contrast('--chart-series-2', '--surface-card') < 3);
  assert(contrast('--color-destructive-border', '--surface-card') < 3);
});

/* Khối rule CSS phẳng (kể cả rule nằm trong @media). */
const rules = (source) => [...source.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map(([, selector, body]) => ({ selector: selector.trim(), body }));
const customerRules = [...rules(css('customer.css')), ...rules(css('brand.css'))];

test('honey and peach are text colours only on dark surfaces', () => {
  const darkSurface = /warranty-hero-banner|lookup-form|footer|\.dark-|\.cta-/;
  const offenders = customerRules
    .filter((r) => /(^|[;\s])color:\s*var\(--(kh-honey|kh-peach|chart-series-2|color-destructive-border)\)/.test(r.body))
    .filter((r) => !darkSurface.test(r.selector))
    .map((r) => r.selector);
  assert.deepEqual(offenders, []);
});

test('muted text never sits on a tinted background in the same rule', () => {
  const tinted = /background(-color)?:\s*var\(--(kh-mint-soft|kh-lilac|kh-warn-bg|kh-bad-bg|color-primary-tint|status-[a-z]+-bg)\)/;
  const muted = /(^|[;\s])color:\s*var\(--(kh-muted|text-muted)\)/;
  assert.deepEqual(customerRules.filter((r) => tinted.test(r.body) && muted.test(r.body)).map((r) => r.selector), []);
});

test('status badges differ by icon, not colour alone', () => {
  globalThis.window = globalThis;
  initializeHtml(globalThis);
  initializeLabels();
  const { badge } = globalThis.LML_FMT;
  const icon = (tone) => {
    const markup = String(badge(tone, 'x'));
    return markup.match(/<svg class="status-badge__icon[^"]*"[\s\S]*?<\/svg>/)?.[0] ?? null;
  };
  // Tốt / cảnh báo / lỗi: mỗi tông một icon riêng, có aria-hidden (chữ của badge đã nói trạng thái).
  const good = icon('success'), warn = icon('warning'), bad = icon('danger');
  for (const markup of [good, warn, bad]) assert.match(markup ?? '', /aria-hidden="true"/);
  assert.equal(new Set([good, warn, bad]).size, 3);
  // Đang xử lý / trung tính không báo tốt-xấu nên giữ chấm, như DESIGN.md.
  for (const tone of ['processing', 'neutral']) assert.match(String(badge(tone, 'x')), /status-badge__dot/);
});

test('customer alerts carry a tone icon', () => {
  const icons = new Set();
  for (const tone of ['success', 'warning', 'error']) {
    // Gộp mọi rule có selector này (rule chung đặt mask, rule riêng đặt hình icon).
    const body = customerRules.filter((r) => r.selector.split(',').map((s) => s.trim()).includes(`.kh-alert--${tone}::before`))
      .map((r) => r.body).join(';');
    assert(/mask:/.test(body), `.kh-alert--${tone}::before thiếu mask`);
    icons.add(body.match(/--kh-alert-icon:\s*(url\([^)]*\))/)?.[1]);
  }
  assert.equal(icons.size, 3, 'mỗi tông thông báo cần một icon riêng');
  assert(!icons.has(undefined));
});
