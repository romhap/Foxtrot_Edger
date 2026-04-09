/* ============================================================
   FOXTROT · Trading edge canvas
   Drag & drop modular trading edge visualizer.
   ============================================================ */

(() => {
  'use strict';

  // ---------- State ----------
  const state = {
    items: [],        // { id, kind, ...props }
    selected: null,   // id
    uid: 1,
    tf: '15m',
    startTime: defaultStartTime(),
    theme: 'dark',
    musicOn: false,
  };

  const KIND = {
    BULL: 'bull',
    BEAR: 'bear',
    TP: 'tp',
    SL: 'sl',
    ENTRY: 'entry',
    TRENDLINE: 'trendline',
    ZONE: 'zone',
    NOTE: 'note',
  };

  const CANDLE_KINDS = new Set([KIND.BULL, KIND.BEAR]);
  const LINE_KINDS   = new Set([KIND.TP, KIND.SL, KIND.ENTRY]);

  // Candle horizontal magnet spacing (px). Candles snap to multiples of
  // this from their neighbours so time gaps stay even.
  const CANDLE_SPACING = 30;
  const SNAP_THRESHOLD = 14;
  const ZONE_FVG_THRESHOLD = 22;

  // Timeframe → seconds
  const TF_SECONDS = {
    '1m': 60,
    '5m': 300,
    '15m': 900,
    '1h': 3600,
    '4h': 14400,
    '1d': 86400,
  };

  const LINE_COLOR_PRESETS = [
    { name: 'bull',    color: '#00ffb2', glow: '#5cffce' },
    { name: 'bear',    color: '#ff3d6e', glow: '#ff7a9a' },
    { name: 'neutral', color: '#9aa5b4', glow: '#cfd6e0' },
    { name: 'fox',     color: '#ff2d87', glow: '#ff6cb0' },
    { name: 'violet',  color: '#a855f7', glow: '#c084fc' },
    { name: 'cyan',    color: '#22d3ee', glow: '#67e8f9' },
    { name: 'amber',   color: '#ffd84d', glow: '#ffe8a3' },
    { name: 'white',   color: '#ffffff', glow: '#ffd9ea' },
  ];

  const LINE_DEFAULTS = {
    [KIND.TP]:    { color: '#00ffb2', glow: '#5cffce', defaultLabel: 'TP' },
    [KIND.SL]:    { color: '#ff3d6e', glow: '#ff7a9a', defaultLabel: 'SL' },
    [KIND.ENTRY]: { color: '#9aa5b4', glow: '#cfd6e0', defaultLabel: 'ENTRY' },
  };

  function defaultStartTime() {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // ---------- DOM ----------
  const chart       = document.getElementById('chart');
  const overlay     = document.getElementById('overlay');
  const chartSvg    = document.getElementById('chartSvg');
  const inspBody    = document.getElementById('inspBody');
  const inspCount   = document.getElementById('inspCount');
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
    renderTimeAxis();
  }

  function renderTimeAxis() {
    timeAxis.innerHTML = '';
    const tfSec = TF_SECONDS[state.tf] || 900;
    const startMs = new Date(state.startTime).getTime();
    const LABEL_COUNT = 7;
    const BARS_BETWEEN = 5; // label every 5 bars
    for (let i = 0; i < LABEL_COUNT; i++) {
      const s = document.createElement('span');
      if (!isNaN(startMs)) {
        const d = new Date(startMs + i * BARS_BETWEEN * tfSec * 1000);
        s.textContent = formatTime(d, state.tf);
      } else {
        s.textContent = '—';
      }
      timeAxis.appendChild(s);
    }
  }

  function formatTime(d, tf) {
    const pad = n => String(n).padStart(2, '0');
    if (tf === '1d') {
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
    if (tf === '4h' || tf === '1h') {
      return `${pad(d.getMonth()+1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
    } else if (LINE_KINDS.has(kind)) {
      const d = LINE_DEFAULTS[kind];
      item = {
        id, kind, x, y, width: 260,
        label: d.defaultLabel,
        color: d.color,
        glow:  d.glow,
      };
    } else if (kind === KIND.TRENDLINE) {
      item = {
        id, kind,
        x1: x,       y1: y + 40,
        x2: x + 220, y2: y - 40,
        label: '',
        color: '#ff2d87',
        glow:  '#ff6cb0',
      };
    } else if (kind === KIND.ZONE) {
      item = { id, kind, x, y, width: 220, height: 80, text: 'SUPPLY / DEMAND' };
    } else if (kind === KIND.NOTE) {
      item = { id, kind, x, y, text: 'A++ SETUP' };
    }
    state.items.push(item);
    renderItem(item);
    renderInspector();
    hideHint();
    select(id);
    return item;
  }

  // Find the ideal drop position for a new candle: place it one CANDLE_SPACING
  // past the right-most existing candle's body center. Falls back to the centre
  // of the chart when no candles exist yet.
  function nextCandleSlot() {
    const rect = chart.getBoundingClientRect();
    const candles = state.items.filter(i => CANDLE_KINDS.has(i.kind));
    if (candles.length === 0) {
      return { x: rect.width * 0.25, y: rect.height / 2 - 60 };
    }
    const last = candles.reduce((a, b) => (a.x > b.x ? a : b));
    let x = last.x + CANDLE_SPACING;
    const maxX = rect.width - (last.width || 22) - 20;
    if (x > maxX) x = maxX;
    // Mirror the last candle's vertical center so the new candle sits on
    // the same price level — still fully draggable afterwards.
    const lastTotal = (last.topWick || 0) + (last.bodyH || 0) + (last.botWick || 0);
    const newTotal  = 22 + 60 + 22; // rough default before random sizing
    const y = last.y + lastTotal / 2 - newTotal / 2;
    return { x, y };
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
      } else if (LINE_KINDS.has(item.kind)) {
        el.innerHTML = `
          <div class="line-label"></div>
          <div class="line-handle h-left"  data-line-handle="left"></div>
          <div class="line-handle h-right" data-line-handle="right"></div>
          <div class="color-swatches"></div>
        `;
        buildSwatches(el, item);
      } else if (item.kind === KIND.TRENDLINE) {
        el.innerHTML = `
          <svg class="tl-svg" xmlns="http://www.w3.org/2000/svg">
            <line class="tl-hit"></line>
            <line class="tl-line"></line>
          </svg>
          <div class="tl-handle tl-p1" data-tl-handle="p1"></div>
          <div class="tl-handle tl-p2" data-tl-handle="p2"></div>
          <div class="tl-label"></div>
          <div class="color-swatches"></div>
        `;
        buildSwatches(el, item);
      }
      overlay.appendChild(el);
      if (item.kind === KIND.TRENDLINE) {
        attachTrendlineDrag(el, item);
        attachTrendlineHandles(el, item);
        attachTrendlineEdit(el, item);
      } else {
        attachDrag(el, item);
      }
      if (item.kind === KIND.NOTE) attachNoteEdit(el, item);
      if (item.kind === KIND.ZONE) {
        attachZoneEdit(el, item);
        attachZoneResize(el, item);
      }
      if (LINE_KINDS.has(item.kind)) {
        attachLineEdit(el, item);
        attachLineHandles(el, item);
      }
    }
    el.className = 'markup';

    if (item.kind === KIND.TRENDLINE) {
      el.classList.add('trendline');
      renderTrendline(el, item);
    } else {
      el.style.left = `${item.x}px`;
      el.style.top  = `${item.y}px`;

      if (LINE_KINDS.has(item.kind)) {
        el.classList.add('line', item.kind);
        el.style.width = `${item.width}px`;
        if (item.color) {
          el.style.setProperty('--line-color', item.color);
          el.style.setProperty('--line-glow',  item.glow || item.color);
        }
        const label = el.querySelector('.line-label');
        if (label && document.activeElement !== label) {
          label.textContent = item.label || (LINE_DEFAULTS[item.kind] && LINE_DEFAULTS[item.kind].defaultLabel) || '';
        }
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
    }
    if (state.selected === item.id) el.classList.add('selected');
  }

  function buildSwatches(el, item) {
    const container = el.querySelector('.color-swatches');
    if (!container) return;
    container.innerHTML = '';
    LINE_COLOR_PRESETS.forEach(p => {
      const s = document.createElement('button');
      s.className = 'swatch';
      s.style.background = p.color;
      s.title = p.name;
      if (item.color === p.color) s.classList.add('active');
      s.addEventListener('pointerdown', (e) => { e.stopPropagation(); });
      s.addEventListener('click', (e) => {
        e.stopPropagation();
        item.color = p.color;
        item.glow  = p.glow;
        container.querySelectorAll('.swatch').forEach(x => x.classList.remove('active'));
        s.classList.add('active');
        renderItem(item);
        renderInspector();
      });
      container.appendChild(s);
    });
  }

  function renderTrendline(el, item) {
    const PAD = 18;
    const minX = Math.min(item.x1, item.x2);
    const minY = Math.min(item.y1, item.y2);
    const w = Math.max(2, Math.abs(item.x2 - item.x1));
    const h = Math.max(2, Math.abs(item.y2 - item.y1));

    el.style.left   = `${minX - PAD}px`;
    el.style.top    = `${minY - PAD}px`;
    el.style.width  = `${w + PAD * 2}px`;
    el.style.height = `${h + PAD * 2}px`;

    if (item.color) {
      el.style.setProperty('--line-color', item.color);
      el.style.setProperty('--line-glow',  item.glow || item.color);
    }

    const svg = el.querySelector('.tl-svg');
    svg.setAttribute('viewBox', `0 0 ${w + PAD * 2} ${h + PAD * 2}`);

    const lp1x = item.x1 - minX + PAD;
    const lp1y = item.y1 - minY + PAD;
    const lp2x = item.x2 - minX + PAD;
    const lp2y = item.y2 - minY + PAD;

    ['.tl-hit', '.tl-line'].forEach(sel => {
      const l = el.querySelector(sel);
      l.setAttribute('x1', lp1x);
      l.setAttribute('y1', lp1y);
      l.setAttribute('x2', lp2x);
      l.setAttribute('y2', lp2y);
    });

    const h1 = el.querySelector('.tl-p1');
    const h2 = el.querySelector('.tl-p2');
    h1.style.left = `${lp1x}px`;
    h1.style.top  = `${lp1y}px`;
    h2.style.left = `${lp2x}px`;
    h2.style.top  = `${lp2y}px`;

    const label = el.querySelector('.tl-label');
    if (label && document.activeElement !== label) {
      label.textContent = item.label || '';
    }
    // put label near midpoint
    if (label) {
      label.style.left = `${(lp1x + lp2x) / 2 - 20}px`;
      label.style.top  = `${(lp1y + lp2y) / 2 - 22}px`;
    }
  }

  function removeItem(id) {
    state.items = state.items.filter(i => i.id !== id);
    const el = overlay.querySelector(`[data-id="${id}"]`);
    if (el) el.remove();
    if (state.selected === id) state.selected = null;
    renderInspector();
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
      if (e.target.classList.contains('line-handle')) return;
      if (e.target.classList.contains('swatch')) return;
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
      // Candles magnet to their neighbours on the X axis to keep a clean
      // time grid. Zones snap into the gap between adjacent candles to
      // feel like a Fair Value Gap.
      if (CANDLE_KINDS.has(item.kind)) {
        applyCandleMagnet(item);
      } else if (item.kind === KIND.ZONE) {
        applyZoneFVGMagnet(item);
      }
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

  // Snap a candle so its x lands on the same even-spaced grid as the
  // other candles on the canvas. We look for the nearest candle, then
  // project the current position onto the nearest CANDLE_SPACING slot
  // around it. Any slot within SNAP_THRESHOLD wins.
  function applyCandleMagnet(item) {
    const others = state.items.filter(i =>
      i.id !== item.id && CANDLE_KINDS.has(i.kind)
    );
    if (others.length === 0) return;
    let bestDelta = Infinity;
    let bestX = item.x;
    for (const o of others) {
      // try to sit 1..6 slots away, on either side of this neighbour
      for (let k = -6; k <= 6; k++) {
        if (k === 0) continue;
        const target = o.x + k * CANDLE_SPACING;
        const d = Math.abs(target - item.x);
        if (d < bestDelta) { bestDelta = d; bestX = target; }
      }
    }
    if (bestDelta <= SNAP_THRESHOLD) {
      item.x = bestX;
    }
  }

  // FVG-style zone magnet: when a zone is dragged near the gap between
  // two adjacent candles, snap it to fill that gap horizontally. The
  // vertical position stays wherever the user drops it.
  function applyZoneFVGMagnet(item) {
    const candles = state.items
      .filter(i => CANDLE_KINDS.has(i.kind))
      .sort((a, b) => a.x - b.x);
    if (candles.length < 2) return;

    const zoneCenter = item.x + item.width / 2;

    let bestDelta = Infinity;
    let bestX = null;
    let bestW = null;

    for (let i = 0; i < candles.length - 1; i++) {
      const left  = candles[i];
      const right = candles[i + 1];
      const gapStart = left.x + (left.width || 22);
      const gapEnd   = right.x;
      if (gapEnd - gapStart < 4) continue; // candles touching
      const gapCenter = (gapStart + gapEnd) / 2;
      const d = Math.abs(zoneCenter - gapCenter);
      if (d < bestDelta) {
        bestDelta = d;
        bestX = gapStart - 2;
        bestW = (gapEnd - gapStart) + 4;
      }
    }

    if (bestDelta <= ZONE_FVG_THRESHOLD && bestX !== null) {
      item.x = bestX;
      item.width = Math.max(bestW, 14);
    }
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
      item.kind = item.kind === KIND.BULL ? KIND.BEAR : KIND.BULL;
      renderItem(item);
      renderInspector();
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

  // ---------- Line (horizontal) editing + resizing ----------
  function attachLineEdit(el, item) {
    const label = el.querySelector('.line-label');
    if (!label) return;

    const finish = () => {
      label.contentEditable = 'false';
      const txt = label.textContent.replace(/\s+/g, ' ').trim();
      item.label = txt;
      label.textContent = txt || (LINE_DEFAULTS[item.kind] && LINE_DEFAULTS[item.kind].defaultLabel) || '';
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

    el.addEventListener('dblclick', (e) => {
      if (e.target.classList.contains('line-handle')) return;
      if (e.target.classList.contains('swatch')) return;
      beginEdit(e);
    });

    label.addEventListener('blur', finish);
    label.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter')  { e.preventDefault(); label.blur(); }
      if (e.key === 'Escape') {
        e.preventDefault();
        label.textContent = item.label || '';
        label.blur();
      }
    });
    label.addEventListener('pointerdown', (e) => {
      if (label.contentEditable === 'true') e.stopPropagation();
    });
  }

  function attachLineHandles(el, item) {
    const MIN_W = 40;
    const bind = (selector, side) => {
      const h = el.querySelector(selector);
      if (!h) return;
      h.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        select(item.id);
        const start = pointer(e);
        const origX = item.x;
        const origW = item.width;
        const onMove = (ev) => {
          const pt = pointer(ev);
          const dx = pt.x - start.x;
          if (side === 'right') {
            item.width = Math.max(MIN_W, origW + dx);
          } else {
            // left handle: move x and shrink/grow width from the left
            let newX = origX + dx;
            let newW = origW - dx;
            if (newW < MIN_W) {
              newW = MIN_W;
              newX = origX + origW - MIN_W;
            }
            item.x = newX;
            item.width = newW;
          }
          clampItem(item);
          renderItem(item);
          renderInspector();
        };
        const onUp = () => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
      });
    };
    bind('.line-handle.h-left',  'left');
    bind('.line-handle.h-right', 'right');
  }

  // ---------- Trendline (diagonal) handlers ----------
  function attachTrendlineDrag(el, item) {
    // We can't rely on the whole wrapper receiving pointer events (its
    // pointer-events are off so the canvas underneath stays usable), so we
    // install the drag starter on the inner hit-line only.
    const hit = el.querySelector('.tl-hit');
    if (!hit) return;
    hit.addEventListener('pointerdown', (e) => {
      if (e.target.classList.contains('tl-handle')) return;
      if (e.target.classList.contains('swatch')) return;
      if (e.target.isContentEditable) return;
      e.preventDefault();
      e.stopPropagation();
      select(item.id);
      const start = pointer(e);
      const o1x = item.x1, o1y = item.y1;
      const o2x = item.x2, o2y = item.y2;
      const onMove = (ev) => {
        const pt = pointer(ev);
        const dx = pt.x - start.x;
        const dy = pt.y - start.y;
        item.x1 = o1x + dx; item.y1 = o1y + dy;
        item.x2 = o2x + dx; item.y2 = o2y + dy;
        clampItem(item);
        renderItem(item);
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });
  }

  function attachTrendlineHandles(el, item) {
    const bind = (selector, which) => {
      const h = el.querySelector(selector);
      if (!h) return;
      h.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        select(item.id);
        const start = pointer(e);
        const o = { x1: item.x1, y1: item.y1, x2: item.x2, y2: item.y2 };
        const onMove = (ev) => {
          const pt = pointer(ev);
          const dx = pt.x - start.x;
          const dy = pt.y - start.y;
          if (which === 'p1') {
            item.x1 = o.x1 + dx;
            item.y1 = o.y1 + dy;
          } else {
            item.x2 = o.x2 + dx;
            item.y2 = o.y2 + dy;
          }
          clampItem(item);
          renderItem(item);
          renderInspector();
        };
        const onUp = () => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
      });
    };
    bind('.tl-p1', 'p1');
    bind('.tl-p2', 'p2');
  }

  function attachTrendlineEdit(el, item) {
    const label = el.querySelector('.tl-label');
    if (!label) return;

    const finish = () => {
      label.contentEditable = 'false';
      const txt = label.textContent.replace(/\s+/g, ' ').trim();
      item.label = txt;
      label.textContent = txt;
      renderInspector();
    };

    label.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      label.contentEditable = 'true';
      label.focus();
      const r = document.createRange();
      r.selectNodeContents(label);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
    });
    label.addEventListener('blur', finish);
    label.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter')  { e.preventDefault(); label.blur(); }
      if (e.key === 'Escape') {
        e.preventDefault();
        label.textContent = item.label || '';
        label.blur();
      }
    });
    label.addEventListener('pointerdown', (e) => {
      if (label.contentEditable === 'true') e.stopPropagation();
    });
  }

  function pointer(e) {
    const rect = chart.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function clampItem(item) {
    const rect = chart.getBoundingClientRect();
    if (item.kind === KIND.TRENDLINE) {
      const clampP = (x, y) => ({
        x: Math.max(0, Math.min(rect.width,  x)),
        y: Math.max(0, Math.min(rect.height, y)),
      });
      const p1 = clampP(item.x1, item.y1);
      const p2 = clampP(item.x2, item.y2);
      item.x1 = p1.x; item.y1 = p1.y;
      item.x2 = p2.x; item.y2 = p2.y;
      return;
    }
    const w = item.width || 40;
    let h;
    if (CANDLE_KINDS.has(item.kind)) {
      h = (item.topWick || 0) + (item.bodyH || 0) + (item.botWick || 0);
    } else if (LINE_KINDS.has(item.kind)) {
      h = 3;
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
      bull:      '● BULL CANDLE',
      bear:      '● BEAR CANDLE',
      tp:        '─ TP',
      sl:        '─ SL',
      entry:     '─ ENTRY',
      trendline: '╱ TRENDLINE',
      zone:      '▢ FVG / ZONE',
      note:      '✦ NOTE',
    };
    return map[item.kind] || item.kind;
  }
  function metaFor(item) {
    if (CANDLE_KINDS.has(item.kind)) {
      return `body:${Math.round(item.bodyH)} · top:${Math.round(item.topWick)} · bot:${Math.round(item.botWick)}`;
    }
    if (item.kind === KIND.NOTE) return `"${item.text}"`;
    if (item.kind === KIND.ZONE) return `"${item.text}" · ${Math.round(item.width)}×${Math.round(item.height)}`;
    if (item.kind === KIND.TRENDLINE) {
      const dx = item.x2 - item.x1;
      const dy = item.y2 - item.y1;
      const len = Math.round(Math.sqrt(dx * dx + dy * dy));
      return `${item.label || 'trendline'} · len:${len}`;
    }
    if (LINE_KINDS.has(item.kind)) {
      return `${item.label || ''} · w:${Math.round(item.width)}`;
    }
    return `x:${Math.round(item.x)} y:${Math.round(item.y)} · w:${item.width || ''}`;
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
    switch (action) {
      case 'add-bull': {
        const slot = nextCandleSlot();
        newItem(KIND.BULL, slot.x, slot.y);
        break;
      }
      case 'add-bear': {
        const slot = nextCandleSlot();
        newItem(KIND.BEAR, slot.x, slot.y);
        break;
      }
      case 'add-tp':       newItem(KIND.TP,       60, c.y - 120); break;
      case 'add-sl':       newItem(KIND.SL,       60, c.y + 120); break;
      case 'add-entry':    newItem(KIND.ENTRY,    60, c.y);       break;
      case 'add-diagonal': newItem(KIND.TRENDLINE, c.x - 60, c.y - 30); break;
      case 'add-zone':     newItem(KIND.ZONE,      c.x - 40, c.y - 30); break;
      case 'add-note':     newItem(KIND.NOTE,      c.x, c.y - 80); break;
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

  function pushLine(kind, x, y, width, label) {
    state.uid++;
    const d = LINE_DEFAULTS[kind];
    state.items.push({
      id: state.uid, kind, x, y, width,
      label: label || (d && d.defaultLabel) || '',
      color: d && d.color,
      glow:  d && d.glow,
    });
  }

  function presetBreakout() {
    clearAll();
    const r = chart.getBoundingClientRect();
    const baseY = r.height / 2;
    const spacing = CANDLE_SPACING;
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
    pushLine(KIND.ENTRY, 60, baseY - 30,  r.width - 120, 'ENTRY');
    pushLine(KIND.TP,    60, baseY - 150, r.width - 120, 'TP');
    pushLine(KIND.SL,    60, baseY + 40,  r.width - 120, 'SL');
    state.uid++;
    state.items.push({ id: state.uid, kind: KIND.NOTE, x: startX + 4 * spacing + 30, y: baseY - 180, text: 'BREAKOUT' });
    state.items.forEach(renderItem);
    renderInspector(); hideHint();
  }

  function presetReversal() {
    clearAll();
    const r = chart.getBoundingClientRect();
    const baseY = r.height / 2 - 80;
    const spacing = CANDLE_SPACING;
    const startX = r.width / 2 - (spacing * 4);
    for (let i = 0; i < 4; i++) {
      const bodyH = 80 - i * 10;
      const w = 12;
      const total = candleTotal(bodyH, w, w);
      pushCandle(KIND.BEAR, startX + i * spacing, baseY + i * 30 - total / 2, bodyH, w, w);
    }
    for (let i = 0; i < 4; i++) {
      const bodyH = 50 + i * 15;
      const w = 12;
      const total = candleTotal(bodyH, w, w);
      pushCandle(KIND.BULL, startX + (4 + i) * spacing, baseY + (4 - i) * 30 - 20 - total / 2, bodyH, w, w);
    }
    pushLine(KIND.ENTRY, 60, baseY + 120, r.width - 120, 'ENTRY');
    pushLine(KIND.TP,    60, baseY - 20,  r.width - 120, 'TP');
    pushLine(KIND.SL,    60, baseY + 180, r.width - 120, 'SL');
    state.uid++;
    state.items.push({ id: state.uid, kind: KIND.NOTE, x: startX + 4 * spacing - 20, y: baseY + 200, text: 'REVERSAL' });
    state.items.forEach(renderItem);
    renderInspector(); hideHint();
  }

  function presetLiquiditySweep() {
    clearAll();
    const r = chart.getBoundingClientRect();
    const baseY = r.height / 2;
    const spacing = CANDLE_SPACING;
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
    renderInspector(); hideHint();
  }

  // ---------- User profile (per-user private history) ----------
  // Every user on this device picks a trader handle. All autosave and
  // history entries are namespaced by that handle, so two people sharing
  // a browser never see each other's setups.

  const USER_REGISTRY_KEY = 'foxtrot-edger:current-user';

  function currentUser() {
    return localStorage.getItem(USER_REGISTRY_KEY) || 'anon';
  }

  function setUser(name) {
    const clean = String(name || '').trim().slice(0, 24) || 'anon';
    localStorage.setItem(USER_REGISTRY_KEY, clean);
    renderUserChip();
    return clean;
  }

  function userKey(suffix) {
    return `foxtrot-edger:${currentUser()}:${suffix}`;
  }

  function renderUserChip() {
    const el = document.getElementById('userName');
    if (el) el.textContent = currentUser();
  }

  function promptForUser() {
    const name = prompt(
      'Enter your trader handle.\nYour canvas history is private to this name on this device.',
      currentUser() === 'anon' ? '' : currentUser()
    );
    if (name === null) return;
    const final = setUser(name);
    flash('USER: ' + final.toUpperCase());
    // Reload history view so it shows the new user's snapshots.
    if (document.getElementById('historyModal').classList.contains('open')) {
      renderHistoryList();
    }
  }

  // ---------- Private history (per user) ----------
  const HISTORY_LIMIT = 30;

  function historyKey() { return userKey('history'); }
  function autosaveKey() { return userKey('autosave'); }

  function loadHistory() {
    try {
      const raw = localStorage.getItem(historyKey());
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (_) { return []; }
  }

  function writeHistory(arr) {
    try { localStorage.setItem(historyKey(), JSON.stringify(arr)); }
    catch (e) { console.warn('history quota', e); }
  }

  function pushHistory(label) {
    const entry = {
      id: `snap-${Date.now()}-${Math.floor(Math.random() * 1e4)}`,
      label: label || `Snapshot ${new Date().toLocaleString()}`,
      savedAt: new Date().toISOString(),
      pair: document.getElementById('pairInput').value,
      payload: serialize(),
      bulls: state.items.filter(i => i.kind === KIND.BULL).length,
      bears: state.items.filter(i => i.kind === KIND.BEAR).length,
      count: state.items.length,
    };
    const arr = loadHistory();
    arr.unshift(entry);
    while (arr.length > HISTORY_LIMIT) arr.pop();
    writeHistory(arr);
    return entry;
  }

  function removeHistory(id) {
    const arr = loadHistory().filter(e => e.id !== id);
    writeHistory(arr);
  }

  function restoreHistory(id) {
    const entry = loadHistory().find(e => e.id === id);
    if (!entry) { flash('NOT FOUND'); return; }
    hydrateFromPayload(entry.payload);
    flash('RESTORED ✓');
  }

  function hydrateFromPayload(data) {
    if (!data || !Array.isArray(data.items)) return;
    clearAll();
    state.uid = Number(data.uid) || 1;
    if (data.pair) {
      const pi = document.getElementById('pairInput');
      if (pi) pi.value = data.pair;
    }
    const migrated = [];
    data.items.forEach(it => {
      const next = migrateItem(it);
      if (!next) return;
      migrated.push(next);
    });
    migrated.forEach(it => {
      state.items.push(it);
      renderItem(it);
    });
    state.items.forEach(clampItem);
    state.items.forEach(renderItem);
    renderInspector(); hideHint();
  }

  function renderHistoryList() {
    const body = document.getElementById('historyBody');
    const foot = document.getElementById('historyFoot');
    const arr = loadHistory();
    foot.textContent = `${arr.length} / ${HISTORY_LIMIT} snapshots · ${currentUser()}`;
    if (arr.length === 0) {
      body.innerHTML = `
        <div class="empty-history">
          <strong>No snapshots yet</strong>
          Hit <em>Snap Current Canvas</em> to save this setup<br>
          privately to <b>${currentUser()}</b>.
        </div>`;
      return;
    }
    body.innerHTML = '';
    arr.forEach(e => {
      const row = document.createElement('div');
      row.className = 'history-entry';
      const when = new Date(e.savedAt);
      const whenTxt = when.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const icon = e.bulls > e.bears ? '↑' : (e.bears > e.bulls ? '↓' : '◆');
      row.innerHTML = `
        <div class="hist-icon">${icon}</div>
        <div class="hist-info">
          <div class="hist-title"></div>
          <div class="hist-meta">${whenTxt} · ${e.count} items · ${e.pair || '—'}</div>
        </div>
        <button class="hist-del" title="Delete snapshot">✕</button>
      `;
      row.querySelector('.hist-title').textContent = e.label;
      row.addEventListener('click', (ev) => {
        if (ev.target.classList.contains('hist-del')) {
          removeHistory(e.id);
          renderHistoryList();
          return;
        }
        restoreHistory(e.id);
        closeHistory();
      });
      body.appendChild(row);
    });
  }

  function openHistory() {
    document.getElementById('historyModal').classList.add('open');
    renderHistoryList();
  }
  function closeHistory() {
    document.getElementById('historyModal').classList.remove('open');
  }

  // ---------- Save / Load ----------
  // SAVE downloads the current canvas as a JSON file AND pushes a
  // snapshot into the current user's private history. LOAD opens a
  // file picker and rehydrates the canvas from that JSON.
  // Migration lets older saves (with `wickH`) load into the new candle model.

  function serialize() {
    return {
      app: 'foxtrot-edger',
      version: 3,
      savedAt: new Date().toISOString(),
      user: currentUser(),
      pair: document.getElementById('pairInput').value,
      uid: state.uid,
      items: state.items,
    };
  }

  function migrateItem(it) {
    // Legacy kinds
    if (it.kind === 'doji')       it.kind = KIND.BULL;     // doji removed
    if (it.kind === 'support')    it.kind = KIND.TP;        // green line → TP
    if (it.kind === 'resistance') it.kind = KIND.SL;        // red line   → SL

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
    if (LINE_KINDS.has(it.kind)) {
      const d = LINE_DEFAULTS[it.kind] || {};
      if (it.color == null) it.color = d.color;
      if (it.glow  == null) it.glow  = d.glow;
      if (it.label == null) it.label = d.defaultLabel || '';
      if (it.width == null) it.width = 260;
    }
    if (it.kind === KIND.TRENDLINE) {
      if (it.color == null) it.color = '#ff2d87';
      if (it.glow  == null) it.glow  = '#ff6cb0';
      if (it.label == null) it.label = '';
    }
    if (it.kind === KIND.ZONE && !it.text) {
      it.text = 'SUPPLY / DEMAND';
    }
    return it;
  }

  function save() {
    const data = serialize();
    const payload = JSON.stringify(data, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.href = url;
    a.download = `foxtrot-edge-${currentUser()}-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    // Per-user autosave + history snapshot (private to this trader handle).
    try { localStorage.setItem(autosaveKey(), payload); } catch (_) {}
    pushHistory(`Saved ${new Date().toLocaleString(undefined, { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}`);
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
          hydrateFromPayload(data);
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

  // ---------- Theme + music ----------
  function applyTheme(theme) {
    state.theme = theme === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = state.theme;
    try { localStorage.setItem(userKey('theme'), state.theme); } catch (_) {}
    const icon = document.getElementById('themeIcon');
    if (icon) icon.textContent = state.theme === 'light' ? '☀' : '☾';
  }
  function toggleTheme() {
    applyTheme(state.theme === 'dark' ? 'light' : 'dark');
  }

  // Procedural "endless chill space ambience":
  //   - Two slowly detuned sine oscillators forming a soft drone chord,
  //     shaped by a very slow LFO on the master gain for breathing motion.
  //   - Occasional bell tones on random pentatonic notes, routed through
  //     a long feedback delay to feel endless and cavernous.
  // Everything is built on a single AudioContext that starts on first
  // toggle (required by browser autoplay rules) and is resumed afterwards.
  const audio = {
    ctx: null,
    master: null,
    drone: null,
    lfo: null,
    delay: null,
    bellTimer: null,
    started: false,
  };

  function startAmbience() {
    if (!audio.ctx) {
      try { audio.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (_) { return; }
    }
    if (audio.ctx.state === 'suspended') audio.ctx.resume();

    if (!audio.started) {
      const ctx = audio.ctx;
      const master = ctx.createGain();
      master.gain.value = 0.0001;
      master.connect(ctx.destination);

      // Long delay for endless tails
      const delay = ctx.createDelay(5.0);
      delay.delayTime.value = 0.9;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.55;
      const wet = ctx.createGain();
      wet.gain.value = 0.45;
      delay.connect(feedback).connect(delay);
      delay.connect(wet).connect(master);

      // Drone chord (soft low fifth)
      const droneGain = ctx.createGain();
      droneGain.gain.value = 0.18;
      droneGain.connect(master);
      droneGain.connect(delay);

      const freqs = [110, 138.6, 164.8]; // A2 C#3 E3
      const oscs = freqs.map(f => {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f;
        // mild detune so it feels alive
        o.detune.value = (Math.random() - 0.5) * 10;
        o.connect(droneGain);
        o.start();
        return o;
      });

      // Slow LFO shaping the drone so it breathes
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.08;
      lfo.connect(lfoGain).connect(droneGain.gain);
      lfo.start();

      // Bell voice factory
      const pentatonic = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
      const bell = () => {
        if (!audio.started) return;
        const now = ctx.currentTime;
        const f = pentatonic[Math.floor(Math.random() * pentatonic.length)];
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(0.12, now + 0.04);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);
        o.connect(g).connect(delay);
        o.start(now);
        o.stop(now + 3.4);
        audio.bellTimer = setTimeout(bell, 3500 + Math.random() * 6500);
      };
      audio.bellTimer = setTimeout(bell, 1500);

      // Fade in
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(0.0001, ctx.currentTime);
      master.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 2.2);

      audio.master = master;
      audio.drone  = { oscs, gain: droneGain };
      audio.lfo    = lfo;
      audio.delay  = delay;
      audio.started = true;
    } else {
      // Resume existing graph
      const ctx = audio.ctx;
      audio.master.gain.cancelScheduledValues(ctx.currentTime);
      audio.master.gain.setValueAtTime(audio.master.gain.value, ctx.currentTime);
      audio.master.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 1.2);
    }
  }

  function stopAmbience() {
    if (!audio.ctx || !audio.master) return;
    const ctx = audio.ctx;
    audio.master.gain.cancelScheduledValues(ctx.currentTime);
    audio.master.gain.setValueAtTime(audio.master.gain.value, ctx.currentTime);
    audio.master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
  }

  function toggleMusic() {
    state.musicOn = !state.musicOn;
    const icon = document.getElementById('musicIcon');
    const btn  = document.getElementById('musicBtn');
    if (state.musicOn) {
      startAmbience();
      if (icon) icon.textContent = '♫';
      if (btn)  btn.classList.add('active');
      flash('AMBIENCE ON');
    } else {
      stopAmbience();
      if (icon) icon.textContent = '♪';
      if (btn)  btn.classList.remove('active');
      flash('AMBIENCE OFF');
    }
    try { localStorage.setItem(userKey('music'), state.musicOn ? '1' : '0'); } catch (_) {}
  }

  // ---------- Bindings ----------
  document.querySelectorAll('.tool').forEach(btn => {
    btn.addEventListener('click', () => handleToolAction(btn.dataset.action));
  });

  // TF pills
  document.querySelectorAll('.tf-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const tf = pill.dataset.tf;
      if (!TF_SECONDS[tf]) return;
      state.tf = tf;
      document.querySelectorAll('.tf-pill').forEach(p => p.classList.toggle('active', p === pill));
      renderTimeAxis();
      try { localStorage.setItem(userKey('tf'), tf); } catch (_) {}
    });
  });

  // Start time picker
  const startTimeInput = document.getElementById('startTimeInput');
  if (startTimeInput) {
    startTimeInput.value = state.startTime;
    startTimeInput.addEventListener('change', () => {
      state.startTime = startTimeInput.value || defaultStartTime();
      renderTimeAxis();
      try { localStorage.setItem(userKey('startTime'), state.startTime); } catch (_) {}
    });
  }

  // Theme + music
  document.getElementById('themeBtn').addEventListener('click', toggleTheme);
  document.getElementById('musicBtn').addEventListener('click', toggleMusic);

  document.getElementById('clearBtn').addEventListener('click', clearAll);
  document.getElementById('saveBtn').addEventListener('click', save);
  document.getElementById('loadBtn').addEventListener('click', load);
  document.getElementById('historyBtn').addEventListener('click', openHistory);
  document.getElementById('historyClose').addEventListener('click', closeHistory);
  document.getElementById('historyModal').addEventListener('click', (e) => {
    if (e.target.id === 'historyModal') closeHistory();
  });
  document.getElementById('historySnap').addEventListener('click', () => {
    const label = prompt('Name this snapshot:', `Setup ${new Date().toLocaleString()}`);
    if (label === null) return;
    pushHistory(label.trim() || `Snapshot ${new Date().toLocaleString()}`);
    renderHistoryList();
    flash('SNAP ✓');
  });
  document.getElementById('userChip').addEventListener('click', promptForUser);

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

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeHistory();
  });

  // ---------- Boot ----------
  // Per-user persisted preferences
  try {
    const savedTheme = localStorage.getItem(userKey('theme'));
    applyTheme(savedTheme || 'dark');
  } catch (_) { applyTheme('dark'); }
  try {
    const savedTf = localStorage.getItem(userKey('tf'));
    if (savedTf && TF_SECONDS[savedTf]) {
      state.tf = savedTf;
      document.querySelectorAll('.tf-pill').forEach(p => p.classList.toggle('active', p.dataset.tf === savedTf));
    }
    const savedStart = localStorage.getItem(userKey('startTime'));
    if (savedStart) {
      state.startTime = savedStart;
      if (startTimeInput) startTimeInput.value = savedStart;
    }
  } catch (_) {}

  renderAxes();
  renderUserChip();
  requestAnimationFrame(() => {
    renderGrid();
    // Restore this user's autosave if present, otherwise seed the demo.
    const raw = localStorage.getItem(autosaveKey());
    if (raw) {
      try {
        const data = JSON.parse(raw);
        hydrateFromPayload(data);
      } catch (_) {
        presetBreakout();
      }
    } else {
      presetBreakout();
    }
  });
})();
