/* 12th Coach — operator panel. */
'use strict';

const params = new URLSearchParams(location.search);
const KEY = params.get('key') || store('12c-operator-key') || '';
if (params.get('key')) store('12c-operator-key', KEY);
const AUTH = KEY ? { 'X-Operator-Key': KEY } : {};

let state = null;
let info = null;
let momentsKey = null;
const counters = {};      // moment id -> element showing the live response count

async function act(action, body) {
  const error = $('#action-error');
  error.hidden = true;
  try {
    const res = await api('/api/operator/' + action, body || {}, AUTH);
    if (!res.ok) { error.textContent = res.error; error.hidden = false; }
  } catch (e) {
    error.textContent = 'The server did not answer. Is it still running?';
    error.hidden = false;
  }
}

$('#btn-start').addEventListener('click', () => act('start'));
$('#btn-fire').addEventListener('click', () => act('fire'));
$('#btn-close').addEventListener('click', () => act('close'));
$('#btn-reset').addEventListener('click', () => {
  if (confirm('Reset the match? Votes, Fan IQ earned today and pilot metrics are cleared.')) act('reset');
});
$('#set-crowd').addEventListener('change', (ev) => act('config', { crowd: ev.target.checked }));
$('#set-auto').addEventListener('change', (ev) => act('config', { autoFire: ev.target.checked }));
$('#set-window').addEventListener('change', (ev) => act('config', { window: Number(ev.target.value) }));

function render() {
  if (!state || !info) return;
  const m = state.match;
  const open = state.moments.find((x) => x.status === 'open');
  const next = state.moments.find((x) => x.status === 'pending');
  const unresolved = state.moments.filter((x) => x.status === 'closed');

  $('#btn-start').disabled = m.status === 'live';
  $('#btn-start').textContent = m.status === 'finished' ? 'Start a new match' : 'Start match';
  $('#btn-fire').disabled = m.status !== 'live' || !!open || !next;
  $('#btn-close').disabled = !open;

  const status = $('#status');
  let text;
  if (m.status === 'idle') text = 'Ready. Press “Start match”.';
  else if (open) text = `${open.minute}' · Voting is open: ${Math.ceil(open.remaining)}s left, ${fmt(open.n)} answers so far.`;
  else if (m.waitingFor) text = `${m.minute}' · The clock is waiting. Fire the next decision moment.`;
  else if (unresolved.length) text = `${m.minute}' · ${m.score[0]}:${m.score[1]} · Enter the coach's decision below to resolve.`;
  else if (m.status === 'finished') text = `Full time, ${m.score[0]}:${m.score[1]}.`;
  else text = `${m.minute}' · ${m.score[0]}:${m.score[1]} · Match running` + (next ? `, next moment at ${next.minute}'.` : '.');
  status.textContent = text;
  status.classList.toggle('wait', !!m.waitingFor && !open);

  $('#set-crowd').checked = state.config.crowd;
  $('#set-auto').checked = state.config.autoFire;
  if (document.activeElement !== $('#set-window')) $('#set-window').value = String(state.config.window);

  const g = state.gemini;
  $('#gemini-status').textContent = !g.configured
    ? 'Gemini: no API key set. Summaries and answers use the built-in fallback. Add GEMINI_API_KEY to the .env file and restart.'
    : g.lastError ? `Gemini (${g.model}): last call failed, fallback used. ${g.lastError}`
      : `Gemini (${g.model}): connected. ${g.ok} of ${g.calls} calls answered.`;

  renderMoments();
}

function renderMoments() {
  const key = JSON.stringify(state.moments.map((x) => [x.id, x.status, x.coach]));
  if (key !== momentsKey) {
    momentsKey = key;
    $('#moments').replaceChildren(...state.moments.map((x) => {
      const spec = info.moments.find((s) => s.id === x.id);
      counters[x.id] = h('span', { class: 'muted small num' });
      const label = { pending: 'Scheduled', open: 'Voting now', closed: 'Awaiting coach', resolved: 'Resolved' }[x.status];
      let action = null;
      if (x.status === 'open' || x.status === 'closed') {
        const select = h('select', { class: 'input', 'aria-label': 'What the coach actually did' },
          spec.options.map((o) => h('option', { value: o.id, selected: o.id === spec.suggested, text: o.label })));
        action = h('div', { class: 'resolve' }, h('span', { class: 'small', text: (x.resolveLabel || 'What the coach actually did') + ':' }), select,
          h('button', { class: 'btn btn-primary btn-sm', text: 'Resolve', onclick: () => act('resolve', { momentId: x.id, option: select.value }) }));
      } else if (x.status === 'resolved') {
        action = h('p', { class: 'small', style: { marginTop: '8px' } }, 'Coach: ', h('b', { text: x.options[x.coach].label }),
          x.majorityMatched ? ' · fan majority matched' : ' · fan majority differed');
      }
      return h('div', { class: 'mrow' + (x.status === 'open' || x.status === 'closed' ? ' active' : '') },
        h('div', { class: 'row' },
          h('span', { class: 'chip chip-red', text: spec.minute + "'" }),
          h('b', { text: spec.question }), h('span', { class: 'spacer' }),
          counters[x.id], h('span', { class: x.status === 'resolved' ? 'chip chip-good' : 'chip', text: label })),
        action);
    }));
  }
  state.moments.forEach((x) => { if (counters[x.id]) counters[x.id].textContent = x.n != null ? fmt(x.n) + ' answers' : ''; });
}

async function pilot() {
  try {
    const p = await api('/api/pilot', undefined, AUTH);
    if (p.ok === false) return;
    const t = (label, value) => h('div', { class: 'tile', style: { padding: '10px 12px' } }, h('div', { class: 'label', text: label }), h('div', { class: 'value num', style: { fontSize: '22px' }, text: value }));
    $('#pilot-tiles').replaceChildren(
      t('Phones connected', fmt(p.devices)),
      t('Answered 3+ moments', p.devices ? `${p.threePlusPct}%` : '–'),
      t('Phones that voted', fmt(p.voted)),
      t('Summary rated fair', p.fairPct == null ? '–' : `${p.fairPct}%`));
    $('#pilot-rows').replaceChildren(...(p.moments.length ? p.moments.map((r) => h('tr', {},
      h('td', { text: `${r.minute}' ${r.title}` }), h('td', { text: fmt(r.voters) }), h('td', { text: r.participation + '%' }),
      h('td', { text: r.medianSeconds == null ? '–' : r.medianSeconds + 's' })))
      : [h('tr', {}, h('td', { colspan: 4, class: 'muted', text: 'No decision moment fired yet.' }))]));
  } catch (e) { /* next poll will retry */ }
}

async function init() {
  info = await api('/api/operator/info', undefined, AUTH);
  if (info.ok === false) { $('#auth-error').hidden = false; return; }
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  const base = local ? info.lanUrl : location.origin;
  const url = base + '/fan';
  $('#join-url').textContent = url;
  $('#join-hint').textContent = local ? 'This is your computer\'s address on the local network. Phones must be on the same Wi-Fi.' : 'Share this link or the code.';
  try { if (window.QRCode) new QRCode($('#qr'), { text: url, width: 140, height: 140 }); } catch (e) { /* link still shown */ }
  connect({}, (msg) => { state = msg.state; render(); });
  pilot();
  setInterval(pilot, 3000);
}
init();
