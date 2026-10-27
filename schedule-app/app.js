(function () {
  const DATA = window.MTR_FARES;
  const V = window.RECValidation;
  const add = (a, b) => {
    if (a == null || b == null) return null;
    const units = Math.round(a * 100) + Math.round(b * 100);
    return Number.isSafeInteger(units) ? units / 100 : null;
  };
  if (!DATA) { document.body.innerHTML = '<p style="padding:20px">載入車費資料失敗，請確認 fares-data.js 同 index.html 喺同一個資料夾。</p>'; return; }
  const label = s => `${s.zh} (${s.en})`;
  const idOf = new Map(DATA.stations.map(s => [label(s), s.id]));
  const zhOf = new Map(DATA.stations.map(s => [s.zh, s.id]));
  function parseStation(text) {
    if (typeof text !== 'string' || !text) return null;
    const t = text.trim();
    if (idOf.has(t)) return idOf.get(t);
    if (zhOf.has(t)) return zhOf.get(t);
    return null;
  }
  function fareFor(from, to) {
    const f = DATA.fares[`${parseStation(from)}-${parseStation(to)}`];
    return f == null ? null : f;
  }
  const fmt = n => n == null ? '待修正' : 'HK$ ' + n.toFixed(2);
  const fmtH = h => h == null ? '待修正' : h.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2, useGrouping: false }) + 'h';
  const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
  const MODES = { mtr: '港鐵八達通成人', walk: '步行 ($0)', company: '公司車 ($0)', custom: '自訂車費 ($)' };

  function buildStationSelect(current) {
    const sel = document.createElement('select');
    const empty = document.createElement('option');
    empty.value = ''; empty.textContent = '— 選擇車站 —';
    sel.appendChild(empty);
    const seen = new Set();
    DATA.lines.forEach(line => {
      const g = document.createElement('optgroup'); g.label = line.name;
      line.stations.forEach(id => {
        if (seen.has(id)) return;
        seen.add(id);
        const s = DATA.stations.find(x => x.id === id);
        if (!s) return;
        const o = document.createElement('option'); o.value = label(s); o.textContent = label(s);
        g.appendChild(o);
      });
      if (g.children.length) sel.appendChild(g);
    });
    sel.value = current || '';
    return sel;
  }

  // ---------- store ----------
  const LS_KEY = 'rec-schedule-v1';
  let store = {};
  try { store = JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch (e) { store = {}; }
  if (!store.months) store.months = {};
  if (!store.group) store.group = '第一組';
  function save() { localStorage.setItem(LS_KEY, JSON.stringify(store)); }
  function monthData() {
    const k = monthPicker.value;
    if (!store.months[k]) store.months[k] = { days: {} };
    return store.months[k];
  }
  function blankRow() {
    return { am: '', pm: '', district: '', contract: '', venue: '', mode: 'mtr', from: '', to: '', customFare: '', companions: '', remarks: '' };
  }
  function dayData(d) {
    const md = monthData();
    if (!md.days[d]) md.days[d] = { startPoint: '葵涌公司', rows: [] };
    return md.days[d];
  }
  function rowFare(row) { return V.fare(row, fareFor, parseStation).value; }
  function rowHours(row) { return V.hours(row).value; }
  function dayTotals(d) {
    return V.totals(monthData().days[d]?.rows || [], fareFor, parseStation);
  }

  // ---------- calendar ----------
  const monthPicker = document.getElementById('month-picker');
  const now = new Date();
  monthPicker.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const groupEl = document.getElementById('group-name');
  groupEl.value = store.group;
  groupEl.addEventListener('change', () => { store.group = groupEl.value; save(); });

  function shiftMonth(delta) {
    const [y, m] = monthPicker.value.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    monthPicker.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    render();
  }
  document.getElementById('btn-prev').addEventListener('click', () => shiftMonth(-1));
  document.getElementById('btn-next').addEventListener('click', () => shiftMonth(1));
  document.getElementById('btn-today').addEventListener('click', () => {
    monthPicker.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    render();
  });
  monthPicker.addEventListener('change', render);

  function render() {
    const [y, m] = monthPicker.value.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const firstOffset = (new Date(y, m - 1, 1).getDay() + 6) % 7; // Mon-first
    const body = document.getElementById('cal-body');
    body.innerHTML = '';
    let totH = 0, totF = 0, totC = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const t = dayTotals(d);
      totH = add(totH, t.hours); totF = add(totF, t.fare); totC = add(totC, t.custom);
    }
    document.getElementById('month-hours').textContent = fmtH(totH).replace('h', ' 小時');
    document.getElementById('month-fare').textContent = fmt(add(totF, totC));

    for (let i = 0; i < firstOffset; i++) {
      const e = document.createElement('div'); e.className = 'day empty'; body.appendChild(e);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(y, m - 1, d);
      const wd = dt.getDay();
      const t = dayTotals(d);
      const day = monthData().days[d];
      const cell = document.createElement('div');
      cell.className = 'day';
      if (y === now.getFullYear() && m === now.getMonth() + 1 && d === now.getDate()) cell.classList.add('today');
      const top = document.createElement('div'); top.className = 'd-top';
      const num = document.createElement('span'); num.className = 'd-num' + ((wd === 0 || wd === 6) ? ' we' : '');
      num.textContent = d;
      top.appendChild(num);
      if (t.hours == null || t.hours > 0) {
        const b = document.createElement('span'); b.className = 'hours-badge'; b.textContent = fmtH(t.hours);
        top.appendChild(b);
      }
      cell.appendChild(top);
      if (day) {
        const venues = day.rows.map(r => r.venue).filter(Boolean);
        venues.slice(0, 3).forEach(v => {
          const el = document.createElement('div'); el.className = 'venue'; el.textContent = v;
          cell.appendChild(el);
        });
        if (venues.length > 3) {
          const el = document.createElement('div'); el.className = 'more';
          el.textContent = `+ 還有${venues.length - 3}項...`;
          cell.appendChild(el);
        }
      }
      cell.addEventListener('click', () => openDrawer(d));
      body.appendChild(cell);
    }
  }

  // ---------- drawer ----------
  const drawer = document.getElementById('drawer');
  const backdrop = document.getElementById('backdrop');
  let currentDay = null;
  function closeDrawer() { drawer.classList.add('hidden'); backdrop.classList.add('hidden'); currentDay = null; render(); }
  document.getElementById('drawer-close').addEventListener('click', closeDrawer);
  document.getElementById('drawer-done').addEventListener('click', closeDrawer);
  backdrop.addEventListener('click', closeDrawer);

  function openDrawer(d) {
    currentDay = d;
    const [y, m] = monthPicker.value.split('-').map(Number);
    const wd = WEEKDAYS[new Date(y, m - 1, d).getDay()];
    document.getElementById('drawer-title').textContent = `${y}年${m}月${d}日（星期${wd}）`;
    document.getElementById('drawer-sub').textContent = `所屬分組：${store.group || '—'}`;
    drawer.classList.remove('hidden'); backdrop.classList.remove('hidden');
    renderDrawer();
  }

  function field(labelText, el) {
    const w = document.createElement('div'); w.className = 'field';
    const l = document.createElement('label'); l.textContent = labelText;
    w.append(l, el); return w;
  }
  function textInput(value, placeholder, onChange) {
    const i = document.createElement('input'); i.type = 'text'; i.value = value || ''; i.placeholder = placeholder || '';
    i.addEventListener('change', () => { onChange(i.value); save(); renderDrawer(); });
    return i;
  }
  function numInput(value, onChange, isFare = false) {
    const i = document.createElement('input'); i.type = 'number'; i.min = '0'; i.step = '0.01'; i.max = isFare ? String(Number.MAX_SAFE_INTEGER / 100) : '24'; i.value = value;
    i.addEventListener('change', () => { onChange(i.value); save(); renderDrawer(); });
    return i;
  }

  function renderDrawer() {
    if (currentDay == null) return;
    const day = dayData(currentDay);
    const t = dayTotals(currentDay);
    document.getElementById('drawer-hours').textContent = fmtH(t.hours).replace('h', ' 小時');
    document.getElementById('drawer-fare').textContent = fmt(t.fare);
    document.getElementById('drawer-fare-foot').textContent = fmt(t.fare);

    const sp = document.getElementById('start-point');
    sp.value = day.startPoint || '';
    sp.onchange = () => { day.startPoint = sp.value; save(); };

    const rowsBox = document.getElementById('rows');
    rowsBox.innerHTML = '';
    day.rows.forEach((row, i) => {
      const card = document.createElement('section'); card.className = 'card row-card';
      const tools = document.createElement('div'); tools.className = 'row-tools';
      const up = document.createElement('button'); up.className = 'btn-mini'; up.textContent = '↑';
      up.disabled = i === 0;
      up.addEventListener('click', () => { [day.rows[i - 1], day.rows[i]] = [day.rows[i], day.rows[i - 1]]; save(); renderDrawer(); });
      const dn = document.createElement('button'); dn.className = 'btn-mini'; dn.textContent = '↓';
      dn.disabled = i === day.rows.length - 1;
      dn.addEventListener('click', () => { [day.rows[i], day.rows[i + 1]] = [day.rows[i + 1], day.rows[i]]; save(); renderDrawer(); });
      const del = document.createElement('button'); del.className = 'btn-mini danger'; del.textContent = '刪除';
      del.addEventListener('click', () => { day.rows.splice(i, 1); save(); renderDrawer(); });
      tools.append(up, dn, del);
      card.appendChild(tools);

      const h = document.createElement('h3'); h.textContent = `Row ${i + 1} 行程`;
      card.appendChild(h);

      const gHours = document.createElement('div'); gHours.className = 'grid3';
      gHours.append(
        field('工作時間：上午', numInput(row.am, v => row.am = v)),
        field('下午', numInput(row.pm, v => row.pm = v)),
        field('合計', (() => { const s = document.createElement('div'); s.style.paddingTop = '22px'; s.innerHTML = `<strong>${fmtH(rowHours(row))}</strong>`; return s; })())
      );
      card.appendChild(gHours);

      const gMeta = document.createElement('div'); gMeta.className = 'grid3';
      gMeta.append(
        field('地區 (DISTRICT)', textInput(row.district, '例如：沙田', v => row.district = v)),
        field('合約編號', textInput(row.contract, '例如：9911-4433-S3', v => row.contract = v)),
        field('場地名稱', textInput(row.venue, '例如：新城市廣場', v => row.venue = v))
      );
      card.appendChild(gMeta);

      const modeSel = document.createElement('select');
      Object.entries(MODES).forEach(([v, t]) => {
        const o = document.createElement('option'); o.value = v; o.textContent = t; modeSel.appendChild(o);
      });
      modeSel.value = row.mode;
      modeSel.addEventListener('change', () => { row.mode = modeSel.value; save(); renderDrawer(); });
      const gMode = document.createElement('div'); gMode.className = 'grid2';
      gMode.append(field('交通方式', modeSel));
      if (row.mode === 'mtr') {
        const sF = buildStationSelect(row.from);
        sF.addEventListener('change', () => { row.from = sF.value; save(); renderDrawer(); });
        const sT = buildStationSelect(row.to);
        sT.addEventListener('change', () => { row.to = sT.value; save(); renderDrawer(); });
        const gSt = document.createElement('div'); gSt.className = 'grid2';
        gSt.append(field('起點站', sF), field('終點站', sT));
        card.append(gMode, gSt);
        const result = V.fare(row, fareFor, parseStation);
        const fl = document.createElement('div'); fl.className = 'fare-line';
        fl.textContent = `預算車費：${result.message || fmt(result.value)}`;
        card.appendChild(fl);
      } else if (row.mode === 'custom') {
        gMode.append(field('自訂車費 (HK$)', numInput(row.customFare, v => row.customFare = v, true)));
        card.appendChild(gMode);
      } else {
        card.appendChild(gMode);
      }

      const gMisc = document.createElement('div'); gMisc.className = 'grid2';
      gMisc.append(
        field('隨行人員', textInput(row.companions, '', v => row.companions = v)),
        field('備註 (REMARKS)', textInput(row.remarks, '', v => row.remarks = v))
      );
      card.appendChild(gMisc);

      const cp = document.createElement('button'); cp.className = 'btn-mini'; cp.textContent = '複製此行程';
      cp.addEventListener('click', () => {
        day.rows.splice(i + 1, 0, JSON.parse(JSON.stringify(row))); save(); renderDrawer();
      });
      card.appendChild(cp);
      const issues = t.errors.filter(e => e.index === i || (e.index == null && i === 0));
      if (issues.length) {
        const warning = document.createElement('p'); warning.className = 'validation-error';
        warning.setAttribute('role', 'alert'); warning.textContent = issues.map(e => e.message).join('；');
        card.appendChild(warning);
      }
      rowsBox.appendChild(card);
    });
  }

  document.getElementById('btn-add-row').addEventListener('click', () => {
    dayData(currentDay).rows.push(blankRow()); save(); renderDrawer();
  });
  document.getElementById('btn-copy-day').addEventListener('click', () => {
    const target = prompt('複製去邊一日？（輸入本月日期數字，例如 15）');
    const d = parseInt(target, 10);
    const [y, m] = monthPicker.value.split('-').map(Number);
    if (!d || d < 1 || d > new Date(y, m, 0).getDate()) { alert('日期無效'); return; }
    const src = dayData(currentDay);
    monthData().days[d] = JSON.parse(JSON.stringify(src));
    save(); alert(`已複製去 ${m}/${d}`);
  });

  document.getElementById('btn-clear').addEventListener('click', () => {
    if (!confirm('確定清除本月全部行程？')) return;
    monthData().days = {}; save(); render();
  });

  // ---------- test data ----------
  const VENUES = [
    ['新城市廣場', '沙田', '沙田 (Sha Tin)'], ['西九龍中心', '深水埗', '南昌 (Nam Cheong)'],
    ['旺角警署', '旺角', '旺角 (Mong Kok)'], ['紅磡警署', '紅磡', '何文田 (Ho Man Tin)'],
    ['金鐘太古廣場', '金鐘', '金鐘 (Admiralty)'], ['太古城中心', '太古', '太古 (Tai Koo)'],
    ['新蒲崗廣場', '新蒲崗', '鑽石山 (Diamond Hill)'], ['荃灣廣場', '荃灣', '荃灣 (Tsuen Wan)'],
    ['葵涌廣場', '葵涌', '葵興 (Kwai Hing)'], ['觀塘廣場', '觀塘', '觀塘 (Kwun Tong)'],
    ['大埔超級城', '大埔', '大埔墟 (Tai Po Market)'], ['元朗廣場', '元朗', '元朗 (Yuen Long)'],
    ['屯門市廣場', '屯門', '屯門 (Tuen Mun)'], ['沙田警署', '沙田', '沙田 (Sha Tin)'],
  ];
  const CONTRACTS = ['9911-4433-S3', '8820-1176-K2', '7734-9021-T1', '6651-3308-M4'];
  const pick = a => a[Math.floor(Math.random() * a.length)];
  document.getElementById('btn-testdata').addEventListener('click', () => {
    if (!confirm('生成測試數據會覆蓋本月現有行程，繼續？')) return;
    const [y, m] = monthPicker.value.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const md = monthData();
    md.days = {};
    for (let d = 1; d <= daysInMonth; d++) {
      const wd = new Date(y, m - 1, d).getDay();
      if (wd === 0 || wd === 6) continue;
      if (Math.random() < 0.25) continue;
      const n = 1 + Math.floor(Math.random() * 3);
      const rows = [];
      let prev = '葵芳 (Kwai Fong)';
      for (let i = 0; i < n; i++) {
        const [venue, district, station] = pick(VENUES);
        const r = blankRow();
        r.am = pick(['2', '2.5', '3', '3.5', '4']);
        r.pm = pick(['1', '1.5', '2', '2.5', '3', '4']);
        r.district = district; r.contract = pick(CONTRACTS); r.venue = venue;
        r.mode = Math.random() < 0.85 ? 'mtr' : pick(['walk', 'company']);
        r.from = prev; r.to = station;
        prev = station;
        rows.push(r);
      }
      md.days[d] = { startPoint: '葵涌公司', rows };
    }
    save(); render();
  });

  // ---------- Excel exports ----------
  function monthRows() {
    const [y, m] = monthPicker.value.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const out = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const day = monthData().days[d];
      if (!day) continue;
      day.rows.forEach((r, i) => out.push({ d, wd: WEEKDAYS[new Date(y, m - 1, d).getDay()], i: i + 1, r }));
    }
    return out;
  }
  function validatedMonthRows() {
    // Commit the currently edited field before taking either export snapshot.
    if (document.activeElement && typeof document.activeElement.blur === 'function') document.activeElement.blur();
    const rows = monthRows();
    const errors = [];
    const days = [...new Set(rows.map(row => row.d))];
    let totalFare = 0;
    days.forEach(d => {
      const totals = dayTotals(d);
      totals.errors.forEach(e => errors.push(`${monthPicker.value}-${String(d).padStart(2, '0')} ${e.index == null ? '全日' : `行程 ${e.index + 1}`}：${e.message}`));
      if (totals.fare != null && totals.custom != null) totalFare += Math.round(totals.fare * 100) + Math.round(totals.custom * 100);
    });
    if (!Number.isSafeInteger(totalFare)) errors.push('本月車費超出可精確計算範圍');
    if (errors.length) {
      alert('未能匯出 Excel，請先修正以下資料：\n\n' + errors.join('\n'));
      return null;
    }
    return rows;
  }
  function saveXlsx(wb, filename) { XLSX.writeFile(wb, filename); }

  document.getElementById('btn-xl-schedule').addEventListener('click', () => {
    const [y, m] = monthPicker.value.split('-').map(Number);
    const rows = validatedMonthRows();
    if (!rows) return;
    const aoa = [
      [`${y}年${m}月 工程行程表`, `所屬分組：${store.group || ''}`],
      [],
      ['日期', '星期', '行程', '地區', '合約編號', '場地名稱', '上午時數', '下午時數', '合計時數', '隨行人員', '備註'],
    ];
    let totH = 0;
    rows.forEach(({ d, wd, i, r }) => {
      const h = rowHours(r); totH = add(totH, h);
      aoa.push([`${m}/${d}`, wd, `Row ${i}`, r.district, r.contract, r.venue,
        V.hours(r).am, V.hours(r).pm, h, r.companions, r.remarks]);
    });
    aoa.push([]);
    aoa.push(['本月合計時數', '', '', '', '', '', '', '', totH, '', '']);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 8 }, { wch: 6 }, { wch: 8 }, { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '行程表');
    saveXlsx(wb, `行程表_${monthPicker.value}.xlsx`);
  });

  document.getElementById('btn-xl-fare').addEventListener('click', () => {
    const [y, m] = monthPicker.value.split('-').map(Number);
    const rows = validatedMonthRows();
    if (!rows) return;
    const aoa = [
      [`${y}年${m}月 車費表`, `所屬分組：${store.group || ''}`],
      [],
      ['日期', '星期', '行程', '起點站', '終點站', '交通方式', '車費 (HK$)'],
    ];
    let totM = 0, totC = 0;
    rows.forEach(({ d, wd, i, r }) => {
      const f = rowFare(r);
      if (r.mode === 'mtr') totM = add(totM, f);
      if (r.mode === 'custom') totC = add(totC, f);
      aoa.push([`${m}/${d}`, wd, `Row ${i}`,
        r.mode === 'mtr' ? r.from : '', r.mode === 'mtr' ? r.to : '',
        MODES[r.mode], f]);
    });
    aoa.push([]);
    aoa.push(['八達通成人小計', '', '', '', '', '', totM]);
    aoa.push(['自訂車費小計', '', '', '', '', '', totC]);
    aoa.push(['本月合計車費', '', '', '', '', '', add(totM, totC)]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 8 }, { wch: 6 }, { wch: 8 }, { wch: 22 }, { wch: 22 }, { wch: 18 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '車費表');
    saveXlsx(wb, `車費表_${monthPicker.value}.xlsx`);
  });

  render();
})();
