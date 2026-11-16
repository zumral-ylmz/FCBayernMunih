/* 12th Coach — fan view (phone layout). One main action per screen. */
'use strict';

const EMBED = window.self !== window.top || new URLSearchParams(location.search).has('embed');
if (EMBED) document.body.classList.add('embed');

let state = null;
let me = null;
let persona = store('12c-persona') || 'season';
let source = null;
let cardKey = null;       // structure of the current moment card
let lastMomentId = null;  // play the slide-in once per moment
let feedKey = null;
let profileKey = null;
let card = null;          // { el, update(moment) }
let draft = { option: null };

function open() {
  if (source) source.close();
  source = connect({ fanId: fanId(), persona }, (msg) => { state = msg.state; me = msg.me || me; render(); });
}

function switchPersona(value) {
  persona = value;
  store('12c-persona', persona);
  cardKey = feedKey = profileKey = null;
  draft = { option: null };
  open();
}

function showTab(name) {
  $('#view-match').hidden = name !== 'match';
  $('#view-profile').hidden = name !== 'profile';
  $('#tab-match').setAttribute('aria-selected', name === 'match');
  $('#tab-profile').setAttribute('aria-selected', name === 'profile');
}
$('#tab-match').addEventListener('click', () => showTab('match'));
$('#tab-profile').addEventListener('click', () => showTab('profile'));
if (location.hash === '#profile') showTab('profile');

/* ---- the ritual: first contact ---- */
const seated = store('12c-seated') === '1';
if (!seated) $('#seat').hidden = false;
$('#seat-btn').addEventListener('click', () => {
  store('12c-seated', '1');
  $('#seat').classList.add('leave');
  setTimeout(() => { $('#seat').hidden = true; }, 700);
});
function renderSeat() {
  if ($('#seat').hidden || $('#seat-pass').childElementCount) return;
  const row = (k, v) => h('div', {}, h('span', { text: k }), h('b', { text: v }));
  $('#seat-pass').replaceChildren(
    row('Fan', me.label),
    row('Seat', me.detail),
    row('Loyalty Boost', me.weight.toFixed(2) + '×'),
    row('Fan IQ', fmt(me.fanIq)));
}

function render() {
  if (!state || !me) return;
  renderSeat();
  renderHeader();
  renderMoment();
  renderFeed();
  renderProfile();
}

function renderHeader() {
  const m = state.match;
  $('#status-text').textContent = m.status === 'live' ? 'Live' : m.status === 'finished' ? 'Full time' : 'Kick-off soon';
  $('#live-dot').classList.toggle('on', m.status === 'live');
  $('#home-name').textContent = m.home.name;
  $('#away-name').textContent = m.away.name;
  $('#goals').textContent = m.score[0] + ' : ' + m.score[1];
  $('#minute').textContent = m.minute + "'";
  $('#clock-bar').style.width = (m.minute / 90 * 100) + '%';
  const last = m.events[m.events.length - 1];
  $('#event').textContent = last ? last.minute + "' · " + last.text : 'The match has not started yet.';
}

function currentMoment() {
  const fired = state.moments.filter((m) => m.status !== 'pending');
  return fired[fired.length - 1] || null;
}

function renderMoment() {
  const slot = $('#moment-slot');
  const m = currentMoment();
  if (!m) {
    const key = 'idle|' + state.match.status;
    if (key !== cardKey) {
      cardKey = key; card = null;
      const text = state.match.status === 'live'
        ? ['Watch the match.', 'The next Decision Moment appears here.']
        : state.match.status === 'finished' ? ['Full time.', 'Thanks for coaching along.']
          : ['Kick-off soon.', 'Decision Moments appear here during the match.'];
      slot.replaceChildren(h('div', { class: 'idle' }, h('b', { text: text[0] }), h('span', { text: text[1] })));
    }
    return;
  }
  const vote = me.votes[m.id];
  const voting = m.status === 'open' && !vote;
  const key = voting ? m.id + '|vote'
    : JSON.stringify([m.id, m.status, vote || null, m.summary, m.coach, me.ratings[m.id]]);
  if (key !== cardKey) {
    cardKey = key;
    card = voting ? voteCard(m) : resultCard(m, vote);
    if (lastMomentId !== m.id) { card.el.classList.add('slide'); lastMomentId = m.id; draft = { option: null }; }
    slot.replaceChildren(card.el);
  }
  card.update(m);
}

function countdown() {
  const text = h('span');
  const bar = h('i');
  const el = h('div', { class: 'countdown' }, h('div', { class: 'bar' }, bar), text);
  return {
    el,
    update(m) {
      const s = Math.ceil(m.remaining);
      text.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
      bar.style.width = (m.remaining / m.window * 100) + '%';
    },
  };
}

function voteCard(m) {
  const cd = countdown();
  const error = h('p', { class: 'error', hidden: true, style: { marginTop: '10px' } });
  const reason = h('input', { class: 'why', maxlength: 140, placeholder: 'Add a reason, any language (optional)', 'aria-label': 'Your reason' });
  const submit = h('button', { class: 'btn btn-primary btn-block', disabled: true, text: 'Make the call', style: { minHeight: '52px', fontSize: '16px' } });
  const buttons = m.options.map((o, i) => h('button', {
    class: 'opt', type: 'button', 'aria-pressed': 'false',
    onclick: () => {
      draft.option = o.id;
      buttons.forEach((b, j) => b.setAttribute('aria-pressed', j === i));
      submit.disabled = false;
    },
  }, h('span', {}, h('b', { text: o.label }), h('small', { text: o.sub })), h('span', { class: 'tick', 'aria-hidden': 'true' })));

  submit.addEventListener('click', async () => {
    if (!draft.option) return;
    submit.disabled = true;
    try {
      const res = await api('/api/vote', { fanId: fanId(), persona, momentId: m.id, option: draft.option, reason: reason.value });
      if (res.me) me = res.me;
      if (res.state) state = res.state;
      if (!res.ok) { error.textContent = res.error; error.hidden = false; }
      render();
    } catch (e) {
      error.textContent = 'Your call did not go through. Check the connection and try again.';
      error.hidden = false; submit.disabled = false;
    }
  });

  const el = h('section', { class: 'moment' },
    h('div', { class: 'eb', text: m.minute + "' · Decision Moment" }),
    h('h2', { text: m.question }),
    cd.el, buttons, reason, submit, error);
  return { el, update: (nm) => cd.update(nm) };
}

function verdict(m, vote) {
  const coach = m.options[m.coach].label;
  if (vote && vote.pts > 0) {
    return h('div', { class: 'verdict won' },
      h('div', { class: 'small-line', text: `${m.minute}' · The coach went with ${coach}.` }),
      h('div', { class: 'big', text: 'You called it.' }),
      h('div', { class: 'pts' }, h('span', { text: '+10 Fan IQ' }), vote.pts > 10 ? h('span', { text: '+5 Brave Call' }) : null));
  }
  return h('div', { class: 'verdict plain' },
    h('div', { class: 'small-line', text: vote ? `Your call: ${m.options[vote.option].label}. No points lost.` : 'You sat this one out.' }),
    h('div', { class: 'big', text: `The coach went with ${coach}.` }));
}

function resultCard(m, vote) {
  const cd = m.status === 'open' ? countdown() : null;
  const fills = [], values = [];
  const rows = m.options.map((o, i) => {
    const mine = vote && vote.option === i;
    fills[i] = h('div', { class: 'fill', style: { background: mine ? 'var(--red)' : 'var(--bar)' } });
    values[i] = h('span', { class: 'res-val' });
    return h('div', { class: 'res-row' },
      h('div', { class: 'res-head' },
        h('span', { class: 'res-label', text: o.label }),
        mine ? h('span', { class: 'tag mine', text: 'Your call' }) : null,
        m.coach === i ? h('span', { class: 'tag', text: 'Coach' }) : null,
        values[i]),
      h('div', { class: 'track' }, fills[i]));
  });
  const count = h('span', { class: 'num' });
  const line = m.status === 'open' ? 'Your call is in. Watch the crowd.'
    : m.status === 'closed' ? 'Voting closed. The coach decides next.' : null;

  let fair = null;
  if (m.summary && m.status !== 'open') {
    if (me.ratings[m.id] === undefined) {
      const send = async (value) => {
        const res = await api('/api/rate', { fanId: fanId(), persona, momentId: m.id, fair: value });
        if (res.me) me = res.me;
        render();
      };
      fair = h('div', { class: 'fair' }, h('span', { text: 'Is this summary fair?' }),
        h('button', { class: 'btn btn-sm', text: 'Yes', onclick: () => send(true) }),
        h('button', { class: 'btn btn-sm', text: 'Not quite', onclick: () => send(false) }));
    } else {
      fair = h('p', { class: 'fair', text: 'Thanks. That helps keep the Fan Pulse fair.' });
    }
  }

  const el = h('section', { class: 'moment' },
    m.status === 'resolved' ? verdict(m, vote) : null,
    h('div', { class: 'eb', text: m.minute + "' · Decision Moment" }),
    h('h2', { text: m.question }),
    cd ? cd.el : null,
    line ? h('p', { class: 'state-line', text: line }) : null,
    h('div', { class: 'bars' }, rows),
    h('p', { class: 'small muted', style: { margin: '-2px 0 12px' } }, count, ' answers, weighted by Loyalty Boost'),
    h('div', { class: 'pulse' },
      h('div', { class: 'pulse-head' }, 'Fan Pulse', sourceBadge(m.summary)),
      h('p', { text: m.summary ? m.summary.text : 'Gemini is reading every answer…' })),
    fair);

  return {
    el,
    update(nm) {
      if (cd && nm.status === 'open') cd.update(nm);
      count.textContent = fmt(nm.n);
      nm.weightedPct.forEach((p, i) => { fills[i].style.width = p + '%'; values[i].textContent = pctText(p); });
    },
  };
}

function renderFeed() {
  const cur = currentMoment();
  const older = state.moments.filter((m) => m.status !== 'pending' && cur && m.id !== cur.id).reverse();
  const key = JSON.stringify(older.map((m) => [m.id, m.status, m.coach, me.votes[m.id]]));
  if (key === feedKey) return;
  feedKey = key;
  const feed = $('#feed');
  if (!older.length) { feed.replaceChildren(); return; }
  feed.replaceChildren(h('div', { class: 'feed-title', text: 'Earlier' }), ...older.map((m) => {
    const vote = me.votes[m.id];
    const sub = (vote ? 'You: ' + m.options[vote.option].label : 'No call') + (m.coach != null ? ' · Coach: ' + m.options[m.coach].label : '');
    const pts = vote && vote.pts != null ? h('span', { class: 'p' + (vote.pts ? '' : ' zero'), text: '+' + vote.pts }) : null;
    return h('div', { class: 'feed-item' },
      h('span', { class: 'm', text: m.minute + "'" }),
      h('span', { class: 't' }, h('b', { text: m.question }), h('span', { text: sub })), pts);
  }));
}

function renderProfile() {
  const key = JSON.stringify([me.persona, me.fanIq, me.history]);
  if (key === profileKey) return;
  profileKey = key;
  const next = me.rewards.find((r) => r.cost > me.fanIq);
  const select = h('select', { class: 'input', style: { width: '100%' }, 'aria-label': 'Demo fan',
    onchange: (ev) => switchPersona(ev.target.value) },
  [['season', 'Season-ticket holder'], ['occasional', 'Occasional visitor'], ['remote', 'Remote fan abroad']]
    .map(([v, t]) => h('option', { value: v, selected: v === persona, text: t })));

  $('#view-profile').replaceChildren(
    h('div', { class: 'iq' },
      h('div', { class: 'who', text: me.label + ' · ' + me.detail }),
      h('div', { class: 'big num', text: fmt(me.fanIq) }),
      h('div', { class: 'lbl', text: 'Fan IQ' }),
      h('div', { class: 'next', text: next ? `${next.cost - me.fanIq} to the ${next.name.toLowerCase()}` : 'Every reward unlocked' })),
    h('div', { class: 'card' },
      h('h3', { text: 'Loyalty Boost' }),
      h('div', { class: 'boost' },
        h('div', { class: 'x', text: me.weight.toFixed(2) + '×' }),
        h('div', { class: 'small' }, h('b', { text: `${me.attended} home matches this season.` }),
          h('div', { class: 'muted', text: 'Every home match adds 0.05×. Twenty matches, double weight.' })))),
    h('div', { class: 'card' },
      h('h3', { text: 'Earned, not bought.' }),
      h('p', { class: 'sub', text: 'Rewards for football knowledge and loyalty.' }),
      me.rewards.map((r) => h('div', { class: 'reward' },
        h('div', { class: 'row small' }, h('b', { text: r.name }), h('span', { class: 'spacer' }),
          me.fanIq >= r.cost ? h('span', { class: 'chip chip-good', text: 'Unlocked' }) : h('span', { class: 'muted num', text: `${fmt(me.fanIq)} / ${fmt(r.cost)}` })),
        h('div', { class: 'track' }, h('div', { class: 'fill', style: { width: Math.min(100, me.fanIq / r.cost * 100) + '%' } }))))),
    h('div', { class: 'card' },
      h('h3', { text: 'Points' }),
      h('p', { class: 'sub', text: '+10 for calling what the coach does. +5 Brave Call if most fans disagreed. Never negative.' }),
      me.history.map((item) => h('div', { class: 'hist' },
        h('div', {}, h('div', { text: item.label }), h('div', { class: 'muted', text: item.match })),
        h('div', { class: 'pts', style: { color: item.pts ? 'var(--good-text)' : 'var(--muted)' }, text: '+' + item.pts })))),
    h('div', { class: 'card' },
      h('h3', { text: 'Your answers' }),
      h('p', { class: 'small muted', text: 'Stored anonymised and aggregated in the Fan Insight Pool, with your consent. The club sees totals and summaries, never what you answered.' })),
    h('div', { class: 'card' },
      h('h3', { text: 'Demo fan' }),
      h('p', { class: 'sub', text: 'Switch fans to see how the Loyalty Boost changes.' }),
      select));
}

open();
