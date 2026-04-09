/* ============================================================
   FOXTROT EDGER · A++ Candle Canvas
   Drag & drop modular trading edge visualizer.
   ============================================================ */

(() => {
  'use strict';

  // ---------- State ----------
  const state = {
    items: [],        // { id, kind, ...props }
    selected: null,   // id
    uid: 1,
  };

  const KIND = {
    BULL: 'bull',
    BEAR: 'bear',
    DOJI: 'doji',
    SUPPORT: 'support',
    RESISTANCE: 'resistance',
    ZONE: 'zone',
    NOTE: 'note',
  };

  const CANDLE_KINDS = new Set([KIND.BULL, KIND.BEAR, KIND.DOJI]);

  // ---------- DOM ----------
  const chart       = document.getElementById('chart');
  const overlay     = document.getElementById('overlay');
  const chartSvg    = document.getElementById('chartSvg');
  const inspBody    = document.getElementById('inspBody');
  const inspCount   = document.getElementById('inspCount');
  const bullCountEl = document.getElementById('bullCount');
  const bearCountEl = document.getElementById('bearCount');
  const biasEl      = document.getElementById('biasVal');
  const hint        = document.getElementById('hint');
  const priceAxis   = document.getElementById('priceAxis');
  const timeAxis    = document.getElementById('timeAxis');
  const coordDisp   = document.getElementById('coordDisplay');

  // ---------- Init chart ----------
  function renderAxes() {
    // price axis
    priceAxis.innerHTML = '';
    const prices = ['69.4k', '68.2k', '67.0k', '65.8k', '64.6k', '63.4k', '62.2k', '61.0k'];
    prices.forEach(p => {
      const s = document.createElement('span');
      s.textContent = p;
      priceAxis.appendChild(s);
    });
    // time axis
    timeAxis.innerHTML = '';
    const times = ['09:00', '11:00', '13:00', '15:00', '17:00', '19:00', '21:00'];
    times.forEach(t => {
      const s = document.createElement('span');
      s.textContent = t;
      timeAxis.appendChild(s);
    });
  }

  function renderGrid() {
    const rect = chart.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    chartSvg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    let html = '<g class="chart-grid">';
    // vertical
    const cols = 14;
    for (let i = 1; i < cols; i++) {
      const x = (i / cols) * w;
      html += `<line x1="${x}" y1="0" x2="${x}" y2="${h}" />`;
    }
    // horizontal
    const rows = 8;
    for (let i = 1; i < rows; i++) {
      const y = (i / rows) * h;
      html += `<line x1="0" y1="${y}" x2="${w}" y2="${y}" />`;
    }
    html += '</g>';
    chartSvg.innerHTML = html;
  }

  // ---------- Item factory / render ----------
  function newItem(kind, x, y) {
    const id = state.uid++;
    let item;
    if (CANDLE_KINDS.has(kind)) {
      const body = 60 + Math.random() * 50;
      const wick = body + 30 + Math.random() * 30;
      item = { id, kind, x, y, width: 22, bodyH: body, wickH: wick };
    } else if (kind === KIND.SUPPORT || kind === KIND.RESISTANCE) {
      item = { id, kind, x, y, width: 260, label: kind === KIND.SUPPORT ? 'SUPPORT' : 'RESISTANCE' };
    } else if (kind === KIND.ZONE) {
      item = { id, kind, x, y, width: 220, height: 80 };
    } else if (kind === KIND.NOTE) {
      item = { id, kind, x, y, text: 'A++ SETUP' };
    }
    state.items.push(item);
    renderItem(item);
    renderInspector();
    updateStats();
    hideHint();
    select(id);
    return item;
  }

  function renderItem(item) {
    if (CANDLE_KINDS.has(item.kind)) {
      renderCandle(item);
    } else {
      renderMarkup(item);
    }
  }

  function renderCandle(item) {
    let el = overlay.querySelector(`[data-id="${item.id}"]`);
    if (!el) {
      el = document.createElement('div');
      el.className = `candle ${item.kind}`;
      el.dataset.id = item.id;
      el.innerHTML = `
        <div class="wick"></div>
        <div class="body"></div>
        <div class="size-handle size-top"></div>
        <div class="size-handle size-bot"></div>
      `;
      overlay.appendChild(el);
      attachDrag(el, item);
      attachCandleDouble(el, item);
      attachCandleResize(el, item);
    }
    el.className = `candle ${item.kind}${state.selected === item.id ? ' selected' : ''}`;
    const total = item.wickH;
    el.style.left = `${item.x}px`;
    el.style.top = `${item.y}px`;
    el.style.width = `${item.width}px`;
    el.style.height = `${total}px`;

    const wick = el.querySelector('.wick');
    wick.style.top = '0';
    wick.style.height = `${total}px`;

    const body = el.querySelector('.body');
    const bodyTop = (total - item.bodyH) / 2;
    body.style.top = `${bodyTop}px`;
    body.style.height = `${item.bodyH}px`;
  }

  function renderMarkup(item) {
    let el = overlay.querySelector(`[data-id="${item.id}"]`);
    if (!el) {
      el = document.createElement('div');
      el.dataset.id = item.id;
      overlay.appendChild(el);
      attachDrag(el, item);
      if (item.kind === KIND.NOTE) attachNoteEdit(el, item);
    }
    el.className = 'markup';
    el.style.left = `${item.x}px`;
    el.style.top = `${item.y}px`;

    if (item.kind === KIND.SUPPORT || item.kind === KIND.RESISTANCE) {
      el.classList.add('line', item.kind);
      el.style.width = `${item.width}px`;
      el.setAttribute('data-label', item.label);
    } else if (item.kind === KIND.ZONE) {
      el.classList.add('zone');
      el.style.width = `${item.width}px`;
      el.style.height = `${item.height}px`;
    } else if (item.kind === KIND.NOTE) {
      el.classList.add('note');
      el.textContent = item.text;
    }
    if (state.selected === item.id) el.classList.add('selected');
  }

  function removeItem(id) {
    state.items = state.items.filter(i => i.id !== id);
    const el = overlay.querySelector(`[data-id="${id}"]`);
    if (el) el.remove();
    if (state.selected === id) state.selected = null;
    renderInspector();
    updateStats();
  }

  function select(id) {
    state.selected = id;
    overlay.querySelectorAll('[data-id]').forEach(el => {
      el.classList.toggle('selected', Number(el.dataset.id) === id);
    });
    renderInspector();
  }

  // ---------- Drag ----------
  function attachDrag(el, item) {
    let startX, startY, origX, origY;
    let moved = false;

    const onDown = (e) => {
      if (e.target.classList.contains('size-handle')) return;
      e.preventDefault();
      e.stopPropagation();
      moved = false;
      const pt = pointer(e);
      startX = pt.x; startY = pt.y;
      origX = item.x; origY = item.y;
      select(item.id);
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    };
    const onMove = (e) => {
      const pt = pointer(e);
      const dx = pt.x - startX;
      const dy = pt.y - startY;
      if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
      item.x = origX + dx;
      item.y = origY + dy;
      clampItem(item);
      renderItem(item);
      updateCoord(item.x, item.y);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    el.addEventListener('pointerdown', onDown);
  }

  function attachCandleResize(el, item) {
    const top = el.querySelector('.size-top');
    const bot = el.querySelector('.size-bot');
    const make = (handle, side) => {
      let startY, origBody, origWick, origItemY;
      const onDown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        startY = pointer(e).y;
        origBody = item.bodyH;
        origWick = item.wickH;
        origItemY = item.y;
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
      };
      const onMove = (e) => {
        const dy = pointer(e).y - startY;
        if (side === 'top') {
          item.bodyH = Math.max(8, origBody - dy);
          item.wickH = Math.max(item.bodyH + 4, origWick - dy);
          item.y = origItemY + dy / 2;
        } else {
          item.bodyH = Math.max(8, origBody + dy);
          item.wickH = Math.max(item.bodyH + 4, origWick + dy);
          item.y = origItemY - dy / 2;
        }
        renderItem(item);
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      handle.addEventListener('pointerdown', onDown);
    };
    make(top, 'top');
    make(bot, 'bot');
  }

  function attachCandleDouble(el, item) {
    el.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      if (item.kind === KIND.BULL)      item.kind = KIND.BEAR;
      else if (item.kind === KIND.BEAR) item.kind = KIND.DOJI;
      else                              item.kind = KIND.BULL;
      renderItem(item);
      renderInspector();
      updateStats();
    });
  }

  function attachNoteEdit(el, item) {
    el.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      const next = prompt('Note text', item.text);
      if (next !== null && next.trim()) {
        item.text = next.trim().toUpperCase();
        renderItem(item);
        renderInspector();
      }
    });
  }

  function pointer(e) {
    const rect = chart.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function clampItem(item) {
    const rect = chart.getBoundingClientRect();
    const w = item.width || 40;
    const h = item.height || item.wickH || 20;
    item.x = Math.max(0, Math.min(rect.width - w, item.x));
    item.y = Math.max(0, Math.min(rect.height - h, item.y));
  }

  function updateCoord(x, y) {
    coordDisp.textContent = `x: ${Math.round(x)}  y: ${Math.round(y)}`;
  }

  // ---------- Inspector ----------
  function renderInspector() {
    if (state.items.length === 0) {
      inspBody.innerHTML = `
        <div class="empty-state">
          <img src="assets/foxtrot-logo.svg" class="empty-logo" alt="" />
          <p class="empty-title">Design your A++ setup</p>
          <p class="empty-sub">Every candle tells a story. Drag them into alignment.</p>
        </div>`;
      inspCount.textContent = '0 items';
      return;
    }
    inspCount.textContent = `${state.items.length} item${state.items.length === 1 ? '' : 's'}`;
    inspBody.innerHTML = '';
    state.items.forEach(item => {
      const div = document.createElement('div');
      div.className = `insp-item ${item.kind}${state.selected === item.id ? ' active' : ''}`;
      div.innerHTML = `
        <div class="insp-row">
          <span class="insp-type">${labelFor(item)}</span>
          <button class="insp-del" data-del="${item.id}">✕</button>
        </div>
        <div class="insp-meta">${metaFor(item)}</div>
      `;
      div.addEventListener('click', (e) => {
        if (e.target.dataset.del) {
          removeItem(Number(e.target.dataset.del));
          return;
        }
        select(item.id);
      });
      inspBody.appendChild(div);
    });
  }

  function labelFor(item) {
    const map = {
      bull: '● BULL CANDLE',
      bear: '● BEAR CANDLE',
      doji: '● DOJI',
      support: '─ SUPPORT',
      resistance: '─ RESISTANCE',
      zone: '▢ SUPPLY/DEMAND',
      note: '✦ NOTE',
    };
    return map[item.kind] || item.kind;
  }
  function metaFor(item) {
    if (CANDLE_KINDS.has(item.kind)) {
      return `x:${Math.round(item.x)} y:${Math.round(item.y)} · body:${Math.round(item.bodyH)}`;
    }
    if (item.kind === KIND.NOTE) return `"${item.text}"`;
    return `x:${Math.round(item.x)} y:${Math.round(item.y)} · w:${item.width}`;
  }

  function updateStats() {
    const bulls = state.items.filter(i => i.kind === KIND.BULL).length;
    const bears = state.items.filter(i => i.kind === KIND.BEAR).length;
    bullCountEl.textContent = bulls;
    bearCountEl.textContent = bears;
    let bias = '—';
    if (bulls > bears) bias = 'LONG';
    else if (bears > bulls) bias = 'SHORT';
    else if (bulls > 0) bias = 'FLAT';
    biasEl.textContent = bias;
    biasEl.style.color = bias === 'LONG' ? 'var(--bull)'
                      : bias === 'SHORT' ? 'var(--bear)'
                      : 'var(--ink)';
  }

  function hideHint() {
    hint.classList.add('hide');
  }

  // ---------- Toolbar actions ----------
  function centerPos() {
    const r = chart.getBoundingClientRect();
    return { x: r.width / 2 - 40, y: r.height / 2 - 60 };
  }

  function handleToolAction(action) {
    const c = centerPos();
    const jitter = () => ({ x: c.x + (Math.random() - 0.5) * 160, y: c.y + (Math.random() - 0.5) * 100 });
    const p = jitter();
    switch (action) {
      case 'add-bull':       newItem(KIND.BULL, p.x, p.y); break;
      case 'add-bear':       newItem(KIND.BEAR, p.x, p.y); break;
      case 'add-doji':       newItem(KIND.DOJI, p.x, p.y); break;
      case 'add-support':    newItem(KIND.SUPPORT, 60, c.y + 120); break;
      case 'add-resistance': newItem(KIND.RESISTANCE, 60, c.y - 120); break;
      case 'add-zone':       newItem(KIND.ZONE, c.x - 40, c.y - 30); break;
      case 'add-note':       newItem(KIND.NOTE, c.x, c.y - 80); break;
      case 'preset-breakout':  presetBreakout(); break;
      case 'preset-reversal':  presetReversal(); break;
      case 'preset-liquidity': presetLiquiditySweep(); break;
    }
  }

  // ---------- Presets ----------
  function clearAll() {
    [...state.items].forEach(i => removeItem(i.id));
  }

  function presetBreakout() {
    clearAll();
    const r = chart.getBoundingClientRect();
    const baseY = r.height / 2;
    const spacing = 38;
    const startX = r.width / 2 - (spacing * 4);
    // consolidation
    for (let i = 0; i < 4; i++) {
      const bodyH = 40 + Math.random() * 20;
      const wickH = bodyH + 20;
      const kind = i % 2 ? KIND.BEAR : KIND.BULL;
      state.uid++;
      state.items.push({ id: state.uid, kind, x: startX + i * spacing, y: baseY - wickH / 2, width: 22, bodyH, wickH });
    }
    // breakout push
    for (let i = 0; i < 4; i++) {
      const bodyH = 70 + i * 15;
      const wickH = bodyH + 25;
      state.uid++;
      state.items.push({ id: state.uid, kind: KIND.BULL, x: startX + (4 + i) * spacing, y: baseY - 50 - i * 18 - wickH / 2, width: 22, bodyH, wickH });
    }
    state.uid++;
    state.items.push({ id: state.uid, kind: KIND.RESISTANCE, x: 60, y: baseY - 30, width: r.width - 120, label: 'BROKEN RESISTANCE' });
    state.uid++;
    state.items.push({ id: state.uid, kind: KIND.NOTE, x: startX + 4 * spacing + 30, y: baseY - 150, text: 'BREAKOUT ENTRY' });
    state.items.forEach(renderItem);
    renderInspector(); updateStats(); hideHint();
  }

  function presetReversal() {
    clearAll();
    const r = chart.getBoundingClientRect();
    const baseY = r.height / 2 - 80;
    const spacing = 38;
    const startX = r.width / 2 - (spacing * 4);
    for (let i = 0; i < 4; i++) {
      const bodyH = 80 - i * 10;
      const wickH = bodyH + 25;
      state.uid++;
      state.items.push({ id: state.uid, kind: KIND.BEAR, x: startX + i * spacing, y: baseY + i * 30 - wickH / 2, width: 22, bodyH, wickH });
    }
    // doji pivot
    state.uid++;
    state.items.push({ id: state.uid, kind: KIND.DOJI, x: startX + 4 * spacing, y: baseY + 4 * 30 - 50, width: 22, bodyH: 12, wickH: 80 });
    for (let i = 0; i < 4; i++) {
      const bodyH = 50 + i * 15;
      const wickH = bodyH + 25;
      state.uid++;
      state.items.push({ id: state.uid, kind: KIND.BULL, x: startX + (5 + i) * spacing, y: baseY + (4 - i) * 30 - 20 - wickH / 2, width: 22, bodyH, wickH });
    }
    state.uid++;
    state.items.push({ id: state.uid, kind: KIND.SUPPORT, x: 60, y: baseY + 150, width: r.width - 120, label: 'DEMAND FLIP' });
    state.uid++;
    state.items.push({ id: state.uid, kind: KIND.NOTE, x: startX + 4 * spacing - 20, y: baseY + 180, text: 'REVERSAL' });
    state.items.forEach(renderItem);
    renderInspector(); updateStats(); hideHint();
  }

  function presetLiquiditySweep() {
    clearAll();
    const r = chart.getBoundingClientRect();
    const baseY = r.height / 2;
    const spacing = 38;
    const startX = r.width / 2 - (spacing * 4);
    // range
    for (let i = 0; i < 5; i++) {
      const bodyH = 45 + Math.random() * 15;
      const wickH = bodyH + 18;
      state.uid++;
      state.items.push({ id: state.uid, kind: i % 2 ? KIND.BULL : KIND.BEAR, x: startX + i * spacing, y: baseY - wickH / 2 + (Math.random() - 0.5) * 20, width: 22, bodyH, wickH });
    }
    // sweep — long wick
    state.uid++;
    state.items.push({ id: state.uid, kind: KIND.BULL, x: startX + 5 * spacing, y: baseY - 40, width: 22, bodyH: 30, wickH: 140 });
    // continuation
    for (let i = 0; i < 3; i++) {
      const bodyH = 55 + i * 10;
      const wickH = bodyH + 20;
      state.uid++;
      state.items.push({ id: state.uid, kind: KIND.BULL, x: startX + (6 + i) * spacing, y: baseY - 50 - i * 22 - wickH / 2, width: 22, bodyH, wickH });
    }
    state.uid++;
    state.items.push({ id: state.uid, kind: KIND.ZONE, x: startX - 10, y: baseY + 30, width: 6 * spacing + 20, height: 60 });
    state.uid++;
    state.items.push({ id: state.uid, kind: KIND.NOTE, x: startX + 5 * spacing - 30, y: baseY + 110, text: 'LIQ. SWEEP' });
    state.items.forEach(renderItem);
    renderInspector(); updateStats(); hideHint();
  }

  // ---------- Save / Load ----------
  const KEY = 'foxtrot-edger-layout';
  function save() {
    localStorage.setItem(KEY, JSON.stringify({ items: state.items, uid: state.uid }));
    flash('SAVED');
  }
  function load() {
    const raw = localStorage.getItem(KEY);
    if (!raw) { flash('NO SAVE'); return; }
    try {
      const data = JSON.parse(raw);
      clearAll();
      state.uid = data.uid || 1;
      data.items.forEach(it => {
        state.items.push(it);
        renderItem(it);
      });
      renderInspector(); updateStats(); hideHint();
      flash('LOADED');
    } catch (e) { flash('ERR'); }
  }
  function flash(msg) {
    const badge = document.getElementById('liveBadge');
    const prev = badge.textContent;
    badge.textContent = msg;
    setTimeout(() => badge.textContent = prev, 900);
  }

  // ---------- Bindings ----------
  document.querySelectorAll('.tool').forEach(btn => {
    btn.addEventListener('click', () => handleToolAction(btn.dataset.action));
  });

  document.getElementById('clearBtn').addEventListener('click', clearAll);
  document.getElementById('saveBtn').addEventListener('click', save);
  document.getElementById('loadBtn').addEventListener('click', load);

  chart.addEventListener('pointerdown', (e) => {
    if (e.target === chart || e.target === overlay || e.target === chartSvg) {
      select(null);
    }
  });

  chart.addEventListener('pointermove', (e) => {
    const p = pointer(e);
    chart.style.setProperty('--mx', `${p.x}px`);
    chart.style.setProperty('--my', `${p.y}px`);
    updateCoord(p.x, p.y);
  });

  document.addEventListener('keydown', (e) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && state.selected !== null) {
      // avoid deleting when user is typing in an input
      if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
      removeItem(state.selected);
    }
  });

  window.addEventListener('resize', () => {
    renderGrid();
    state.items.forEach(clampItem);
    state.items.forEach(renderItem);
  });

  // ---------- Boot ----------
  renderAxes();
  requestAnimationFrame(() => {
    renderGrid();
    // Seed demo so the canvas is alive on first load
    presetBreakout();
  });
})();
