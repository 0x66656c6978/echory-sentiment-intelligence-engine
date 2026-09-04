# 0018 — Groq as default inference provider, per Pascal's explicit answer

**Priority:** P0
**Phase:** 4

## Description

Pascal (Echory CTO) answered the questions raised in ticket 0017, by email, 2026-09-04. Translated:

> Please don't assume GPU acceleration in the container, and don't assume any installation script
> on our side. Make the inference endpoint configurable via environment variables (base URL and
> model name), with Groq as the default. You're welcome to additionally include a local LLM
> container, but then it must be optional and not a prerequisite for starting. The backend should
> be reachable at `http://localhost:3000` after a single documented start command.
>
> Your observation about the latency variance with Groq is a good finding. How you handle it is
> part of the task: just write your measurement and your decision about it briefly into the docs.

This directly reverses [ticket 0016](0016-docker-only-default-inference.md)'s decision to default
`docker compose up` to the real local model (`phi4-mini`). That decision was made *before* this
answer existed — Felix's own words when asking for it: "implement 0010 but know it might change
once we have an answer from Pascal." It has changed. This ticket is that change.

It also settles [ticket 0006](0006-local-llm-benchmark.md)/[0015](0015-cloud-model-benchmark.md)'s
"which is riskier, `phi4-mini`'s architecture or `groq/qwen3.8-27b`'s latency variance" question —
not by us being wrong to worry about the variance (we weren't; the 14% figure is real and correctly
measured), but because Pascal's infrastructure constraints (no GPU assumption, no host install)
rule out the local model as the *default* regardless of its latency advantage. Both of those
tickets' underlying benchmark work stays fully valid and is exactly what makes this ticket's docs
update credible instead of a guess.

## Definition of done

- `backend/.env.example` defaults to Groq (`INFERENCE_BASE_URL=https://api.groq.com/openai/v1`,
  `INFERENCE_MODEL=qwen/qwen3.8-27b`) — the model already verified in ticket 0015, not a new choice
- Local Ollama (`phi4-mini`) documented as the swap-in alternative, not deleted — still fully
  supported, just no longer default
- `docker compose up --build` (after supplying a real `INFERENCE_API_KEY` in `backend/.env` — a
  free-tier Groq key, per the challenge's own "must not require paid API access" constraint) is the
  one documented start command; no GPU or host-install assumption anywhere in that path
- `README.md` Setup section reflects Groq-first, local-Ollama-optional
- `ARCHITECTURE.md`'s LLM provider section rewritten: Groq is now the shipped default; the known
  ~14% chance of exceeding 500ms is stated plainly as measurement + accepted decision, per Pascal's
  explicit request that this be written up rather than resolved away
- Cross-references added to tickets 0006, 0015, 0016 noting they're superseded on the *default*
  question (not rewritten — their benchmark work and reasoning at the time stay accurate)
- Verified for real against the running Docker container, not just the config diff

## Log

### 2026-09-04 — Implemented

**Config.** `backend/.env.example`: `INFERENCE_BASE_URL`/`INFERENCE_MODEL` now default to
`https://api.groq.com/openai/v1` / `qwen/qwen3.8-27b`, `INFERENCE_API_KEY=your-groq-api-key`
(placeholder — a real key can never be a checked-in default). The `host.docker.internal` networking
note moves down into the local-Ollama swap-in section, since it's no longer relevant to the default
path at all — Groq is a real external URL, identical whether the backend runs natively or in a
container, which actually *removes* a whole class of Docker-networking caveat from the default
experience rather than adding one.

**`README.md`**: Setup section reordered — Groq-first (get a free API key, paste into
`backend/.env`, `docker compose up --build`), local Ollama demoted to "if you'd rather run the LLM
locally" with the exact same instructions as before, unchanged in substance.

**`ARCHITECTURE.md`**: LLM provider section rewritten around the actual shipped default. Not
softened or walked back — states directly that `groq/qwen3.8-27b` carries a measured ~14% chance of
exceeding the 500ms line from Groq-side queue/network variance, that this was investigated
specifically (including whether a shorter prompt would help — it doesn't, prefill time isn't the
bottleneck), and that it's shipped as the default anyway because Echory's own infrastructure
constraints (no GPU passthrough assumed, no install step on their side) rule out the local
alternative as a *default*, not because the risk stopped being real. `phi4-mini` stays documented as
the safe local swap for anyone who wants zero latency-variance risk and can run a local model.

**Verified against the real running Docker container**, using the Groq key already saved (unwired)
in `backend/.env` from earlier cloud-benchmark work: wired it into `INFERENCE_API_KEY`, set
`INFERENCE_BASE_URL`/`INFERENCE_MODEL` to the new Groq defaults, rebuilt and recreated the
container, and sent a real request — confirmed a genuine `qwen/qwen3.8-27b` classification came
back, not a stale/cached response.

**Not touched**: `AI_COLLABORATION.md` — Felix is updating and committing it himself; deliberately
excluded from every `git add`/commit in this ticket.

Tickets 0006, 0015, and 0016 each got a short cross-reference log entry pointing here, rather than
having their own (correct, at-the-time) reasoning rewritten.

### 2026-09-04 — Real reliability bug found in this ticket's shipped default (fixed in ticket 0019)
While verifying ticket 0019's frontend dockerization end-to-end, every request against the Groq
default this ticket shipped failed outright with a `429`: `InferenceProvider.callOpenAiCompatible`
never set `max_tokens`, and Groq's per-minute output-token rate limit rejected the request based on
the model's full possible output size, not the classification task's actual short response. This
had been true since ticket 0007 first implemented the OpenAI-compatible call — it just never
surfaced until this ticket's default (Groq) was exercised against this specific account/key for
real. Fixed in ticket 0019's log/commit (`max_tokens: 500` added, with a regression test); noted
here since it directly affects this ticket's "shipped default actually works" claim.
