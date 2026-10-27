const { test } = require('node:test');
const assert = require('node:assert/strict');
const V = require('../validation.js');
const row = { mode: 'mtr', from: 'A', to: 'B', am: '', pm: '' };
const station = s => ['A', 'B'].includes(s) ? s : null;
const fare = (r, value = 5) => V.fare(r, () => value, station);
test('fare states distinguish missing, unknown, absent and genuine zero', () => {
  assert.equal(fare({ ...row, from: '' }).status, 'missing-station');
  assert.equal(fare({ ...row, from: 'X' }).status, 'unknown-station');
  assert.equal(fare(row, null).status, 'missing-fare');
  assert.equal(fare(row, 0).value, 0);
  for (const mode of ['walk', 'company']) assert.deepEqual(fare({ mode }), { value: 0, status: 'free' });
  assert.equal(fare({ mode: 'custom', customFare: '0' }).value, 0);
  assert.equal(fare({ mode: 'custom', customFare: '' }).value, null);
  assert.equal(fare({ mode: 'oops' }).value, null);
});
test('strict numeric inputs, limits and cents', () => {
  for (const raw of ['-1', '2abc', 'Infinity', Infinity, NaN, '0x10', '1e2', true, [], '1.001', '9007199254740991']) {
    assert.equal(V.decimal(raw).value, null, String(raw));
    assert.equal(fare(row, raw).value, null, String(raw));
  }
  assert.equal(V.decimal(' 0.10 ').value, .1);
  assert.equal(V.hours({ am: '', pm: '' }).value, 0);
  assert.equal(V.hours({ am: '24', pm: '0' }).value, 24);
  for (const am of ['25', '-1', '2abc', 'Infinity']) assert.equal(V.hours({ am }).value, null);
  assert.equal(V.hours({ am: '12', pm: '12.01' }).value, null);
  const t = V.totals([{ mode: 'custom', customFare: '.1' }], () => 0, station);
  assert.equal(t.custom, .1);
  assert.equal(V.totals([{ mode: 'walk', am: '13' }, { mode: 'walk', pm: '12' }], () => 0, station).hours, null);
  const exact = V.totals(['0.1', '0.2'].map(n => ({ mode: 'custom', customFare: n, am: n })), () => 0, station);
  assert.equal(exact.custom, .3); assert.equal(exact.hours, .3);
  assert.equal(V.totals([row], () => null, station).fare, null);
});
