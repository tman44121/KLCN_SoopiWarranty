import test from 'node:test';
import assert from 'node:assert/strict';
import { modelOptions } from '../src/model-options.js';

test('model suggestions preserve catalog identity and disambiguate duplicate names', () => {
  const products = [
    { code: 'A', brandName: 'Samsung', name: 'Galaxy S24', deviceTypeCode: 'PHONE' },
    { code: 'B', brandName: 'Samsung', name: 'Galaxy S24', deviceTypeCode: 'TABLET' },
    { code: 'C', brandName: null, name: 'Máy mẫu', deviceTypeCode: 'OTHER' },
  ];
  const options = modelOptions(products);
  assert.deepEqual(options.map(p => p.label), ['Samsung Galaxy S24 (A)', 'Samsung Galaxy S24 (B)', 'Máy mẫu']);
  assert.equal(options.find(p => p.label === 'Samsung Galaxy S24 (B)').deviceTypeCode, 'TABLET');
  assert.equal(options.find(p => p.label === 'Model tự nhập'), undefined);
  assert.deepEqual(modelOptions([]), []);
  assert.equal(products[0].label, undefined);
});
