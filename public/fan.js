/* 12th Coach — fan view (phone layout). */
'use strict';

let state = null;
let me = null;
let persona = store('12c-persona') || 'season';
let source = null;
let cardKey = null;       // structure of the current moment card
let lastMomentId = null;  // to play the slide-in once per moment
let feedKey = null;
let profileKey = null;
let draft = { option: null };
let card = null;          // { update(moment) } for in-place updates
const LETTERS = ['A', 'B', 'C', 'D'];

function open() {
  if (source) source.close();
  source = connect({ fanId: fanId(), persona }, (msg) => { state = msg.state; me = msg.me || me; render(); });
}

$('#persona').value = persona;
$('#persona').addEventListener('change', (ev) => {
  persona = ev.target.value;
  store('12c-persona', persona);
  cardKey = feedKey = profileKey = null;
  draft = { option: null };
  open();
});

function showTab(name) {
  $('#view-match').hidden = name !== 'match';
  $('#view-profile').hidden = name !== 'profile';
  $('#tab-match').setAttribute('aria-selected', name === 'match');
  $('#tab-profile').setAttribute('aria-selected', name === 'profile');
}
$('#tab-match').addEventListener('click', () => showTab('match'));
$('#tab-profile').addEventListener('click', () => showTab('profile'));
if (location.hash === '#profile') showTab('profile');

function render() {
  if (!state || !me) return;
  renderHeader();
  renderMoment();
  renderFeed();
  renderProfile();
}

function renderHeader() {
  const m = state.match;
  $('#status-text').textContent = m.status === 'live' ? 'LIVE · Matchday ' + m.matchday
    : m.status === 'finished' ? 'Full time' : 'Kick-off soon';
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
      const text = state.match.status === 'idle'
        ? ['Waiting for kick-off', 'Decision moments will pop up here during the match.']
        : state.match.status === 'live'
          ? ['You are in the match', 'Keep watching. The next decision moment slides in here.']
          : ['Full time', 'Thanks for coaching along today.'];
      slot.replaceChildren(h('div', { class: 'idle' }, h('b', { text: text[0] }), text[1]));
    }
    return;
  }
  const vote = me.votes[m.id];
  const voting = m.status === 'open' && !vote;
  const key = voting ? [m.id, 'vote'].join('|') : JSON.stringify([m.id, m.status, vote || null, m.summary, m.coach,
    me.ratings[m.id]]);
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
  const el = h('div', { class: 'countdown' }, text, h('div', { class: 'bar' }, bar), h('span', { class: 'small muted', text: 'to answer' }));
  return {
    el,
    update(m) {
      const s = Math.ceil(m.remaining);
      text.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
      bar.style.width = (m.remaining / m.window * 100) + '%';
    },
  };
}

function headerBits(m) {
  return [
    h('div', { class: 'row' },
      h('span', { class: 'chip chip-red', text: m.minute + "' · Decision moment" }),
      h('span', { class: 'chip', text: TYPE_NAMES[m.type] })),
    h('h2', { text: m.question }),
    h('p', { class: 'muted small', text: m.context }),
  ];
}

function voteCard(m) {
  const cd = countdown();
  const error = h('p', { class: 'error', hidden: true });
  const reason = h('input', { class: 'input why', maxlength: 140, placeholder: 'Why? One line, any language (optional)', 'aria-label': 'Your reason' });
  const submit = h('button', { class: 'btn btn-primary btn-block', disabled: true, text: 'Lock in my call' });
  const buttons = m.options.map((o, i) => h('button', {
    class: 'opt', type: 'button', 'aria-pressed': 'false',
    onclick: () => {
      draft.option = o.id;
      buttons.forEach((b, j) => b.setAttribute('aria-pressed', j === i));
      submit.disabled = false;
    },
  }, h('span', { class: 'letter', style: { background: seriesColor(i) }, text: LETTERS[i] }),
  h('span', {}, h('b', { text: o.label }), h('small', { text: o.sub }))));

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
      error.textContent = 'Could not send your call. Check the connection and try again.';
      error.hidden = false; submit.disabled = false;
    }
  });

  const el = h('section', { class: 'moment' }, headerBits(m), cd.el, buttons, reason, submit, error,
    h('p', { class: 'consent', text: `Your vote counts ${me.weight.toFixed(2)}× (${me.attended} home matches this season). The coach always decides; you predict and have your say.` }));
  return { el, update: (nm) => cd.update(nm) };
}

function resultCard(m, vote) {
  const cd = m.status === 'open' ? countdown() : null;
  const fills = [], values = [];
  const rows = m.options.map((o, i) => {
    fills[i] = h('div', { class: 'fill', style: { background: seriesColor(i) } });
    values[i] = h('span', { class: 'res-val' });
    return h('div', { class: 'res-row' },
      h('div', { class: 'res-head' },
        h('span', { class: 'dot', style: { background: seriesColor(i) } }),
        h('span', { class: 'res-label', text: o.label }),
        vote && vote.option === i ? h('span', { class: 'chip chip-red', text: 'Your call' }) : null,
        m.coach === i ? h('span', { class: 'chip chip-ink', text: 'Coach' }) : null,
        values[i]),
      h('div', { class: 'track' }, fills[i]));
  });
  const count = h('span', { class: 'num' });

  let outcome = null;
  if (m.status === 'resolved') {
    const coachLabel = m.options[m.coach].label;
    if (!vote) outcome = h('div', { class: 'points zero', text: `${m.resolveLabel}: ${coachLabel}. You did not call this one.` });
    else if (vote.pts > 0) outcome = h('div', { class: 'points', text: `${m.resolveLabel}: ${coachLabel}. You called it: +${vote.pts} Fan IQ${vote.pts > 10 ? ' (minority bonus)' : ''}` });
    else outcome = h('div', { class: 'points zero', text: `${m.resolveLabel}: ${coachLabel}. No points this time, and none lost.` });
  } else if (m.status === 'closed') {
    outcome = h('div', { class: 'points zero', text: 'Voting closed. Waiting for the coach\'s decision…' });
  }

  let fair = null;
  if (m.summary && m.status !== 'open') {
    const rated = me.ratings[m.id];
    if (rated === undefined) {
      const send = async (value) => {
        const res = await api('/api/rate', { fanId: fanId(), persona, momentId: m.id, fair: value });
        if (res.me) me = res.me;
        render();
      };
      fair = h('div', { class: 'fair' }, h('span', { text: 'Is this a fair reflection of fan opinion?' }),
        h('button', { class: 'btn btn-sm', text: 'Yes, fair', onclick: () => send(true) }),
        h('button', { class: 'btn btn-sm', text: 'Not quite', onclick: () => send(false) }));
    } else {
      fair = h('p', { class: 'fair muted', text: 'Thanks. Your rating helps check that the summary is fair.' });
    }
  }

  const el = h('section', { class: 'moment' }, headerBits(m), cd ? cd.el : null,
    h('p', { class: 'small muted', style: { margin: '10px 0' } }, count, ' answers · weighted by loyalty'),
    rows,
    h('div', { class: 'pulse' },
      h('div', { class: 'pulse-head' }, 'Fan Pulse', sourceBadge(m.summary)),
      h('p', { text: m.summary ? m.summary.text : 'Gemini is reading the first answers…' })),
    fair, outcome);

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
  feed.replaceChildren(h('div', { class: 'feed-title', text: 'Earlier in this match' }), ...older.map((m) => {
    const vote = me.votes[m.id];
    const mine = vote ? 'You called ' + m.options[vote.option].label : 'You did not call this one';
    const coach = m.coach != null ? ' · Coach: ' + m.options[m.coach].label : ' · Coach still deciding';
    const pts = vote && vote.pts != null ? h('span', { class: vote.pts ? 'chip chip-good' : 'chip', text: '+' + vote.pts + ' Fan IQ' }) : null;
    return h('div', { class: 'feed-item' },
      h('div', { class: 'row' }, h('span', { class: 'chip', text: m.minute + "'" }), h('span', { class: 'spacer' }), pts),
      h('b', { text: m.question }), mine + coach);
  }));
}

function renderProfile() {
  const key = JSON.stringify([me.persona, me.fanIq, me.history]);
  if (key === profileKey) return;
  profileKey = key;
  const next = me.rewards.find((r) => r.cost > me.fanIq);
  $('#view-profile').replaceChildren(
    h('div', { class: 'card' },
      h('div', { class: 'iq' },
        h('div', { class: 'small muted', text: me.label + ' · ' + me.detail }),
        h('div', { class: 'big num', text: fmt(me.fanIq) }),
        h('div', { class: 'small', style: { fontWeight: 700 }, text: 'Fan IQ' }),
        h('p', { class: 'small muted', style: { marginTop: '6px' }, text: next ? `${next.cost - me.fanIq} points to the ${next.name.toLowerCase()}` : 'Every reward unlocked' }))),
    h('div', { class: 'card' },
      h('h3', { text: 'Your vote weight' }),
      h('div', { class: 'weight-box' },
        h('div', { class: 'x', text: me.weight.toFixed(2) + '×' }),
        h('div', { class: 'small' }, h('b', { text: `${me.attended} home matches this season → weight ${me.weight.toFixed(2)}×` }),
          h('div', { class: 'muted', text: '1.0 + 0.05 per home match attended, capped at 2.0×. Loyalty counts, spending does not.' })))),
    h('div', { class: 'card' },
      h('h3', { text: 'Rewards' }),
      h('p', { class: 'sub', text: 'Earned with football knowledge and loyalty.' }),
      me.rewards.map((r) => {
        const done = me.fanIq >= r.cost;
        return h('div', { class: 'reward' },
          h('div', { class: 'row small' }, h('b', { text: r.name }), h('span', { class: 'spacer' }),
            done ? h('span', { class: 'chip chip-good', text: '✓ Unlocked' }) : h('span', { class: 'muted num', text: `${fmt(me.fanIq)} / ${fmt(r.cost)}` })),
          h('div', { class: 'track', style: { marginTop: '5px' } },
            h('div', { class: 'fill', style: { width: Math.min(100, me.fanIq / r.cost * 100) + '%' } })));
      })),
    h('div', { class: 'card' },
      h('h3', { text: 'Points history' }),
      h('p', { class: 'sub', text: '+10 when your call matches the coach, +5 bonus if you were in the minority. Never negative.' }),
      me.history.map((item) => h('div', { class: 'hist' },
        h('div', {}, h('div', { text: item.label }), h('div', { class: 'muted', text: item.match })),
        h('div', { class: 'pts', style: { color: item.pts ? 'var(--good-text)' : 'var(--muted)' }, text: '+' + item.pts })))),
    h('div', { class: 'card' },
      h('h3', { text: 'What your answers are used for' }),
      h('p', { class: 'small muted', text: 'Your answers are stored anonymised and aggregated in the Fan Insight Pool, with your consent. Club teams see totals and summaries per decision moment, never what an individual fan answered.' })));
}

open();
