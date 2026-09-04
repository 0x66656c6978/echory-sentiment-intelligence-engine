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
