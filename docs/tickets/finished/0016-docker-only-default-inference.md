# 0016 — Docker-only setup, default to local inference, easy Groq fallback

**Priority:** P1
**Phase:** 4

## Description

Two decisions from Felix, made while debugging why `docker compose up` kept running the placeholder
provider despite editing `backend/.env` (see [ticket 0012](../finished/0012-dockerize-backend.md)'s
2026-09-04 log entry for that bug):

1. Drop native `npm start` as a documented/supported way to run the backend. Docker is the only
   supported path going forward, per Pascal's explicit preference for Docker (his email,
   2026-09-03, already the basis for [ticket 0007](../finished/0007-inference-provider.md)'s
   swappable-endpoint design).
2. The real local LLM (`phi4-mini` via Ollama) should be the *default* `docker compose up`
   experience — not the rule-based placeholder — with an easy, documented switch to Groq (cloud) if
   Ollama has trouble on Echory's side. Felix's own framing: "I want the local model to be the
   default and allow for an easy switch to Groq in case the ollama container won't work for
   whatever reason." Placeholder mode stays available (explicitly not removed), just not the default.

Whether Ollama itself gets containerized (so `docker compose up` needs literally nothing installed
beforehand) is a separate, larger question, split out to
[ticket 0017](../blocked/0017-containerize-ollama.md) — blocked on confirming GPU passthrough is
workable on Echory's side, since getting that wrong risks silently falling back to slow CPU
inference and blowing the scored 500ms latency line. This ticket covers everything that doesn't
depend on that answer.

## Definition of done

- `backend/.env.example` defaults to `LLM_PROVIDER=inference` (not `placeholder`), with
  `INFERENCE_BASE_URL`/`INFERENCE_MODEL` pointing at the current (host-native) Ollama setup
- The Groq cloud fallback is documented as a direct, obvious swap (which three lines to change),
  not buried
- `LLM_PROVIDER=placeholder` remains available and documented, explicitly not the default
- `README.md` presents Docker as the only way to run the backend; native `npm start` instructions
  removed from the documented setup path
- The open question (containerizing Ollama) is captured as its own tracked ticket, not silently
  dropped or conflated with this one

## Log

### 2026-09-04 — Implemented; verified both the new default and the untouched zero-setup shape

**Flipped `backend/.env.example`'s default** from `LLM_PROVIDER=placeholder` to
`LLM_PROVIDER=inference`, `INFERENCE_BASE_URL=http://host.docker.internal:11434/v1` (was
`localhost` — no longer meaningful now that there's no native path this file needs to serve
alongside Docker). Moved the Groq block out from under a long comment paragraph into its own
clearly-labeled "If the local Ollama setup has trouble" section, still just three lines to swap, no
code changes — unchanged mechanism from ticket 0007, just easier to find. Kept
`LLM_PROVIDER=placeholder` fully documented as a manual override for anyone who doesn't want to
install Ollama or hold an API key.

**Real tradeoff, surfaced rather than hidden**: this makes a truly fresh `git clone && docker
compose up --build` (no `backend/.env`, no Ollama running) fail every request with a 500, where
before it would have silently and successfully run the (less accurate) placeholder classifier.
Flagged this explicitly to Felix before implementing — he confirmed the local-inference default
directly and clearly didn't think Ollama-not-working was a realistic scenario ("which i can't
imagine tbh"), so this is a deliberate, informed tradeoff, not an oversight. Documented the
prerequisite prominently in `README.md`'s new Setup section instead of leaving it implicit.

**Verified for real, not just read back the diff**: temporarily moved `backend/.env` aside to
simulate a fresh clone, recreated the container (`docker compose up -d`), confirmed the startup log
now says `Sentiment provider: inference` from `.env.example` alone, and sent a real request that
came back with a genuine `phi4-mini` classification (`positive`/`low`/confidence 0.85) — the new
zero-config default genuinely works end-to-end against the current (host-native Ollama +
`host.docker.internal`) architecture, not just on paper. Restored the real `backend/.env`
afterward and confirmed the container came back up in its previous (Groq-ready-if-needed,
Felix's own) configuration.

Updated `docker-compose.yml`'s `env_file` comment (previously said `.env.example` provides "the
zero-setup **placeholder-mode** baseline" — no longer accurate) and `README.md`'s Setup section:
removed the "Native (matches the evaluation harness)" framing entirely, restructured around
"Backend (Docker)" / "Frontend (native, unchanged)" / "Testing," and added the Ollama prerequisite
and Groq-switch instructions inline rather than only in `.env.example`'s comments.
