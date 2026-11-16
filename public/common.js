/* 12th Coach — shared helpers for all views. No dependencies. */
'use strict';

const $ = (sel, root = document) => root.querySelector(sel);

function h(tag, attrs, ...kids) {
  const node = document.createElement(tag);
  setAttrs(node, attrs);
  append(node, kids);
  return node;
}
function svg(tag, attrs, ...kids) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  setAttrs(node, attrs);
  append(node, kids);
  return node;
}
function setAttrs(node, attrs) {
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value == null || value === false) continue;
    if (key === 'text') node.textContent = value;
    else if (key === 'class') node.setAttribute('class', value);
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
    else node.setAttribute(key, value === true ? '' : value);
  }
}
function append(node, kids) {
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    node.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
}

const fmt = (n) => Number(n || 0).toLocaleString('en-US');
const pctText = (v) => Math.round(v) + '%';
const seriesColor = (i) => `var(--s${(i % 4) + 1})`;
const TYPE_NAMES = { sub: 'Substitution', shape: 'Shape', potm: 'Player of the moment', plan: 'Game plan' };

function store(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch (e) { /* private mode: carry on without persistence */ }
  return value;
}

function fanId() {
  let id = store('12c-fan-id');
  if (!id) {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    id = 'f' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    store('12c-fan-id', id);
  }
  return id;
}

async function api(path, body, headers) {
  const res = await fetch(path, body === undefined ? { headers } : {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(headers || {}) }, body: JSON.stringify(body),
  });
  return res.json();
}

/* Live connection: the server pushes {state, me} over Server-Sent Events. */
function connect(params, onMessage, onStatus) {
  const query = new URLSearchParams(params || {}).toString();
  const source = new EventSource('/api/stream' + (query ? '?' + query : ''));
  source.onmessage = (ev) => { onStatus && onStatus(true); onMessage(JSON.parse(ev.data)); };
  source.onerror = () => { onStatus && onStatus(false); };   // EventSource reconnects by itself
  return source;
}

/* Tooltip for any element with data-tip. */
(function tooltip() {
  let tip;
  const show = (ev) => {
    const target = ev.target.closest && ev.target.closest('[data-tip]');
    if (!tip) { tip = h('div', { id: 'tip', role: 'tooltip' }); document.body.append(tip); }
    if (!target) { tip.classList.remove('on'); return; }
    tip.textContent = target.getAttribute('data-tip');
    tip.classList.add('on');
    const pad = 12, w = tip.offsetWidth, ht = tip.offsetHeight;
    let x = ev.clientX + pad, y = ev.clientY - ht - pad;
    if (x + w > innerWidth - 8) x = ev.clientX - w - pad;
    if (y < 8) y = ev.clientY + pad;
    tip.style.left = Math.max(8, x) + 'px';
    tip.style.top = y + 'px';
  };
  document.addEventListener('mousemove', show);
  document.addEventListener('mouseleave', () => tip && tip.classList.remove('on'));
})();

function sourceBadge(summary) {
  if (!summary) return null;
  if (summary.source === 'gemini') return h('span', { class: 'chip chip-good', text: 'Written by Gemini' });
  if (summary.source === 'seed') return h('span', { class: 'chip', text: 'Seeded demo record' });
  return h('span', { class: 'chip', 'data-tip': 'Gemini was not reachable, so this summary was computed from the vote data.', text: 'Offline fallback' });
}

/* ---- Moment detail (club dashboard and Fan Insight Pool records) ----------
   build() creates the DOM once; update() moves bars in place so they animate. */
function momentDetail(d) {
  const labels = d.options.map((o) => o.label);
  const k = labels.length;
  const refs = { w: [], u: [], wv: [], uv: [], maj: [], blocks: [], countries: [] };

  const resultRows = labels.map((label, i) => {
    refs.w[i] = h('div', { class: 'fill', style: { background: seriesColor(i) } });
    refs.u[i] = h('div', { class: 'fill', style: { background: seriesColor(i) } });
    refs.wv[i] = h('b');
    refs.uv[i] = h('span', { class: 'muted' });
    refs.maj[i] = h('span', { class: 'chip', text: 'Fan majority', hidden: true });
    return h('div', { class: 'res-row' },
      h('div', { class: 'res-head' },
        h('span', { class: 'dot', style: { background: seriesColor(i) } }),
        h('span', { class: 'res-label', text: label }),
        refs.maj[i],
        d.coach === i ? h('span', { class: 'chip chip-ink', text: 'Coach\'s decision' }) : null,
        h('span', { class: 'pair-val' }, refs.wv[i], refs.uv[i])),
      h('div', { class: 'track' }, refs.w[i]),
      h('div', { class: 'track thin' }, refs.u[i]));
  });

  const legend = () => h('div', { class: 'legend' },
    labels.map((label, i) => h('span', {}, h('span', { class: 'dot', style: { background: seriesColor(i) } }), label)));

  const stackRows = (groups, bucket) => groups.map((g) => {
    const segs = labels.map((_, i) => h('div', {
      class: 'seg' + (i === 3 ? ' dark-label' : ''), style: { background: seriesColor(i), flexGrow: 0, flexBasis: 0 },
    }));
    const stack = h('div', { class: 'stack' }, segs);
    const n = h('span', { class: 'n' });
    bucket.push({ segs, stack, n, name: g.name });
    return h('div', { class: 'stack-row' }, h('span', { text: g.name }), stack, n);
  });

  refs.n = h('span', { class: 'num' });
  const head = h('div', { class: 'row', style: { marginBottom: '14px', alignItems: 'flex-start' } },
    h('div', { style: { flex: '1', minWidth: '260px' } },
      h('div', { class: 'row', style: { marginBottom: '6px' } },
        h('span', { class: 'chip chip-red', text: d.minute + "'" }),
        h('span', { class: 'chip', text: TYPE_NAMES[d.type] || d.title }),
        d.matchLabel ? h('span', { class: 'chip', text: d.matchLabel }) : null,
        d.majorityMatched === true ? h('span', { class: 'chip chip-good', text: '✓ Fan majority matched the coach' }) : null,
        d.majorityMatched === false ? h('span', { class: 'chip', text: 'Fan majority differed from the coach' }) : null),
      h('h2', { text: d.question, style: { fontSize: '22px' } }),
      d.context ? h('p', { class: 'muted', text: d.context }) : null),
    h('div', { class: 'tile', style: { minWidth: '150px' } },
      h('div', { class: 'label', text: 'Responses' }), h('div', { class: 'value' }, refs.n)));

  const reasons = (d.clusters || []).map((c) => h('div', { class: 'reason-row' },
    h('span', {}, h('b', { text: c.label }), c.option ? h('span', { class: 'muted', text: '  → ' + c.option }) : null),
    h('span', { class: 'share', text: c.share + '%' }),
    h('div', { class: 'track' }, h('div', { class: 'fill', style: { width: Math.min(100, c.share) + '%' } }))));

  const el = h('div', {},
    head,
    h('div', { class: 'grid grid-2' },
      h('div', { class: 'card' },
        h('h3', { text: 'Result: with and without Loyalty Boost' }),
        h('p', { class: 'sub', text: 'Thick bar and bold number: weighted by Loyalty Boost. Thin bar: one fan, one vote.' }),
        resultRows),
      h('div', { class: 'card' },
        h('h3', { text: 'Fan Pulse' }),
        h('p', { class: 'sub', text: 'Gemini merges the answers and free-text reasons, in any language, into one summary.' }),
        h('div', { class: 'pulse' },
          h('div', { class: 'pulse-head' }, 'Summary', sourceBadge(d.summary)),
          h('p', { text: d.summary ? d.summary.text : 'Gemini is reading the first answers…' })),
        h('h3', { text: 'Top three reasons', style: { marginTop: '18px' } }),
        reasons.length ? reasons : h('p', { class: 'muted small', text: 'Reason clusters appear with the summary.' })),
      h('div', { class: 'card' },
        h('h3', { text: 'By stadium block' }),
        h('p', { class: 'sub', text: 'Share of each option within the block. Unweighted.' }),
        legend(), stackRows(d.byBlock, refs.blocks)),
      h('div', { class: 'card' },
        h('h3', { text: 'By country' }),
        h('p', { class: 'sub', text: 'Share of each option within the country. Unweighted.' }),
        legend(), stackRows(d.byCountry, refs.countries))));

  function updateStacks(groups, bucket) {
    groups.forEach((g, gi) => {
      const ref = bucket[gi];
      if (!ref) return;
      ref.n.textContent = fmt(g.n);
      ref.stack.classList.toggle('empty', !g.n);
      g.pct.forEach((p, i) => {
        const seg = ref.segs[i];
        seg.style.flexGrow = g.n ? p : 0;
        seg.style.display = g.n && p > 0 ? '' : 'none';
        seg.textContent = p >= 14 ? Math.round(p) : '';
        seg.setAttribute('data-tip', `${g.name} · ${labels[i]}\n${p.toFixed(1)}% of ${fmt(g.n)} answers`);
      });
    });
  }

  function update(nd) {
    refs.n.textContent = fmt(nd.n);
    for (let i = 0; i < k; i++) {
      refs.w[i].style.width = nd.weightedPct[i] + '%';
      refs.u[i].style.width = nd.unweightedPct[i] + '%';
      refs.wv[i].textContent = nd.weightedPct[i].toFixed(1) + '%';
      refs.uv[i].textContent = nd.unweightedPct[i].toFixed(1) + '% unweighted';
      refs.maj[i].hidden = !(nd.n > 0 && nd.majority === i);
    }
    updateStacks(nd.byBlock, refs.blocks);
    updateStacks(nd.byCountry, refs.countries);
  }

  update(d);
  return { el, update };
}

/* Rebuild only when the structure changes; otherwise update in place. */
function detailKey(d) {
  return JSON.stringify([d.id, d.status, d.options.map((o) => o.label), d.summary, d.clusters, d.coach,
    d.majorityMatched, d.byBlock.map((g) => g.name)]);
}
