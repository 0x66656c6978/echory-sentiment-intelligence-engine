# 0009 — Required UI components (polish pass)

**Priority:** P0
**Phase:** 4

## Description

Take the working-but-plain frontend from [0002-frontend-bootstrap](0002-frontend-bootstrap.md)
and build the four required UI elements properly, now that real model output (Phase 3) is
available to design around:

- Traffic Light Indicator — green/yellow/red/critical based on `risk_level`
- Sentiment Stream — scrolling timeline of classified chunks
- Volatility Alert — prominent warning when `volatility_flag` is true
- Mitigation Panel — displays current `mitigation_suggestion`

## Definition of done

- All four elements present and visibly reacting to live data
- Feels purpose-built for a negotiation room, not a generic data table (this is 15% of the score)
- Launchable with a single documented command

## Log

### 2026-09-04 — Full rebuild: "negotiation console" aesthetic, all four elements, live-verified

Replaced ticket 0002's plain single-button/list view entirely. Design direction: a tactical
monitoring console (stack-light hardware, terminal log, HUD whisper-screen) rather than a generic
dashboard — chosen deliberately against the DoD's "feels purpose-built for a negotiation room, not
a generic data table" bar, which is a scored dimension (15%). Typography carries part of the
concept: `IBM Plex Serif` italic for the actual transcript (the human words) against `IBM Plex Mono`
for everything else (timestamps, badges, latency, IDs — the machine's readout), `Big Shoulders
Display` for section headers. Fonts loaded via Google Fonts `<link>` in `index.html` (no npm
dependency). Colors are literal, fully-written-out Tailwind class lookups per enum value in
`frontend/src/lib/theme.ts` (risk level, sentiment) rather than template-interpolated class names --
noted explicitly in that file, since Tailwind's content scanner only finds classes it can see
verbatim in source and a `bg-signal-${level}` string would silently produce no styles in a
production build.

**The four required elements**, each its own component:
- `TrafficLight.tsx` — modeled on a physical industrial stack light (stacked lamps, only the
  current `risk_level`'s lamp lit and glowing, `critical` also pulses) rather than a literal
  red/yellow/green signal, reasoning: a stack light is legible at a glance from across a room, which
  is the actual point of this requirement for someone mid-negotiation.
- `SentimentStream.tsx` — scrolling terminal-style log, auto-scrolls to the newest entry
  (`scrollIntoView` on `entries.length` change), each row showing speaker, the transcript quote,
  sentiment/risk badges, confidence, latency, and a 4-bar acoustic sparkline
  (`AcousticBars.tsx` — pitch/rate/pause/volume normalized to 0-1) so the raw signal behind a
  classification is visible, not just the verdict.
- `VolatilityAlert.tsx` — quiet "stable" by default, becomes an animated red pulse + "EMOTIONAL
  SPIKE DETECTED" the moment the latest chunk's `volatility_flag` is true.
- `MitigationPanel.tsx` — the copilot's current `mitigation_suggestion`, framed as a whisper-screen
  readout, re-animates in on each change (`key={suggestion}` + a slide-in keyframe).

**Live data, not fixtures.** Deleted `fixtures.ts` (unused now) and the ticket-0002 test button.
Added `frontend/src/lib/negotiationScript.ts`: a 9-chunk scripted call arc (calm open → deflection →
firm rejection → sarcasm → an ultimatum → a shock reaction → appeasement → calm resolution) sent
chunk-by-chunk to the **real backend** via the existing `sendChunk()`, with a deliberate ~1.4s pacing
delay between chunks (commented as a demo-pacing choice, not a technical requirement) so the
dashboard visibly streams rather than dumping all results at once. `App.tsx` tracks each chunk as
`pending → done/error` so the stream shows an "ANALYZING…" shimmer before a real response lands.
Verified end-to-end against the real `phi4-mini` inference path (not the placeholder) by running
the negotiation script live and reading back the rendered page (`get_page_text`, not just
screenshots) at a genuine mid-session moment: sentiment/risk/volatility/mitigation all matched the
model's actual response for that chunk, including a real "EMOTIONAL SPIKE DETECTED" trigger on the
sarcastic/aggressive portion of the script and the correct mitigation text alongside it.

**Bug found and fixed during this verification**: an early manual test produced one screenshot where
the sidebar showed stale (later-session) data while the stream showed an earlier session's chunks —
traced to a real race, not a rendering bug: `disabled={isRunning}` on the trigger button only takes
effect after React's next commit, so a second click landing before that repaint could start a second
`runSession()` while the first was still running, and the two async loops' `setEntries` calls would
interleave. Fixed with a synchronous `isRunningRef` guard checked at the top of `runSession`, closing
the window entirely regardless of render timing. Re-verified by deliberately firing three rapid
clicks at the same button in one batch (no delay between them) — confirmed exactly one session ran
(one `session_id`, no duplicated/interleaved chunks), where before the fix this was exactly the
failure mode. Worth being explicit that this was a genuine, reproducible pre-fix bug and not just an
automation artifact — the fix and the re-test are both real.

**Responsive**: two-column layout (stream + sidebar) above Tailwind's `lg` breakpoint, stacks to a
single column below it — checked visually at both 1440px and mobile (375px) widths, both readable.

`npm run build` (frontend) and `npm run typecheck` (both workspaces) pass; backend suite unaffected
(40/40). No new frontend tests added — this ticket's verification was live-data/visual (per the
DoD's own framing: "visibly reacting to live data," not a unit-testable claim) rather than something
a component test would meaningfully strengthen given the time remaining before submission.

Launchable exactly as already documented in `README.md` (`npm run dev:frontend`) — no new command
needed, satisfying that DoD item without any change there.

### 2026-09-04 — Superseded by an "Organic" redesign, from an independently-produced mockup

Felix ran a separate Claude session in parallel (per his own stated preference for parallel work via
multiple sessions rather than in-repo subagents) that produced a full alternative visual direction
for this same ticket, unaware the dark-console version above had already shipped: a design spec
(`docs/design/0009-alt-mockup/0009-ui-spec.md`) and a static mockup export
(`docs/design/0009-alt-mockup/1b-live-console.html`), delivered via a local Downloads folder rather
than a commit.

**Provenance check before touching anything.** The mockup folder also included a `support.js` Felix
flagged as "not sure if needed." Identified it as Anthropic's internal Design Canvas runtime
(dynamic component loading via `eval`/CDN-fetched React+Babel) — unrelated tooling that happened to
sit in the same export folder, not a dependency of the mockup. Confirmed empirically rather than by
inspection alone: opened `1b-live-console.html` standalone with `support.js` absent and it rendered
correctly (it's a self-contained "bundled" export that unpacks its own embedded resources at load).
Left `support.js` out of the repo.

**This was a genuine fork, not a drop-in tweak** — a full alternate theme (warm cream/terracotta/sage
vs. the shipped dark tactical console) against a requirement that was already finished, tested, and
merged. Copied the two handoff files into `docs/design/0009-alt-mockup/` and stopped there to ask
Felix explicitly whether to keep the shipped design, replace it, or compare both first — given the
implementation cost (a second full 0009-sized effort) and the deadline. Felix chose to replace it.

**Implementation**: rebuilt the full token system in `frontend/tailwind.config.js` and
`frontend/src/index.css` from values extracted directly out of the mockup's embedded CSS custom
properties (colors, radii, shadows, keyframes — not eyeballed from the screenshot), fonts swapped to
Caprasimo/Figtree (Google Fonts link, no new npm dependency, same approach as before). Every
component rewritten against the spec: `TrafficLight.tsx` (stacked pill rows instead of stack-light
lamps), `VolatilityAlert.tsx` (whole-card recolor with a `ringOut` halo instead of a ping dot),
`MitigationPanel.tsx` (large heading-face suggestion text, plus local-only "Used it"/"Not now"
buttons — no backend, explicitly documented in the spec as not implying persistence, so the
component just flips local state), `SentimentStream.tsx` (card-based, bottom-anchored, "reading…"
pending state), `AcousticBars.tsx` (restyled per the spec's exact bar dimensions/floor). Added
`AggregateTiles.tsx` (dominant tone + volatility index) — new beyond the four required elements per
the spec, pure arithmetic over already-returned classifications, no second LLM call. `theme.ts`'s
existing constraint (literal, non-interpolated Tailwind class names, since the content scanner can't
see template-interpolated strings) carried over to all the new color lookups.

**Verified live again, same rigor as the first pass**: ran the real negotiation script against the
real `phi4-mini` backend, confirmed via `get_page_text` (not just screenshots) that every card's
sentiment/risk/hidden_intent/confidence matched the model's actual response, `VOLATILE` tags appeared
on the correct chunks, the risk-signal lamp and mitigation panel tracked the latest chunk, "Used
it" → "Noted" local-state toggle worked, and the two aggregate tiles' arithmetic was hand-verified
against the actual 9-chunk sentiment distribution (0.33 volatility index = 3/9 flagged; "neutral"
dominant tone, correctly tie-broken to the first-encountered sentiment at the max count). Checked
responsive stacking at 1440px and mobile (375px) again.

`npm run typecheck` and `npm run build` (frontend) both pass; backend suite untouched by this change.

Net effect: the four required elements and their live-data behavior are unchanged in substance, only
the visual system changed. Moving back to `finished/`.
