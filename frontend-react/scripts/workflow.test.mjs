import { test } from 'node:test';
import assert from 'node:assert/strict';
import { businessTimeError, appointmentEnd, businessSlots } from '../src/business-hours.js';
import { filterItems, allPages } from '../src/behaviors/list-filters.js';

test('Vietnam business hours, Saturday, Sunday and closing boundary', () => {
  for (const time of ['2026-11-02T08:00', '2026-11-02T12:00', '2026-11-07T17:00']) assert.equal(businessTimeError(time), '');
  for (const time of ['2026-11-02T07:59', '2026-11-02T17:01', '2026-11-08T10:00', 'bad']) assert.ok(businessTimeError(time));
  assert.equal(appointmentEnd('2026-11-02T16:30'), '2026-11-02T17:00');
  assert.equal(appointmentEnd('2026-11-02T17:00'), '2026-11-02T17:00');
  assert.equal(businessSlots.find(s => s.value === '12:00').label, '12:00 PM');
  assert.equal(businessSlots.at(-1).label, '05:00 PM');
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
