const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scripts = ['fares-data.js', 'xlsx.full.min.js', 'validation.js', 'app.js'].map(file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8'));
const base = { am: '2.5', pm: '1', district: '沙田', contract: '9911-4433-S3', venue: '新城市廣場', mode: 'mtr', from: '葵芳 (Kwai Fong)', to: '沙田 (Sha Tin)', customFare: '', companions: '', remarks: '' };
async function load(days) {
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
  const w = dom.window;
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  w.localStorage.setItem('rec-schedule-v1', JSON.stringify({ group: '第一組', months: { [month]: { days } } }));
  scripts.forEach(script => w.eval(script));
  const locator = selector => ({
    click: async () => w.document.querySelector(selector).click(),
    innerText: async () => w.document.querySelector(selector).textContent,
    first: () => locator(selector),
  });
  const page = {
    evaluate: async fn => { const result = w.eval(`(${fn.toString()})()`); return result === undefined ? undefined : JSON.parse(JSON.stringify(result)); },
    locator,
    close: async () => w.close(),
  };
  await page.evaluate(() => {
    window.exports = []; window.alerts = [];
    window.alert = message => alerts.push(message);
    XLSX.writeFile = (wb, name) => {
      // Round-trip actual XLSX bytes, not just a mocked array builder.
      const read = XLSX.read(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }), { type: 'array' });
      exports.push({ name, rows: XLSX.utils.sheet_to_json(read.Sheets[read.SheetNames[0]], { header: 1, defval: '' }) });
    };
  });
  return page;
}
async function exportBoth(page) {
  await page.locator('#btn-xl-schedule').click(); await page.locator('#btn-xl-fare').click();
  return page.evaluate(() => ({ exports, alerts }));
}
test('both exports reject invalid persisted rows with date and row; totals never show zero', async () => {
  for (const patch of [{ from: '' }, { to: '不存在' }, { mode: 'custom', customFare: '-1' }, { mode: 'custom', customFare: '' }, { am: '2abc' }, { pm: '25' }, { mode: 'unknown' }]) {
    const page = await load({ 1: { startPoint: '葵涌公司', rows: [{ ...base, ...patch }] } });
    const before = await page.evaluate(() => localStorage.getItem('rec-schedule-v1'));
    const result = await exportBoth(page);
    assert.equal(result.exports.length, 0);
    assert.equal(result.alerts.length, 2); assert.match(result.alerts[0], /-01 行程 1/);
    assert.equal(await page.evaluate(() => localStorage.getItem('rec-schedule-v1')), before);
    assert.match(await page.locator(patch.am || patch.pm ? '#month-hours' : '#month-fare').innerText(), /待修正/);
    await page.close();
  }
});
test('missing fare pair is blocked even when both stations are valid', async () => {
  const page = await load({ 1: { rows: [base] } });
  await page.evaluate(() => { const a = MTR_FARES.stations.find(s => s.zh === '葵芳'); const b = MTR_FARES.stations.find(s => s.zh === '沙田'); delete MTR_FARES.fares[`${a.id}-${b.id}`]; });
  const result = await exportBoth(page);
  assert.equal(result.exports.length, 0); assert.match(result.alerts[0], /查無港鐵票價組合/);
  await page.close();
});
test('mixed modes, custom zero, daily/month totals and actual workbook rows agree', async () => {
  const rows = [base, ...['walk', 'company'].map(mode => ({ ...base, mode })), ...['0', '0.10', '0.20'].map(customFare => ({ ...base, mode: 'custom', customFare, am: '.bad' }))];
  rows.forEach((r, i) => { if (i > 2) { r.am = '0.1'; r.pm = '0.2'; } });
  const page = await load({ 1: { rows }, 2: { rows: [{ ...base, mode: 'custom', customFare: '0.10' }] } });
  const result = await exportBoth(page);
  assert.deepEqual(result.alerts, []); assert.equal(result.exports.length, 2);
  const [schedule, fares] = result.exports.map(x => x.rows);
  const sr = schedule.slice(3, 10), fr = fares.slice(3, 10);
  assert.deepEqual(sr.map(r => r.slice(0, 3)), fr.map(r => r.slice(0, 3)));
  assert.equal(schedule.at(-1)[8], 14.9);
  assert.equal(fares.at(-2)[6], .4);
  assert.equal(Math.round(fares.at(-1)[6] * 100), Math.round(fares.at(-3)[6] * 100) + 40);
  assert.equal(fr[3][6], 0);
  assert.equal(await page.locator('#month-fare').innerText(), `HK$ ${fares.at(-1)[6].toFixed(2)}`);
  assert.equal(await page.locator('#month-hours').innerText(), '14.9 小時');
  await page.locator('.day:not(.empty)').first().click();
  assert.equal(await page.locator('#drawer-hours').innerText(), '11.4 小時');
  assert.equal(await page.locator('#drawer-fare').innerText(), `HK$ ${fares.at(-3)[6].toFixed(2)}`);
  await page.close();
});
test('daily limit across multiple rows blocks both exports; blank month is valid', async () => {
  const page = await load({ 1: { rows: [13, 12].map(am => ({ ...base, am, pm: '' })) } });
  const result = await exportBoth(page); assert.equal(result.exports.length, 0); assert.match(result.alerts[0], /全日工作時數/);
  await page.close();
  const empty = await load({}); assert.equal((await exportBoth(empty)).exports.length, 2); await empty.close();
});
test('existing built-in test data exports consistently using a deterministic random seed', async () => {
  const page = await load({});
  await page.evaluate(() => { let seed = 42; Math.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296); window.confirm = () => true; });
  await page.locator('#btn-testdata').click();
  const result = await exportBoth(page);
  assert.deepEqual(result.alerts, []); assert.equal(result.exports.length, 2);
  const [s, f] = result.exports.map(x => x.rows);
  const sr = s.filter(r => /^Row /.test(r[2])), fr = f.filter(r => /^Row /.test(r[2]));
  assert.ok(sr.length > 0); assert.deepEqual(sr.map(r => r.slice(0, 3)), fr.map(r => r.slice(0, 3)));
  assert.equal(s.at(-1)[8], sr.reduce((a, r) => a + r[8], 0));
  assert.equal(Math.round(f.at(-1)[6] * 100), fr.reduce((a, r) => a + Math.round(r[6] * 100), 0));
  await page.close();
});
test('fare table zero is exported as numeric zero, not treated as missing', async () => {
  const page = await load({ 1: { rows: [base] } });
  await page.evaluate(() => { const a = MTR_FARES.stations.find(s => s.zh === '葵芳'); const b = MTR_FARES.stations.find(s => s.zh === '沙田'); MTR_FARES.fares[`${a.id}-${b.id}`] = 0; });
  const result = await exportBoth(page);
  assert.deepEqual(result.alerts, []); assert.equal(result.exports[1].rows[3][6], 0);
  await page.close();
});
test('editing custom cents keeps legacy schema and row error clears on correction', async () => {
  const page = await load({ 1: { startPoint: '葵涌公司', rows: [{ ...base, mode: 'custom', customFare: '' }] } });
  await page.locator('.day:not(.empty)').first().click();
  assert.match(await page.locator('.validation-error').innerText(), /請輸入金額/);
  await page.evaluate(() => {
    const input = document.querySelectorAll('#rows input[type=number]')[2];
    input.value = '0.25'; input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('rec-schedule-v1')));
  const r = Object.values(saved.months)[0].days[1].rows[0];
  assert.deepEqual(Object.keys(r).sort(), Object.keys(base).sort()); assert.equal(r.customFare, '0.25');
  const result = await exportBoth(page); assert.deepEqual(result.alerts, []); assert.equal(result.exports[1].rows[3][6], .25);
  await page.close();
});
