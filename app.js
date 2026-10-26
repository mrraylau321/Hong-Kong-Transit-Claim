(function () {
  const DATA = window.MTR_FARES;
  if (!DATA) { document.body.innerHTML = '<p style="padding:20px">載入車費資料失敗，請確認 fares-data.js 同 index.html 喺同一個資料夾。</p>'; return; }
  const label = s => `${s.zh} (${s.en})`;
  const labelMap = new Map(DATA.stations.map(s => [label(s), s.id]));
  const zhMap = new Map(DATA.stations.map(s => [s.zh, s.id]));
  const enMap = new Map(DATA.stations.map(s => [s.en.toLowerCase(), s.id]));

  function parseStation(text) {
    if (!text) return null;
    const t = text.trim();
    if (labelMap.has(t)) return labelMap.get(t);
    if (zhMap.has(t)) return zhMap.get(t);
    const low = t.toLowerCase();
    if (enMap.has(low)) return enMap.get(low);
    return null;
  }
  function fareFor(fromId, toId) {
    if (fromId == null || toId == null) return null;
    const v = DATA.fares[`${fromId}-${toId}`];
    return v == null ? null : v;
  }
  const fmt = n => 'HK$ ' + (n || 0).toFixed(2);
  const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
  const LEG_NAMES = ['第一程', '第二程', '第三程', '第四程', '第五程', '第六程', '第七程', '第八程'];
  const legName = i => LEG_NAMES[i] || `第${i + 1}程`;

  const LS_KEY = 'transport-claim-v1';
  let store = {};
  try { store = JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch (e) { store = {}; }
  function save() { localStorage.setItem(LS_KEY, JSON.stringify(store)); }

  const monthPicker = document.getElementById('month-picker');
  const claimantEl = document.getElementById('claimant');
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  monthPicker.value = thisMonth;

  function blankLeg() { return { type: 'none', from: '', to: '', route: '', amount: '' }; }
  function migrateDay(d) {
    // old shape {out, back} -> {legs:[...]}
    if (d && d.out) return { legs: [d.out, d.back || blankLeg()] };
    if (d && d.legs) return d;
    return { legs: [blankLeg(), blankLeg()] };
  }
  function monthState() {
    const k = monthPicker.value;
    if (!store[k]) store[k] = { claimant: claimantEl.value || '', days: {} };
    return store[k];
  }
  function dayData(d) {
    const st = monthState();
    if (!st.days[d]) st.days[d] = { legs: [blankLeg(), blankLeg()] };
    else st.days[d] = migrateDay(st.days[d]);
    return st.days[d];
  }
  function legFare(leg) {
    if (leg.type === 'mtr') {
      const f = fareFor(parseStation(leg.from), parseStation(leg.to));
      return f == null ? 0 : f;
    }
    if (leg.type === 'bus') {
      const n = parseFloat(leg.amount);
      return isNaN(n) ? 0 : n;
    }
    return 0;
  }
  function legText(leg) {
    if (leg.type === 'mtr') return `港鐵 ${leg.from} → ${leg.to}`;
    if (leg.type === 'bus') return `巴士${leg.route ? ' ' + leg.route : ''}`;
    return '—';
  }

  // ---- station select (grouped by line, each station once) ----
  function buildStationSelect(currentValue) {
    const sel = document.createElement('select');
    const empty = document.createElement('option');
    empty.value = ''; empty.textContent = '— 選擇車站 —';
    sel.appendChild(empty);
    const seen = new Set();
    DATA.lines.forEach(line => {
      const group = document.createElement('optgroup');
      group.label = line.name;
      line.stations.forEach(id => {
        if (seen.has(id)) return;
        seen.add(id);
        const s = DATA.stations.find(x => x.id === id);
        if (!s) return;
        const o = document.createElement('option');
        o.value = label(s); o.textContent = label(s);
        group.appendChild(o);
      });
      if (group.children.length) sel.appendChild(group);
    });
    // any station not in a line group
    DATA.stations.forEach(s => {
      if (seen.has(s.id)) return;
      const o = document.createElement('option');
      o.value = label(s); o.textContent = label(s);
      sel.appendChild(o);
    });
    sel.value = currentValue || '';
    return sel;
  }

  // ---- leg editor (shared by grid + quickfill) ----
  function legEditor(leg, onChange, removable, onRemove, name) {
    const wrap = document.createElement('div');
    wrap.className = 'leg';
    const nm = document.createElement('span');
    nm.className = 'leg-name'; nm.textContent = name;
    wrap.appendChild(nm);

    const sel = document.createElement('select');
    [['none', '—'], ['mtr', '港鐵'], ['bus', '巴士']].forEach(([v, t]) => {
      const o = document.createElement('option'); o.value = v; o.textContent = t; sel.appendChild(o);
    });
    sel.value = leg.type;
    sel.addEventListener('change', () => { leg.type = sel.value; save(); onChange(); });
    wrap.appendChild(sel);

    if (leg.type === 'mtr') {
      const sF = buildStationSelect(leg.from);
      sF.addEventListener('change', () => { leg.from = sF.value; save(); onChange(); });
      const sT = buildStationSelect(leg.to);
      sT.addEventListener('change', () => { leg.to = sT.value; save(); onChange(); });
      wrap.append(sF, document.createTextNode(' → '), sT);
      const f = fareFor(parseStation(leg.from), parseStation(leg.to));
      const fs = document.createElement('span'); fs.className = 'leg-fare';
      fs.textContent = f == null ? (leg.from && leg.to ? '查無組合' : '') : fmt(f);
      wrap.appendChild(fs);
    } else if (leg.type === 'bus') {
      const iR = document.createElement('input'); iR.value = leg.route || '';
      iR.placeholder = '路線（選填）'; iR.size = 8;
      iR.addEventListener('change', () => { leg.route = iR.value; save(); });
      const iA = document.createElement('input'); iA.type = 'number'; iA.min = '0'; iA.step = '0.1';
      iA.value = leg.amount; iA.placeholder = '金額 HK$';
      iA.addEventListener('change', () => { leg.amount = iA.value; save(); onChange(); });
      wrap.append(iR, iA);
    }
    if (removable) {
      const x = document.createElement('button'); x.className = 'btn-mini'; x.textContent = '✕';
      x.title = '刪除呢程';
      x.addEventListener('click', () => onRemove());
      wrap.appendChild(x);
    }
    return wrap;
  }

  // ---- quickfill ----
  let qfLegs = [blankLeg(), blankLeg()];
  const qfBox = document.getElementById('qf-legs');
  function renderQf() {
    qfBox.innerHTML = '';
    qfLegs.forEach((leg, i) => {
      qfBox.appendChild(legEditor(leg, () => renderQf(), qfLegs.length > 1, () => {
        qfLegs.splice(i, 1); renderQf();
      }, legName(i)));
    });
  }
  document.getElementById('btn-qf-add').addEventListener('click', () => {
    qfLegs.push(blankLeg()); renderQf();
  });
  renderQf();

  function applyDefaults(weekdaysOnly) {
    const [y, m] = monthPicker.value.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const wd = new Date(y, m - 1, d).getDay();
      if (weekdaysOnly && (wd === 0 || wd === 6)) continue;
      monthState().days[d] = { legs: JSON.parse(JSON.stringify(qfLegs)) };
    }
    save(); render();
  }
  document.getElementById('btn-apply-all').addEventListener('click', () => applyDefaults(false));
  document.getElementById('btn-apply-weekday').addEventListener('click', () => applyDefaults(true));

  // ---- grid ----
  const tbody = document.getElementById('grid-body');
  function render() {
    const [y, m] = monthPicker.value.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    tbody.innerHTML = '';
    let totM = 0, totB = 0, totDays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(y, m - 1, d);
      const wd = dt.getDay();
      const day = dayData(d);
      let dayTot = 0;
      day.legs.forEach(l => {
        const f = legFare(l);
        dayTot += f;
        if (l.type === 'mtr') totM += f;
        if (l.type === 'bus') totB += f;
      });
      if (dayTot > 0) totDays++;

      const tr = document.createElement('tr');
      if (wd === 0 || wd === 6) tr.className = 'weekend';
      const tdDate = document.createElement('td'); tdDate.textContent = `${m}/${d}`;
      const tdWd = document.createElement('td'); tdWd.textContent = WEEKDAYS[wd];
      const tdLegs = document.createElement('td'); tdLegs.className = 'legs-cell';
      day.legs.forEach((leg, i) => {
        tdLegs.appendChild(legEditor(leg, () => render(), day.legs.length > 1, () => {
          day.legs.splice(i, 1); save(); render();
        }, legName(i)));
      });
      const tdTot = document.createElement('td'); tdTot.className = 'day-total';
      tdTot.textContent = dayTot > 0 ? fmt(dayTot) : '—';
      const tdOps = document.createElement('td');
      const addBtn = document.createElement('button'); addBtn.className = 'btn-mini';
      addBtn.textContent = '＋ 加一程';
      addBtn.addEventListener('click', () => { day.legs.push(blankLeg()); save(); render(); });
      const clrBtn = document.createElement('button'); clrBtn.className = 'btn-mini';
      clrBtn.textContent = '清除';
      clrBtn.addEventListener('click', () => {
        monthState().days[d] = { legs: [blankLeg(), blankLeg()] }; save(); render();
      });
      tdOps.append(addBtn, document.createTextNode(' '), clrBtn);
      tr.append(tdDate, tdWd, tdLegs, tdTot, tdOps);
      tbody.appendChild(tr);
    }
    document.getElementById('total-month').textContent = fmt(totM + totB);
    document.getElementById('total-mtr').textContent = fmt(totM);
    document.getElementById('total-bus').textContent = fmt(totB);
    document.getElementById('total-days').textContent = totDays + ' 日';
    buildPrintArea();
  }

  monthPicker.addEventListener('change', () => {
    if (store[monthPicker.value]?.claimant) claimantEl.value = store[monthPicker.value].claimant;
    render();
  });
  claimantEl.addEventListener('change', () => { monthState().claimant = claimantEl.value; save(); buildPrintArea(); });
  if (store[thisMonth]?.claimant) claimantEl.value = store[thisMonth].claimant;

  document.getElementById('btn-clear').addEventListener('click', () => {
    if (!confirm('確定清除本月全部資料？')) return;
    monthState().days = {}; save(); render();
  });

  document.getElementById('btn-csv').addEventListener('click', () => {
    const [y, m] = monthPicker.value.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const rows = [['日期', '星期', '行程', '當日合計']];
    for (let d = 1; d <= daysInMonth; d++) {
      const day = monthState().days[d];
      if (!day) continue;
      const legs = migrateDay(day).legs;
      const parts = [], tot = legs.reduce((s, l) => s + legFare(l), 0);
      legs.forEach((l, i) => {
        if (l.type === 'none') return;
        parts.push(`${legName(i)}：${legText(l)} ${fmt(legFare(l))}`);
      });
      if (!parts.length) continue;
      rows.push([`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        WEEKDAYS[new Date(y, m - 1, d).getDay()], parts.join('；'), tot.toFixed(2)]);
    }
    const csv = '\uFEFF' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `交通費_${monthPicker.value}.csv`;
    a.click();
  });

  function buildPrintArea() {
    const [y, m] = monthPicker.value.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const name = claimantEl.value || '（未填寫）';
    let rows = '', totM = 0, totB = 0, totDays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const day = monthState().days[d];
      if (!day) continue;
      const legs = migrateDay(day).legs;
      const tot = legs.reduce((s, l) => s + legFare(l), 0);
      if (tot <= 0) continue;
      totDays++;
      legs.forEach(l => {
        if (l.type === 'mtr') totM += legFare(l);
        if (l.type === 'bus') totB += legFare(l);
      });
      const wd = WEEKDAYS[new Date(y, m - 1, d).getDay()];
      const legLines = legs.filter(l => l.type !== 'none')
        .map((l, i) => `${legName(i)}：${legText(l)} — ${fmt(legFare(l))}`).join('<br>');
      rows += `<tr><td>${m}/${d}</td><td>${wd}</td><td>${legLines}</td><td class="num">${tot.toFixed(2)}</td></tr>`;
    }
    document.getElementById('print-area').innerHTML = `
      <h1>交通費申報表</h1>
      <div class="p-meta">申報人：${name}　　月份：${y}年${m}月　　申報日數：${totDays}日</div>
      <table>
        <thead><tr><th>日期</th><th>星期</th><th>行程</th><th>當日合計 (HK$)</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4">本月暫無申報紀錄</td></tr>'}</tbody>
      </table>
      <div class="p-totals">
        <div>港鐵小計：HK$ ${totM.toFixed(2)}</div>
        <div>巴士小計：HK$ ${totB.toFixed(2)}</div>
        <div><strong>本月合計：HK$ ${(totM + totB).toFixed(2)}</strong></div>
      </div>
      <div class="p-sign"><span>申報人簽署</span><span>日期</span></div>
      <p class="p-foot">港鐵票價參考港鐵 Open Data 站到站成人八達通票價，僅供參考，申報前請自行核對。巴士票價按實際車費填寫。</p>`;
  }

  document.getElementById('btn-print').addEventListener('click', () => {
    buildPrintArea();
    window.print();
  });

  render();
})();
