# 12th Coach

**Every fan a voice in the match.** A clickable prototype for the FC Bayern Fan AI-DEATION competition.

During a live match, fans get short decision moments (who should come on, should the shape change, player of the moment). They tap an option and can add one line of reasoning in any language. Gemini merges all answers into a live Fan Pulse summary. Fans earn Fan IQ points when their call matches what the coach then does, and loyal attendance gives their vote more weight. The coach always decides. Every resolved moment is stored, anonymised and aggregated, in the Fan Insight Pool, which the club can question in plain language.

Everything runs on simulated data: fictional player names, a fictional opponent, about 20,000 synthetic fans. No club crest, logos or sponsor marks are used.

## Run it

Requires Python 3.9 or newer. There is nothing to install.

```
python server.py
```

Then open <http://localhost:8000>. The terminal also prints the address phones on the same Wi-Fi can use.

| View | Address | What it shows |
|---|---|---|
| About | `/` | The idea, the demo flow, the first test |
| Fan view | `/fan` | Phone layout: vote, live bars, Fan Pulse, Fan IQ profile |
| Club dashboard | `/club` | Weighted vs unweighted result, breakdowns by block and country, reason clusters, timeline |
| Fan Insight Pool | `/club#pool` | Season view, stored records, "Ask the pool" |
| Operator panel | `/operator` | Start the match, fire moments, enter what the coach did |

## Gemini

Copy `.env.example` to `.env` and set `GEMINI_API_KEY`. The key stays on the server.

Gemini is used in two places: the Fan Pulse summary with the top three reason clusters for each decision moment, and the answers in "Ask the pool". If no key is set or a call fails, the app falls back to a summary computed from the vote data, so the demo never breaks. The interface labels which one you are looking at ("Written by Gemini" or "Offline fallback"), and the operator panel shows the Gemini status and the last error.

The model defaults to `gemini-3.5-flash-lite`; change it with `GEMINI_MODEL`.

## The two-minute demo

1. Open `/operator` and press **Start match**.
2. Open `/fan` on a phone (scan the code in the operator panel) or in a second tab.
3. Press **Fire next decision moment**, vote, and watch the bars and the Fan Pulse update.
4. Choose what the coach actually did and press **Resolve**. Fan IQ points land on the profile.
5. Open `/club`: the same moment with breakdowns. It now also appears in the Fan Insight Pool, and an "Ask the pool" question refers to it.

The "choose demo fan" menu in the fan view switches between a season-ticket holder, an occasional visitor and a remote fan abroad, which shows how the vote weight differs.

## Running a pilot with real participants

- Everyone joins through `/fan` with no login. Real votes are counted on top of the simulated crowd.
- For a real-participants-only run, switch off **Simulated crowd** in the operator panel before firing the first moment.
- The operator panel shows the pilot metrics from our test plan, for real phones only: participation per moment, median response time, share of participants who answered three or more moments, and how many rated the Gemini summary as fair.
- Set `OPERATOR_KEY` in `.env` to protect the operator panel when the address is public.
- The "First test" section on the About page reads from `pilot.json`. Put your measured numbers into the `value` fields; fields left as `null` are not shown.

## Rules of the idea, in code

- Vote weight: `1.0 + 0.05` per home match attended this season, capped at `2.0` (`vote_weight` in `engine.py`).
- Fan IQ: `+10` if the fan's option matches the coach's decision, `+5` bonus if the fan was in the minority and still right, never negative (`fan_iq_points` in `engine.py`).
- No question asks fans to rate a player negatively or to vote someone off (`content.py`).
- Club views only ever receive aggregates. No individual fan's answers are visible there.

## Hosting

State is kept in memory, so run exactly one instance. Any host that runs a long-lived Python process or a container works:

- **Render**: connect the repository; `render.yaml` is included. Add `GEMINI_API_KEY` in the dashboard.
- **Container hosts** (Cloud Run, Railway, Fly.io): a `Dockerfile` is included. On Cloud Run set the maximum number of instances to 1.

Serverless platforms that start a fresh process per request (for example Vercel functions) will not keep the live match state.

## Files

```
server.py     HTTP server, live updates (Server-Sent Events), API routes
engine.py     match simulation, voting, Fan IQ, Fan Insight Pool, pilot metrics
gemini.py     server-side Gemini calls
content.py    fictional match script, decision moments, reasons, seed data
pilot.json    text and numbers for the "First test" section
public/       the four views (plain HTML, CSS and JavaScript)
```
