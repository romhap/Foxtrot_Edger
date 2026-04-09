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
      const bodyH  = 60 + Math.random() * 50;
      const topWick = 15 + Math.random() * 15;
      const botWick = 15 + Math.random() * 15;
      item = { id, kind, x, y, width: 22, topWick, bodyH, botWick };
    } else if (kind === KIND.SUPPORT || kind === KIND.RESISTANCE) {
      item = { id, kind, x, y, width: 260, label: kind === KIND.SUPPORT ? 'SUPPORT' : 'RESISTANCE' };
    } else if (kind === KIND.ZONE) {
      item = { id, kind, x, y, width: 220, height: 80, text: 'SUPPLY / DEMAND' };
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
        <div class="size-handle size-top-wick"  data-handle="top-wick"  title="Upper wick"></div>
        <div class="size-handle size-body-top"  data-handle="body-top"  title="Body top"></div>
        <div class="size-handle size-body-bot"  data-handle="body-bot"  title="Body bottom"></div>
        <div class="size-handle size-bot-wick"  data-handle="bot-wick"  title="Lower wick"></div>
      `;
      overlay.appendChild(el);
      attachDrag(el, item);
      attachCandleDouble(el, item);
      attachCandleResize(el, item);
    }
    el.className = `candle ${item.kind}${state.selected === item.id ? ' selected' : ''}`;
    const total = item.topWick + item.bodyH + item.botWick;
    el.style.left   = `${item.x}px`;
    el.style.top    = `${item.y}px`;
    el.style.width  = `${item.width}px`;
    el.style.height = `${total}px`;

    const wick = el.querySelector('.wick');
    wick.style.top    = '0';
    wick.style.height = `${total}px`;

    const body = el.querySelector('.body');
    body.style.top    = `${item.topWick}px`;
    body.style.height = `${item.bodyH}px`;

    // Position the 4 resize handles
    el.querySelector('.size-top-wick').style.top = `-4px`;
    el.querySelector('.size-body-top').style.top = `${item.topWick - 2}px`;
    el.querySelector('.size-body-bot').style.top = `${item.topWick + item.bodyH - 2}px`;
    el.querySelector('.size-bot-wick').style.top = `${total - 2}px`;
  }

  function renderMarkup(item) {
    let el = overlay.querySelector(`[data-id="${item.id}"]`);
    if (!el) {
      el = document.createElement('div');
      el.dataset.id = item.id;
      if (item.kind === KIND.ZONE) {
        el.innerHTML = `
          <div class="zone-label"></div>
          <div class="zone-resize" data-zone-resize></div>
        `;
      }
      overlay.appendChild(el);
      attachDrag(el, item);
      if (item.kind === KIND.NOTE) attachNoteEdit(el, item);
      if (item.kind === KIND.ZONE) {
        attachZoneEdit(el, item);
        attachZoneResize(el, item);
      }
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
      el.style.width  = `${item.width}px`;
      el.style.height = `${item.height}px`;
      const label = el.querySelector('.zone-label');
      if (label && document.activeElement !== label) {
        label.textContent = item.text || 'SUPPLY / DEMAND';
      }
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
      if (e.target.classList.contains('zone-resize')) return;
      if (e.target.isContentEditable) return;
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
    const MIN_WICK = 2;
    const MIN_BODY = 6;

    const attach = (selector, mode) => {
      const handle = el.querySelector(selector);
      const onDown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        select(item.id);
        const startY = pointer(e).y;
        const orig = {
          topWick: item.topWick,
          bodyH:   item.bodyH,
          botWick: item.botWick,
          y:       item.y,
        };
        const onMove = (ev) => {
          const dy = pointer(ev).y - startY;

          if (mode === 'top-wick') {
            // Drag up  → topWick grows, candle top moves up
            // Drag down→ topWick shrinks, candle top moves down
            const newTop = Math.max(MIN_WICK, orig.topWick - dy);
            const delta  = newTop - orig.topWick;
            item.topWick = newTop;
            item.y       = orig.y - delta;

          } else if (mode === 'body-top') {
            // Drag up   → body grows upward (topWick shrinks)
            // Drag down → body shrinks from top (topWick grows)
            let newTop  = orig.topWick + dy;
            let newBody = orig.bodyH   - dy;
            if (newTop < MIN_WICK) {
              newTop  = MIN_WICK;
              newBody = orig.bodyH + orig.topWick - MIN_WICK;
            }
            if (newBody < MIN_BODY) {
              newBody = MIN_BODY;
              newTop  = orig.topWick + orig.bodyH - MIN_BODY;
            }
            item.topWick = newTop;
            item.bodyH   = newBody;

          } else if (mode === 'body-bot') {
            // Drag down → body grows downward (botWick shrinks)
            // Drag up   → body shrinks from bottom (botWick grows)
            let newBody = orig.bodyH   + dy;
            let newBot  = orig.botWick - dy;
            if (newBot < MIN_WICK) {
              newBot  = MIN_WICK;
              newBody = orig.bodyH + orig.botWick - MIN_WICK;
            }
            if (newBody < MIN_BODY) {
              newBody = MIN_BODY;
              newBot  = orig.botWick + orig.bodyH - MIN_BODY;
            }
            item.bodyH   = newBody;
            item.botWick = newBot;

          } else if (mode === 'bot-wick') {
            // Drag down → botWick grows, candle bottom moves down
            // Drag up   → botWick shrinks
            item.botWick = Math.max(MIN_WICK, orig.botWick + dy);
          }
          renderItem(item);
          renderInspector();
        };
        const onUp = () => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
      };
      handle.addEventListener('pointerdown', onDown);
    };

    attach('.size-top-wick', 'top-wick');
    attach('.size-body-top', 'body-top');
    attach('.size-body-bot', 'body-bot');
    attach('.size-bot-wick', 'bot-wick');
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

  function attachZoneEdit(el, item) {
    const label = el.querySelector('.zone-label');

    const finish = () => {
      label.contentEditable = 'false';
      const txt = label.textContent.replace(/\s+/g, ' ').trim() || 'ZONE';
      item.text = txt.toUpperCase();
      label.textContent = item.text;
      renderInspector();
    };

    const beginEdit = (e) => {
      e.stopPropagation();
      label.contentEditable = 'true';
      label.focus();
      const r = document.createRange();
      r.selectNodeContents(label);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
    };

    // Double-click anywhere on the zone (except its resize handle) to edit.
    el.addEventListener('dblclick', (e) => {
      if (e.target.dataset && e.target.dataset.zoneResize !== undefined) return;
      beginEdit(e);
    });

    label.addEventListener('blur', finish);
    label.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); label.blur(); }
      if (e.key === 'Escape') {
        e.preventDefault();
        label.textContent = item.text;
        label.blur();
      }
    });
    // Don't start a drag when the user is selecting text inside the label.
    label.addEventListener('pointerdown', (e) => {
      if (label.contentEditable === 'true') e.stopPropagation();
    });
  }

  function attachZoneResize(el, item) {
    const handle = el.querySelector('.zone-resize');
    const onDown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      select(item.id);
      const start = pointer(e);
      const origW = item.width;
      const origH = item.height;
      const onMove = (ev) => {
        const pt = pointer(ev);
        item.width  = Math.max(60, origW + (pt.x - start.x));
        item.height = Math.max(34, origH + (pt.y - start.y));
        renderItem(item);
        renderInspector();
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    };
    handle.addEventListener('pointerdown', onDown);
  }

  function pointer(e) {
    const rect = chart.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function clampItem(item) {
    const rect = chart.getBoundingClientRect();
    const w = item.width || 40;
    let h;
    if (CANDLE_KINDS.has(item.kind)) {
      h = (item.topWick || 0) + (item.bodyH || 0) + (item.botWick || 0);
    } else {
      h = item.height || 20;
    }
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
      return `body:${Math.round(item.bodyH)} · top:${Math.round(item.topWick)} · bot:${Math.round(item.botWick)}`;
    }
    if (item.kind === KIND.NOTE) return `"${item.text}"`;
    if (item.kind === KIND.ZONE) return `"${item.text}" · ${Math.round(item.width)}×${Math.round(item.height)}`;
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

  function pushCandle(kind, x, y, bodyH, topWick, botWick) {
    state.uid++;
    state.items.push({
      id: state.uid, kind, x, y, width: 22,
      topWick, bodyH, botWick,
    });
  }
  function candleTotal(bodyH, topWick, botWick) { return bodyH + topWick + botWick; }

  function presetBreakout() {
    clearAll();
    const r = chart.getBoundingClientRect();
    const baseY = r.height / 2;
    const spacing = 38;
    const startX = r.width / 2 - (spacing * 4);
    // consolidation
    for (let i = 0; i < 4; i++) {
      const bodyH = 40 + Math.random() * 20;
      const w = 10;
      const total = candleTotal(bodyH, w, w);
      const kind = i % 2 ? KIND.BEAR : KIND.BULL;
      pushCandle(kind, startX + i * spacing, baseY - total / 2, bodyH, w, w);
    }
    // breakout push
    for (let i = 0; i < 4; i++) {
      const bodyH = 70 + i * 15;
      const w = 12;
      const total = candleTotal(bodyH, w, w);
      pushCandle(KIND.BULL, startX + (4 + i) * spacing, baseY - 50 - i * 18 - total / 2, bodyH, w, w);
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
      const w = 12;
      const total = candleTotal(bodyH, w, w);
      pushCandle(KIND.BEAR, startX + i * spacing, baseY + i * 30 - total / 2, bodyH, w, w);
    }
    // doji pivot
    pushCandle(KIND.DOJI, startX + 4 * spacing, baseY + 4 * 30 - 50, 8, 36, 36);
    for (let i = 0; i < 4; i++) {
      const bodyH = 50 + i * 15;
      const w = 12;
      const total = candleTotal(bodyH, w, w);
      pushCandle(KIND.BULL, startX + (5 + i) * spacing, baseY + (4 - i) * 30 - 20 - total / 2, bodyH, w, w);
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
      const w = 9;
      const total = candleTotal(bodyH, w, w);
      pushCandle(i % 2 ? KIND.BULL : KIND.BEAR,
        startX + i * spacing,
        baseY - total / 2 + (Math.random() - 0.5) * 20,
        bodyH, w, w);
    }
    // sweep — long LOWER wick (the sweep itself)
    pushCandle(KIND.BULL, startX + 5 * spacing, baseY - 40, 30, 8, 90);
    // continuation
    for (let i = 0; i < 3; i++) {
      const bodyH = 55 + i * 10;
      const w = 10;
      const total = candleTotal(bodyH, w, w);
      pushCandle(KIND.BULL, startX + (6 + i) * spacing, baseY - 50 - i * 22 - total / 2, bodyH, w, w);
    }
    state.uid++;
    state.items.push({
      id: state.uid, kind: KIND.ZONE,
      x: startX - 10, y: baseY + 30,
      width: 6 * spacing + 20, height: 60,
      text: 'LIQUIDITY POOL',
    });
    state.uid++;
    state.items.push({ id: state.uid, kind: KIND.NOTE, x: startX + 5 * spacing - 30, y: baseY + 110, text: 'LIQ. SWEEP' });
    state.items.forEach(renderItem);
    renderInspector(); updateStats(); hideHint();
  }

  // ---------- Save / Load ----------
  // SAVE downloads the current canvas as a JSON file.
  // LOAD opens a file picker and rehydrates the canvas from that JSON.
  // Migration lets older saves (with `wickH`) load into the new candle model.

  function serialize() {
    return {
      app: 'foxtrot-edger',
      version: 2,
      savedAt: new Date().toISOString(),
      pair: document.getElementById('pairInput').value,
      uid: state.uid,
      items: state.items,
    };
  }

  function migrateItem(it) {
    if (CANDLE_KINDS.has(it.kind)) {
      // old format: { bodyH, wickH } → new: { topWick, bodyH, botWick }
      if (it.wickH !== undefined && it.topWick === undefined) {
        const extra = Math.max(2, (it.wickH - it.bodyH) / 2);
        it.topWick = extra;
        it.botWick = extra;
      }
      delete it.wickH;
      if (it.topWick == null) it.topWick = 15;
      if (it.bodyH   == null) it.bodyH   = 60;
      if (it.botWick == null) it.botWick = 15;
    }
    if (it.kind === KIND.ZONE && !it.text) {
      it.text = 'SUPPLY / DEMAND';
    }
    return it;
  }

  function save() {
    const payload = JSON.stringify(serialize(), null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.href = url;
    a.download = `foxtrot-edge-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    // Also mirror into localStorage as an auto-backup.
    try { localStorage.setItem('foxtrot-edger-autosave', payload); } catch (_) {}
    flash('SAVED ✓');
  }

  function load() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    input.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          if (!data || !Array.isArray(data.items)) throw new Error('invalid shape');
          clearAll();
          state.uid = Number(data.uid) || 1;
          if (data.pair) {
            const pi = document.getElementById('pairInput');
            if (pi) pi.value = data.pair;
          }
          data.items.forEach(it => {
            migrateItem(it);
            state.items.push(it);
            renderItem(it);
          });
          state.items.forEach(clampItem);
          state.items.forEach(renderItem);
          renderInspector(); updateStats(); hideHint();
          flash('LOADED ✓');
        } catch (err) {
          console.error('[Foxtrot Edger] load failed:', err);
          flash('BAD FILE');
        }
      };
      reader.readAsText(file);
    });
    document.body.appendChild(input);
    input.click();
    setTimeout(() => input.remove(), 0);
  }

  function flash(msg) {
    const badge = document.getElementById('liveBadge');
    const prev = badge.dataset.prev || badge.textContent;
    badge.dataset.prev = prev;
    badge.textContent = msg;
    badge.style.color = 'var(--fox-glow)';
    clearTimeout(flash._t);
    flash._t = setTimeout(() => {
      badge.textContent = prev;
      badge.style.color = '';
      delete badge.dataset.prev;
    }, 1100);
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
      // avoid deleting when user is typing in an input or contenteditable
      const ae = document.activeElement;
      if (ae && (ae.tagName === 'INPUT' || ae.isContentEditable)) return;
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
