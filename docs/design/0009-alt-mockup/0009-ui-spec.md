# 0009 — UI spec: live call console (option 1b)

Implementation spec for [ticket 0009](../docs/tickets/in_progress/0009-required-ui-components.md).
Reference mockup: `1b-live-console.html` (open it in a browser — it self-runs the scripted call
from `frontend/src/lib/negotiationScript.ts`).

The mockup is a static HTML artifact with inline styles. **Do not port its markup.** Rebuild it
as React + Tailwind in the existing component files; use this document for the values.

---

## 1. Scope

Replaces the current sidebar-and-log layout in `frontend/src/App.tsx`. All four required
elements survive, re-housed:

| Required element | Where it lives in 1b |
|---|---|
| Traffic Light Indicator | Right rail, top — "Risk signal", four stacked pill rows |
| Sentiment Stream | Left column — cards, newest at the bottom, bottom-anchored |
| Volatility Alert | Right rail, second — whole card changes fill when flagged |
| Mitigation Panel | Right rail, third — dark terracotta panel, display type |

Added beyond the four: a two-tile aggregate strip at the bottom of the rail (volatility index,
dominant tone). See §5 — no new LLM call required.

## 2. Layout

Root: `100vh`, column flex.

- **Header** — 18px/28px padding, 1px bottom divider. Left: "Copilot" in display face at 22px,
  then `Northwind renewal · {session_id}` at 13px in neutral-600. Right: a "Live" pill
  (accent-200 fill, accent-800 text, 11px uppercase, .14em tracking, 8px accent-600 dot that
  breathes 1.4s) then `{processing_latency_ms} ms · {n} chunks` at 12px neutral-600.
- **Body** — row flex, 24px gap, 24px/28px padding, `min-height: 0`.
  - **Stream column** — `flex: 1`, `min-width: 0`. A kicker row ("Sentiment stream" 11px uppercase
    .18em neutral-600 / "newest at the bottom" 11px neutral-500), then a column flex with
    `justify-content: flex-end` and 12px gap so cards stack up from the bottom edge.
  - **Rail** — fixed `352px`, column flex, 16px gap.

The stream in the mockup renders only the last 4 chunks so nothing scrolls. In the real app keep
it scrollable and pinned to the bottom (`overflow-y: auto` + a bottom sentinel; note
`scrollIntoView` is already used in `SentimentStream.tsx`).

## 3. Stream card

Radius `--radius-md` (16px), padding 16px/20px, `riseIn` entry animation (8px up, .35s ease-out).

- Resolved card: `--color-surface` fill. The newest resolved card additionally gets `--shadow-md`.
- Pending card: `--color-neutral-100` fill, no shadow.

Header row (space-between):
- 26px circular avatar with the speaker's initial, 10px/700. Counterpart → accent-300 on
  accent-900 text; candidate → accent-2-300 on accent-2-900.
- Speaker name 12px/600 in `--color-text`, clock 11px/500 in neutral-500.
- Acoustic bars, right-aligned: four 5px-wide pills, 20px track, `--color-accent-400` at 75%
  opacity. Heights are `pitch_volatility`, `min(1, speech_rate_wpm/220)`,
  `min(1, pause_duration_ms/1000)`, `volume_intensity` — same normalisation as the existing
  `AcousticBars.tsx`, floored at 12% so a zero value still reads as a bar.

Utterance: 16px/1.45 in `--color-text`, `text-wrap: pretty`. No italics, no quote marks — the
current dark console used a serif italic transcript voice; Organic has no serif, so the utterance
sits in Figtree and the card carries the "this is speech" cue instead.

Badge row (9px gap, wraps):
1. Sentiment pill — see §4.
2. Risk pill — `{risk_level} risk`, see §4.
3. `hidden_intent` as plain 11.5px/500 neutral-600 text (not a pill — it's free text up to 60
   chars and would wrap badly in a pill).
4. `· {confidence*100}%` at 11.5px/500 neutral-500.
5. If `volatility_flag`: the word `volatile`, 11px/700 uppercase .08em, `--color-accent-700`.

Pending state: one pill reading `reading…` — neutral-200 fill, neutral-600 text, 10.5px uppercase
.12em, breathing 1s.

## 4. Colour mapping

Severity escalates as **increasing ink in one hue**, not red/amber/green — the Organic palette has
only terracotta and sage, and the existing green/yellow/orange/red set isn't in it.

Risk (`risk_level`):

| Level | Fill | Text | Lamp dot |
|---|---|---|---|
| `low` | `--color-accent-2-200` | `--color-accent-2-800` | `#8fa073` (accent-2-500) |
| `medium` | `--color-accent-200` | `--color-accent-800` | `#f6a06b` (accent-400) |
| `high` | `--color-accent-400` | `--color-accent-900` | `#c67139` (accent) |
| `critical` | `--color-accent-800` | `#fff2eb` (accent-100) | `#8c491a` (accent-700) |

Sentiment (all seven enum values must be covered):

| Sentiment | Fill | Text |
|---|---|---|
| `positive` | `--color-accent-2-200` | `--color-accent-2-800` |
| `neutral` | `--color-neutral-200` | `--color-neutral-800` |
| `negative` | `--color-accent-300` | `--color-accent-900` |
| `sarcastic` | `--color-neutral-800` | `--color-accent-200` |
| `aggressive` | `--color-accent-700` | `#fff2eb` |
| `deflecting` | `--color-accent-2-400` | `--color-accent-2-900` |
| `appeasement` | `--color-accent-2-100` | `--color-accent-2-700` |

`sarcastic` and `aggressive` are the two inverted (dark-fill) chips on purpose — they're the
classifications the engine exists to catch, so they should be the ones that jump.

Note for the port: `frontend/src/lib/theme.ts` documents why these must be written as fully
literal Tailwind class names, not interpolated. That constraint still applies — extend the
existing `Record<Sentiment, string>` / `Record<RiskLevel, string>` lookups rather than building
class strings.

## 5. Right rail

**Risk signal** — `--color-surface` card, radius-md, 20px padding. Kicker 11px uppercase .18em
neutral-700. Four rows in descending severity (`critical, high, medium, low`), 9px gap. Each row
is a pill (`border-radius: 999px`, 9px/13px padding) holding a 22px circular lamp and the level
name at 13px/600 uppercase .08em.

- Inactive: transparent row, `--color-neutral-300` lamp, `--color-neutral-600` text.
- Active (matches the latest `risk_level`): row fill and text from the risk table above, lamp in
  the dot colour, `softPulse` 1.3s (scale 1 → 1.06, opacity 1 → .82). Transition `background .3s`.

**Volatility** — radius-md card, 20px padding, whole card recolours.

- Calm: `--color-surface` fill, kicker neutral-700, 14px neutral-400 dot, text "Stable" at
  16px/600 neutral-700.
- Flagged: `--color-accent-300` fill, kicker accent-800, accent-700 dot with a `ringOut` halo
  (scale .7 → 1.9, opacity .5 → 0, 1.4s), text "Emotional spike detected" at 16px/600 accent-900.

**Suggested move** — `--color-accent-800` fill, radius-md, 22px padding, `flex: 1` so it absorbs
spare rail height. Kicker accent-300. `mitigation_suggestion` set in the **display face** at
25px/1.25 in `#fff2eb`, `text-wrap: pretty`, re-animated (`riseIn`) on change — key the element on
the suggestion string so React remounts it, as `MitigationPanel.tsx` already does. Footer: `.btn
.btn-primary` "Used it" and `.btn .btn-ghost` "Not now" at 12px/9px-16px.

> Those two buttons have **no backend**. There is no suggestion-feedback endpoint or persistence.
> Either drop them or wire them to local state only, and don't imply they're recorded.

**Aggregate tiles** — two `--radius-sm` tiles, 10px gap, 13px/15px padding. Left: volatility index
on accent-2-200, number in display face 24px accent-2-800, label 10px uppercase .1em accent-2-700.
Right: dominant tone on neutral-200, display face 24px neutral-800, label neutral-700.

## 6. Data mapping

Straight from the `POST /api/telemetry/stream` response (`TelemetryChunkResponse`):

`sentiment` · `risk_level` · `confidence` · `volatility_flag` · `hidden_intent` ·
`mitigation_suggestion` · `processing_latency_ms`

From the request the dashboard already holds (`TelemetryChunkRequest`): `speaker`, `text`,
`timestamp_ms` → clock, `acoustic_metadata` → the four bars, `session_id`.

Header/rail "current" values all come from the **latest chunk with `status === "done"`** — the
selector already in `App.tsx`.

### The two aggregates

Both are arithmetic over classifications already returned. **No second LLM call, no added
latency.**

- **Dominant tone** — mode of `sentiment` across the session's chunks.
- **Volatility index** — share of chunks with `volatility_flag === true`, formatted to 2dp. The
  mockup earlier used a risk-weighted mean; the flag share is the simpler, more defensible
  definition. Whichever is chosen, document it — it is a product judgement, not model output.

Two valid places to compute them:

1. **Client-side** — a reduce over the `entries` array already in `App.tsx` state. No backend
   change. Recommended for this ticket.
2. **Backend summary route** — `SessionSummaryResponseSchema` (`aggregated_volatility_score`,
   `dominant_sentiment`, `top_risk_moments`) and `API_SESSION_SUMMARY_PATH` are already declared in
   `shared/src/index.ts`, and `sessionStore.append` already records every response with its
   timestamp. But **no route implements it** — `backend/src/routes/` contains only `health.ts` and
   `telemetry.ts`, and `sessionStore.get` is currently unused. Implementing it is a small, separate
   piece of work (it's also the Track B requirement), so treat it as optional here.

### Invented in the mockup — no backend support

- **"Northwind renewal"** — no call/deal name exists in the contract. Frontend-local label, or drop it.
- **"04:21 elapsed"** (in the other mockups) — no session start time is returned. Derive from the
  first chunk's `timestamp_ms` client-side.
- **"Used it" / "Not now"** — see above.
- The header `ms` figure is the server's **self-reported processing time**, not round-trip. If true
  round-trip is wanted, time the fetch in `frontend/src/lib/api.ts` and show both.
- Model name (`phi4-mini · local`, shown in mockup 1c) is captured server-side in
  `observability` and written to the LLM log, but **never returned to the client**.
- p50/p95 latency (mockup 1c) is computed by `backend/src/observability/stats.ts` for the
  benchmark scripts only — not exposed over HTTP.

## 7. Motion

Four keyframes, all of them the whole motion vocabulary:

```css
@keyframes riseIn   { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:none } }
@keyframes softPulse{ 0%,100% { transform:scale(1);   opacity:1  } 50% { transform:scale(1.06); opacity:.82 } }
@keyframes ringOut  { 0%      { transform:scale(.7);  opacity:.5 } 100% { transform:scale(1.9);  opacity:0   } }
@keyframes breathe  { 0%,100% { opacity:.35 } 50% { opacity:.9 } }
```

`riseIn` on card and suggestion entry; `softPulse` on the active risk lamp; `ringOut` on the
volatility dot and the live indicator halo; `breathe` on the live dot and the "reading…" pill.
Nothing blinks, nothing flashes red — the negotiator is in a live call and the panel is glanced at,
not watched.

## 8. Definition of done (in addition to the ticket's)

- All seven `sentiment` values and all four `risk_level` values have a defined chip style; no
  fallback grey.
- The stream stays pinned to the newest chunk without the page scrolling.
- The volatility card is legible as "flagged" from ~2m, without reading the text.
- No element on screen implies data the backend doesn't return (see §6).
