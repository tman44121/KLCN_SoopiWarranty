import { test } from 'node:test';
import assert from 'node:assert/strict';
import { businessTimeError, businessDayError, businessHoursNote, appointmentEnd, businessSlots, normalizeTime } from '../src/business-hours.js';
import { DEFAULT_TIME_SETTINGS, loadTimeSettings, setTimeSettings, slaHours, timeSettings } from '../src/time-settings.js';
import { filterItems, allPages } from '../src/behaviors/list-filters.js';

test('Vietnam business hours, Saturday, Sunday and closing boundary', () => {
  for (const time of ['2026-11-02T08:00', '2026-11-02T12:00', '2026-11-07T17:00']) assert.equal(businessTimeError(time), '');
  for (const time of ['2026-11-02T07:59', '2026-11-02T17:01', '2026-11-08T10:00', '2026-11-02T09:99', '2026-11-02T08:0', 'bad']) assert.ok(businessTimeError(time));
  assert.equal(appointmentEnd('2026-11-02T16:30'), '2026-11-02T17:00');
  assert.equal(appointmentEnd('2026-11-02T17:00'), '2026-11-02T17:00');
  assert.equal(businessSlots().find(s => s.value === '12:00').label, '12:00');
  assert.equal(businessSlots().at(-1).label, '17:00');
  assert.equal(businessTimeError('2026-11-02T14:37'), '');
  assert.equal(businessDayError('2026-11-08'), 'Chủ nhật không nhận lịch. Vui lòng chọn thứ Hai–thứ Bảy.');
});

test('business hours follow admin time settings', () => {
  const s = { ...DEFAULT_TIME_SETTINGS, openAt: '07:30', closeAt: '19:10', workingDays: [1, 3, 7] };
  assert.equal(businessTimeError('2026-11-08T19:00', s), '');
  assert.ok(businessTimeError('2026-11-03T10:00', s));
  assert.ok(businessTimeError('2026-11-02T19:11', s));
  assert.equal(businessHoursNote(s), 'Thứ Hai, thứ Tư, Chủ nhật, 07:30–19:10 (giờ Việt Nam).');
  assert.equal(businessDayError('2026-11-07', s), 'Thứ Bảy không nhận lịch. Vui lòng chọn thứ Hai, thứ Tư, Chủ nhật.');
  assert.deepEqual([businessSlots(s)[0].value, businessSlots(s).at(-2).value, businessSlots(s).at(-1).value], ['07:30', '19:00', '19:10']);
  assert.equal(appointmentEnd('2026-11-02T18:30', s), '2026-11-02T19:10');
  assert.equal(slaHours('EXPRESS_12H', { ...s, expressSlaHours: 6 }), 6);
  assert.equal(slaHours('STANDARD_48H'), 48);
});

test('time settings load once, fall back to defaults when the API fails', async () => {
  const calls = [];
  const loaded = await loadTimeSettings(async url => { calls.push(url); return { ok: true, json: async () => ({ standardSlaHours: 36 }) }; });
  assert.equal(loaded.standardSlaHours, 36);
  assert.equal(timeSettings().closeAt, '17:00');
  await loadTimeSettings(async () => { throw new Error('should not refetch'); });
  assert.deepEqual(calls, ['/api/v1/settings/time']);
  setTimeSettings(DEFAULT_TIME_SETTINGS);
});

test('appointment time input keeps only HH:mm digits', () => {
  const cases = { '0830': '08:30', '8:30': '08:30', '31231': '31:23', 'ab1x2': '12', '083': '08:3', '08:': '08:', '': '' };
  for (const [raw, want] of Object.entries(cases)) assert.equal(normalizeTime(raw), want, raw);
});

test('cashier reads every server page instead of silently truncating at 100', async () => {
  const calls=[];
  const rows=await allPages(async page => { calls.push(page); return {items:[page],totalPages:3,size:100,totalItems:201}; });
  assert.deepEqual(calls,[0,1,2]);
  assert.deepEqual(rows,[0,1,2]);
});

test('list search folds Vietnamese accents, inclusive date range and stable newest order', () => {
  const rows = [{code:'TN-1',receivedAt:'2026-11-02T01:00:00Z',status:'PENDING',customer:{fullName:'Đặng Ánh'}},
    {code:'TN-3',receivedAt:'2026-11-02T10:00:00Z',status:'DONE'},
    {code:'TN-2',receivedAt:'2026-11-02T01:00:00Z',status:'PENDING'}];
  assert.deepEqual(filterItems(rows, {}).map(r=>r.code), ['TN-3','TN-2','TN-1']);
  assert.equal(filterItems(rows, {q:'dang anh',from:'2026-11-02',to:'2026-11-02'})[0].code, 'TN-1');
  assert.equal(filterItems(rows, {from:'2026-11-03',to:'2026-11-02'}).length, 0);
  assert.equal(filterItems(rows, {status:'PENDING'}).length, 2);
  assert.equal(rows[0].code, 'TN-1');
});
