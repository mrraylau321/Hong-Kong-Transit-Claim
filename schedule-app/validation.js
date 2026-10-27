(function (root) {
  'use strict';
  const invalid = message => ({ value: null, message });
  // Decimal input only: never accept parseFloat's partial strings, infinity or hex.
  function decimal(raw, { blank = false, max = Number.MAX_SAFE_INTEGER / 100, places = 2 } = {}) {
    if (raw == null || (typeof raw === 'string' && !raw.trim())) return blank ? { value: 0 } : invalid('請輸入金額（免費請明確填 0）');
    if (!['string', 'number'].includes(typeof raw)) return invalid('請輸入有效數字');
    const text = String(raw).trim();
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return invalid('請輸入非負十進制數字');
    const value = Number(text);
    if (!Number.isFinite(value) || value > max) return invalid(`數值須介乎 0 至 ${max}`);
    if ((text.split('.')[1] || '').length > places) return invalid(`最多 ${places} 位小數`);
    return { value };
  }
  function hours(row) {
    const am = decimal(row.am, { blank: true, max: 24 });
    const pm = decimal(row.pm, { blank: true, max: 24 });
    const errors = [];
    if (am.message) errors.push(`上午時數：${am.message}`);
    if (pm.message) errors.push(`下午時數：${pm.message}`);
    const value = errors.length ? null : (Math.round(am.value * 100) + Math.round(pm.value * 100)) / 100;
    if (value > 24) errors.push('行程工作時數不可超過 24 小時');
    return { am: am.value, pm: pm.value, value: errors.length ? null : value, errors };
  }
  function fare(row, lookup, station) {
    if (row.mode === 'walk' || row.mode === 'company') return { value: 0, status: 'free' };
    if (row.mode === 'custom') {
      const result = decimal(row.customFare);
      return { ...result, status: result.message ? 'invalid-custom' : 'custom' };
    }
    if (row.mode !== 'mtr') return { ...invalid('請選擇有效交通方式'), status: 'invalid-mode' };
    if (![row.from, row.to].every(v => typeof v === 'string' && v.trim())) return { ...invalid('請選擇港鐵起點站及終點站'), status: 'missing-station' };
    if (station(row.from) == null || station(row.to) == null) return { ...invalid('無法識別港鐵車站，請重新選擇'), status: 'unknown-station' };
    const raw = lookup(row.from, row.to);
    if (raw == null) return { ...invalid('查無港鐵票價組合；請核對車站，或選自訂車費並填入已核實金額'), status: 'missing-fare' };
    const result = decimal(raw);
    if (result.message) return { ...invalid('港鐵票價資料無效'), status: 'invalid-fare' };
    return { value: result.value, status: 'mtr' };
  }
  function totals(rows, lookup, station) {
    let h = 0, m = 0, c = 0, validH = true, validM = true, validC = true;
    const errors = [];
    rows.forEach((row, index) => {
      const hr = hours(row), fr = fare(row, lookup, station);
      hr.errors.forEach(message => errors.push({ index, message }));
      if (fr.message) errors.push({ index, message: fr.message });
      if (hr.value == null) validH = false; else h += Math.round(hr.value * 100);
      if (fr.value == null) {
        if (row.mode === 'custom') validC = false; else validM = false;
      } else if (row.mode === 'mtr') m += Math.round(fr.value * 100);
      else if (row.mode === 'custom') c += Math.round(fr.value * 100);
    });
    if (h > 2400) { validH = false; errors.push({ index: null, message: '全日工作時數不可超過 24 小時（包括所有行程）' }); }
    if (!Number.isSafeInteger(m + c)) { validM = validC = false; errors.push({ index: null, message: '全日車費超出可精確計算範圍' }); }
    return { hours: validH ? h / 100 : null, fare: validM ? m / 100 : null, custom: validC ? c / 100 : null, errors };
  }
  const api = { decimal, hours, fare, totals };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RECValidation = api;
})(typeof window === 'undefined' ? globalThis : window);
