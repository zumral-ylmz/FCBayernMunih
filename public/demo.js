/* 12th Coach — guided demo. One sentence and one button per step, like a keynote. */
'use strict';

const params = new URLSearchParams(location.search);
const KEY = params.get('key') || store('12c-operator-key') || '';
if (params.get('key')) store('12c-operator-key', KEY);
const AUTH = KEY ? { 'X-Operator-Key': KEY } : {};

let state = null;
let me = null;
let source = null;
let panelKey = null;
let busy = false;
let live = null;   // element with the live answer count, updated in place

const persona = () => store('12c-persona') || 'season';

function open() {
  if (source) source.close();
  source = connect({ fanId: fanId(), persona: persona() }, (msg) => { state = msg.state; me = msg.me || me; render(); });
}
// The phone frame shares storage with this page; follow it when the demo fan changes.
addEventListener('storage', (ev) => { if (ev.key === '12c-persona') { panelKey = null; open(); } });

async function act(...steps) {
  if (busy) return;
  busy = true;
  $('#error').hidden = true;
  try {
    for (const [action, body] of steps) {
      const res = await api('/api/operator/' + action, body || {}, AUTH);
      if (res.ok === false) throw new Error(res.error || 'That did not work.');
    }
  } catch (e) {
    $('#error').textContent = e.message === 'Operator key required.'
      ? 'This demo is protected. Open it as /demo?key=YOUR_OPERATOR_KEY.' : e.message;
    $('#error').hidden = false;
  }
  busy = false;
}

function step() {
  const ms = state.moments;
  const fired = ms.filter((x) => x.status !== 'pending');
  const open = ms.find((x) => x.status === 'open');
  const closed = ms.find((x) => x.status === 'closed');
  const pending = ms.find((x) => x.status === 'pending');
  if (state.match.status === 'idle' || !fired.length) return { id: 'kickoff' };
  if (open) return { id: me && me.votes[open.id] ? 'watch' : 'call', m: open };
  if (closed) return { id: 'pulse', m: closed };
  if (pending) return { id: 'landed', m: fired[fired.length - 1] };
  return { id: 'fulltime', m: fired[fired.length - 1] };
}

const btn = (text, onclick) => h('button', { class: 'btn btn-primary', text, onclick });
const quiet = (text, onclick) => h('button', { class: 'quiet', text, onclick });
const quietLink = (text, href) => h('a', { class: 'quiet', text, href, target: '_blank', rel: 'noopener' });

function kickoff() {
  const steps = state.match.status === 'idle' ? [] : [['reset']];
  act(...steps, ['start'], ['fire']);
}

function content(s) {
  const m = s.m;
  switch (s.id) {
    case 'kickoff':
      return {
        kicker: 'Before kick-off',
        title: 'Take your seat.',
        body: ['A home match, simulated: 90 minutes in about three. 20,000 fans are already in. You watch on the phone.'],
        actions: [btn('Kick off', kickoff)],
      };
    case 'call':
      return {
        kicker: `${m.minute}' · Decision Moment`,
        title: 'Make the call.',
        body: [h('q', { text: m.question }), ' Tap an option on the phone. Add a reason in any language if you like.'],
        actions: [quiet('Skip the wait', () => act(['close']))],
      };
    case 'watch':
      live = h('b', { class: 'num', style: { color: '#f5f5f7' }, text: fmt(m.n) });
      return {
        kicker: `${m.minute}' · Decision Moment`,
        title: 'Watch the crowd move.',
        body: [live, ' answers so far. The bars are weighted by Loyalty Boost: regulars count up to twice.'],
        actions: [btn('Close voting', () => act(['close']))],
      };
    case 'pulse':
      return {
        kicker: 'Fan Pulse',
        title: 'One sentence from thousands.',
        body: m.summary ? [h('q', { text: m.summary.text })] : ['Gemini is reading every answer, in every language…'],
        actions: [btn('The coach decides', () => act(['resolve', { momentId: m.id, option: m.options[suggested(m)].id }]))],
      };
    case 'landed': {
      const vote = me && me.votes[m.id];
      const won = vote && vote.pts > 0;
      return {
        kicker: `${m.minute}' · The coach went with ${m.options[m.coach].label}`,
        title: won ? 'You called it.' : 'The coach decides. Always.',
        body: [won ? `+${vote.pts} Fan IQ just landed on the phone.` : 'Fans predict and say what they think. Calling it right is the reward: +10 Fan IQ, +5 for a Brave Call.'],
        actions: [btn('Next Decision Moment', () => act(['fire'])), quietLink('See what the club sees', '/club')],
        oneMore: true,
      };
    }
    default: {
      const resolved = state.moments.filter((x) => x.status === 'resolved');
      const matched = resolved.filter((x) => x.majorityMatched).length;
      return {
        kicker: `Full time · ${state.match.score[0]} : ${state.match.score[1]}`,
        title: 'The 12th man. Finally on the team sheet.',
        body: [`The fan majority matched the coach in ${matched} of ${resolved.length} Decision Moments. Every one of them is now in the Fan Insight Pool.`],
        actions: [btn('Open the Fan Insight Pool', () => window.open('/club#pool', '_blank')), quiet('Play again', kickoff)],
      };
    }
  }
}

// The scripted coach decision for each moment (the operator panel can choose any option).
let suggestions = null;
api('/api/operator/info', undefined, AUTH).then((info) => {
  if (info && info.moments) suggestions = Object.fromEntries(info.moments.map((x) => [x.id, x.suggested]));
}).catch(() => {});
function suggested(m) {
  const id = suggestions && suggestions[m.id];
  const i = m.options.findIndex((o) => o.id === id);
  return i >= 0 ? i : 0;
}

function render() {
  if (!state) return;
  const s = step();
  const m = s.m;
  const vote = m && me && me.votes[m.id];
  const key = JSON.stringify([s.id, m && m.id, m && m.summary, m && m.coach, vote && vote.pts, state.match.score]);

  $('#progress').replaceChildren(...state.moments.map((x) => h('span', {
    class: x.status === 'resolved' ? 'done' : x.status === 'pending' ? '' : 'now',
  })));
  const mt = state.match;
  $('#status').textContent = mt.status === 'idle' ? 'Matchday ' + mt.matchday + ' · simulated data'
    : `${mt.minute}' · ${mt.home.name} ${mt.score[0]} : ${mt.score[1]} ${mt.away.name}`;

  if (key === panelKey) {
    if (live && m) live.textContent = fmt(m.n);
    return;
  }
  panelKey = key;
  live = null;
  const c = content(s);
  $('#panel').replaceChildren(h('div', { class: 'fade' },
    h('div', { class: 'kicker', text: c.kicker }),
    h('h1', { text: c.title }),
    h('p', { class: 'body' }, c.body),
    h('div', { class: 'actions' }, c.actions),
    c.oneMore ? h('p', { class: 'omt' }, h('b', { text: 'One more thing… ' }),
      'this moment is already in the Fan Insight Pool, ready for the club to ask. ',
      h('a', { href: '/club#pool', target: '_blank', rel: 'noopener', text: 'Open it' })) : null));
}

open();
