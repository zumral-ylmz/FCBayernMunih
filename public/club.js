/* 12th Coach — club dashboard: live match + Fan Insight Pool. */
'use strict';

let state = null;
let selected = null;        // moment id picked by the user; null = follow the latest
let detail = null, detailK = null;
let timelineKey = null;
let pool = null, poolStamp = null;
let recSelected = null;

function tile(label, value, hint) {
  return h('div', { class: 'tile' }, h('div', { class: 'label', text: label }), h('div', { class: 'value num', text: value }),
    hint ? h('div', { class: 'hint', text: hint }) : null);
}

/* ---- tabs ---- */
function showTab(name) {
  $('#view-live').hidden = name !== 'live';
  $('#view-pool').hidden = name !== 'pool';
  $('#tab-live').setAttribute('aria-selected', name === 'live');
  $('#tab-pool').setAttribute('aria-selected', name === 'pool');
  history.replaceState(null, '', name === 'pool' ? '#pool' : location.pathname);
  if (name === 'pool') loadPool(true);
}
$('#tab-live').addEventListener('click', () => showTab('live'));
$('#tab-pool').addEventListener('click', () => showTab('pool'));

/* ---- live match ---- */
function renderLive() {
  const m = state.match;
  const fired = state.moments.filter((x) => x.status !== 'pending');
  const current = (selected && fired.find((x) => x.id === selected)) || fired[fired.length - 1] || null;
  const resolved = fired.filter((x) => x.status === 'resolved');
  const matched = resolved.filter((x) => x.majorityMatched).length;

  $('#scoreline').textContent = `${m.home.name} ${m.score[0]} : ${m.score[1]} ${m.away.name} · ${m.minute}'` +
    (m.status === 'idle' ? ' · not started' : m.status === 'finished' ? ' · full time' : '');
  $('#tiles').replaceChildren(
    tile('Responses, this moment', current ? fmt(current.n) : '–', current ? current.minute + "' · " + TYPE_NAMES[current.type] : 'No moment fired yet'),
    tile('Decision moments', `${fired.length} / ${state.moments.length}`, resolved.length + ' resolved'),
    tile('Fan majority matched coach', resolved.length ? `${matched} / ${resolved.length}` : '–', 'Resolved moments in this match'),
    tile('Live devices', fmt(state.participants), state.config.crowd ? 'Real phones, on top of the simulated crowd' : 'Real phones only, no simulated crowd'));

  const tKey = JSON.stringify([state.moments.map((x) => [x.id, x.status, x.minute]), current && current.id]);
  if (tKey !== timelineKey) {
    timelineKey = tKey;
    const progress = h('div', { class: 'progress', id: 'tl-progress' });
    $('#timeline').replaceChildren(
      h('div', { class: 'axis' }), progress,
      ...[0, 15, 30, 45, 60, 75, 90].map((t) => h('span', { class: 'tick', style: { left: (t / 90 * 100) + '%' }, text: t + "'" })),
      ...state.moments.map((x) => h('button', {
        class: `marker ${x.status}` + (current && current.id === x.id ? ' sel' : ''),
        style: { left: (x.minute / 90 * 100) + '%' }, disabled: x.status === 'pending',
        'data-tip': x.status === 'pending' ? `Scheduled for minute ${x.minute}` : `${TYPE_NAMES[x.type]} · ${x.status}`,
        'aria-label': `${TYPE_NAMES[x.type]}, minute ${x.minute}, ${x.status}`,
        onclick: () => { selected = x.id; timelineKey = null; renderLive(); },
      }, h('span', { class: 'state', text: { pending: 'scheduled', open: 'voting now', closed: 'awaiting coach', resolved: 'resolved' }[x.status] }),
      h('span', { class: 'pin', text: x.minute + "'" }), h('span', { class: 'stem' }))));
  }
  const bar = $('#tl-progress');
  if (bar) bar.style.width = (m.minute / 90 * 100) + '%';

  const slot = $('#detail');
  if (!current) {
    if (detailK !== 'empty') {
      detailK = 'empty'; detail = null;
      slot.replaceChildren(h('div', { class: 'empty' }, h('b', { text: 'No decision moment yet' }),
        'Start the match in the operator panel and fire the first moment. Results stream in here live.'));
    }
    return;
  }
  const key = detailKey(current);
  if (key !== detailK) {
    detailK = key;
    detail = momentDetail(current);
    slot.replaceChildren(detail.el);
  } else {
    detail.update(current);
  }
  if (resolvedStamp() !== poolStamp && !$('#view-pool').hidden) loadPool(true);
}

/* ---- Fan Insight Pool ---- */
function resolvedStamp() {
  if (!state) return '';
  return state.moments.filter((x) => x.status === 'resolved').map((x) => x.id + (x.summary ? x.summary.source + x.summary.final : '')).join(',');
}

async function loadPool(force) {
  if (pool && !force) return;
  poolStamp = resolvedStamp();          // set first so live ticks do not start parallel loads
  pool = await api('/api/pool');
  renderPool();
}

function matchOf(id) { return pool.matches.find((m) => m.id === id); }

function renderPool() {
  const { matches, records } = pool;
  const total = records.reduce((sum, r) => sum + r.n, 0);
  const hit = records.filter((r) => r.majorityMatched).length;
  $('#pool-tiles').replaceChildren(
    tile('Matches in the pool', matches.length, 'Grows with every match'),
    tile('Decision moments', records.length, 'Each stored as one aggregated record'),
    tile('Answers collected', fmt(total), 'Anonymised and aggregated'),
    tile('Fan majority matched coach', Math.round(hit / records.length * 100) + '%', `${hit} of ${records.length} moments`));

  if (!$('#ask-chips').children.length) {
    $('#ask-chips').replaceChildren(...pool.examples.map((q) => h('button', { type: 'button', text: q, onclick: () => { $('#ask-input').value = q; ask(); } })));
  }
  columnChart($('#chart-match'), matches.map((m) => ({
    label: m.short, value: m.matched / m.moments * 100,
    tip: `${m.label}\n${m.matched} of ${m.moments} moments matched (${Math.round(m.matched / m.moments * 100)}%)`,
  })));
  lineChart($('#chart-part'), matches.map((m) => ({ label: m.short, value: m.participants, tip: `${m.label}\n${fmt(m.participants)} fans took part` })));

  const counts = {};
  records.forEach((r) => r.clusters.forEach((c) => { counts[c.label] = (counts[c.label] || 0) + 1; }));
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 7);
  const max = top.length ? top[0][1] : 1;
  $('#chart-clusters').replaceChildren(...top.map(([label, n]) => h('div', { class: 'reason-row', style: { marginTop: '0', marginBottom: '10px' }, 'data-tip': `${label}\nTop-three reason in ${n} decision moments` },
    h('span', { text: label }), h('span', { class: 'share', text: n }),
    h('div', { class: 'track' }, h('div', { class: 'fill', style: { width: (n / max * 100) + '%', background: 'var(--s1)' } })))));

  renderRecords();
}

function renderRecords() {
  const venue = $('#f-venue').value, type = $('#f-type').value;
  const rows = pool.records.filter((r) => (!venue || matchOf(r.matchId).venue === venue) && (!type || r.type === type)).slice().reverse();
  $('#rec-count').textContent = rows.length + ' records';
  $('#rec-body').replaceChildren(...rows.map((r) => {
    const mt = matchOf(r.matchId);
    return h('tr', { class: recSelected === r.id ? 'sel' : null, tabindex: 0,
      onclick: () => { recSelected = r.id; renderRecords(); showRecord(r); },
      onkeydown: (ev) => { if (ev.key === 'Enter') { recSelected = r.id; renderRecords(); showRecord(r); } } },
    h('td', {}, h('b', { text: mt.short }), ' ', h('span', { class: 'muted', text: (mt.venue === 'home' ? 'vs ' : 'at ') + mt.opponent })),
    h('td', { class: 'r', text: r.minute + "'" }),
    h('td', { text: TYPE_NAMES[r.type] }),
    h('td', { text: r.question }),
    h('td', {}, r.options[r.majority].label, ' ', h('span', { class: 'muted num', text: Math.round(r.weightedPct[r.majority]) + '%' })),
    h('td', { text: r.options[r.coach].label }),
    h('td', {}, r.majorityMatched ? h('span', { class: 'chip chip-good', text: '✓ Yes' }) : h('span', { class: 'chip', text: 'No' })),
    h('td', { class: 'r', text: fmt(r.n) }));
  }));
}

function showRecord(r) {
  const view = momentDetail({ ...r, matchLabel: matchOf(r.matchId).label });
  $('#rec-detail').replaceChildren(h('div', { class: 'card' }, view.el));
  $('#rec-detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

$('#f-venue').addEventListener('change', renderRecords);
$('#f-type').addEventListener('change', renderRecords);

async function ask() {
  const question = $('#ask-input').value.trim();
  if (!question) return;
  const box = $('#answer');
  $('#ask-btn').disabled = true;
  box.replaceChildren(h('p', { class: 'muted', text: 'Reading the stored records…' }));
  try {
    const res = await api('/api/ask', { question });
    if (!res.ok) throw new Error(res.error);
    box.replaceChildren(h('div', { class: 'pulse' },
      h('div', { class: 'pulse-head' }, 'Answer', res.source === 'gemini'
        ? h('span', { class: 'chip chip-good', text: 'Answered by Gemini' })
        : h('span', { class: 'chip', 'data-tip': 'Gemini was not reachable, so this answer was computed directly from the records.', text: 'Offline fallback' })),
      h('p', { text: res.answer }),
      res.matches.length ? h('div', { class: 'row', style: { marginTop: '10px' } }, h('span', { class: 'small muted', text: 'Based on:' }),
        res.matches.map((m) => h('span', { class: 'chip', 'data-tip': m.label, text: m.short }))) : null));
  } catch (e) {
    box.replaceChildren(h('p', { class: 'error', text: e.message || 'The question could not be answered. Try again.' }));
  }
  $('#ask-btn').disabled = false;
}
$('#ask-form').addEventListener('submit', (ev) => { ev.preventDefault(); ask(); });

/* ---- charts (single series each, so no legend; values on hover, table below) ---- */
function frame(el, height) {
  const W = 340, H = height, pad = { l: 34, r: 8, t: 10, b: 22 };
  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img' });
  el.replaceChildren(root);
  return { root, W, H, pad, iw: W - pad.l - pad.r, ih: H - pad.t - pad.b };
}
function yAxis(f, max, ticks, format) {
  ticks.forEach((t) => {
    const y = f.pad.t + f.ih - (t / max) * f.ih;
    f.root.append(svg('line', { class: t === 0 ? 'baseline' : 'gridline', x1: f.pad.l, x2: f.W - f.pad.r, y1: y, y2: y }),
      svg('text', { x: f.pad.l - 6, y: y + 4, 'text-anchor': 'end', text: format(t) }));
  });
}
function columnChart(el, data) {
  const f = frame(el, 190);
  yAxis(f, 100, [0, 50, 100], (t) => t + '%');
  const step = f.iw / data.length, bw = Math.min(22, step - 6);
  data.forEach((d, i) => {
    const x = f.pad.l + i * step + (step - bw) / 2;
    const bh = Math.max(1, d.value / 100 * f.ih), y = f.pad.t + f.ih - bh;
    const r = Math.min(4, bh);
    f.root.append(
      svg('path', { class: 'col', 'data-tip': d.tip, d: `M${x},${y + bh} V${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${y + bh} Z` }),
      svg('text', { x: x + bw / 2, y: f.H - 6, 'text-anchor': 'middle', text: d.label.replace('MD', '') }));
  });
  f.root.append(svg('text', { x: f.pad.l, y: f.H - 6, 'text-anchor': 'end', text: 'MD' }));
}
function lineChart(el, data) {
  const f = frame(el, 190);
  const max = Math.ceil(Math.max(...data.map((d) => d.value)) / 5000) * 5000;
  yAxis(f, max, [0, max / 2, max], (t) => (t / 1000) + 'k');
  const step = f.iw / data.length;
  const pts = data.map((d, i) => [f.pad.l + i * step + step / 2, f.pad.t + f.ih - d.value / max * f.ih]);
  f.root.append(svg('path', { class: 'line', d: 'M' + pts.map((p) => p.join(',')).join(' L') }));
  data.forEach((d, i) => {
    const [x, y] = pts[i];
    f.root.append(svg('circle', { class: 'hit', cx: x, cy: y, r: 14, 'data-tip': d.tip }), svg('circle', { class: 'pt', cx: x, cy: y, r: 4, 'pointer-events': 'none' }),
      svg('text', { x, y: f.H - 6, 'text-anchor': 'middle', text: d.label.replace('MD', '') }));
  });
  const last = pts[pts.length - 1], prev = pts[pts.length - 2] || last;
  const below = last[1] > prev[1];   // keep the label clear of the line it follows
  f.root.append(svg('text', { class: 'label-strong', x: last[0] + 6, y: last[1] + (below ? 18 : -10), 'text-anchor': 'end', text: fmt(data[data.length - 1].value) }),
    svg('text', { x: f.pad.l, y: f.H - 6, 'text-anchor': 'end', text: 'MD' }));
}

connect({}, (msg) => { state = msg.state; renderLive(); });
if (location.hash === '#pool') showTab('pool');   // direct link: /club#pool
