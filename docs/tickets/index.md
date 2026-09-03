# Ticket Index

Living index of all tasks. Each ticket is a markdown file under one of: `open/`, `in_progress/`,
`blocked/`, `finished/`, `closed/`. Move the file between folders as status changes; update this
table in the same commit.

## Ticket format

Each ticket file contains, in order: a one-line title, priority (P0-P2), phase, a `Description`,
a `Definition of done`, and a `Log`.

`Description` and `Definition of done` are the stable contract for a ticket, written at creation.
An agent may not edit either after creation without also adding a Log entry stating what changed
and why — the Log is where reasoning, decisions, and history accumulate instead.

The `Log` is a running, dated list of entries (`### YYYY-MM-DD — <short label>`) documenting work
and thinking relevant to that specific ticket over its lifetime, regardless of which status folder
it currently sits in. A not-yet-started ticket's Log reads `_No work logged yet._`.

## Tasks

| Ticket | Priority | Status | Phase |
|---|---|---|---|
| [0001-backend-bootstrap](finished/0001-backend-bootstrap.md) | P0 | finished | Phase 1 |
| [0002-frontend-bootstrap](finished/0002-frontend-bootstrap.md) | P0 | finished | Phase 1 |
| [0003-backend-testing-suite](finished/0003-backend-testing-suite.md) | P0 | finished | Phase 2 |
| [0004-llm-observability-logging](finished/0004-llm-observability-logging.md) | P1 | finished | Phase 2 |
| [0005-hardware-latency-probe](finished/0005-hardware-latency-probe.md) | P0 | finished | Phase 3 |
| [0006-local-llm-benchmark](finished/0006-local-llm-benchmark.md) | P0 | finished | Phase 3 |
| [0007-inference-provider](open/0007-inference-provider.md) | P0 | open | Phase 3 |
| [0008-latency-concurrency-verification](open/0008-latency-concurrency-verification.md) | P0 | open | Phase 4 |
| [0009-required-ui-components](open/0009-required-ui-components.md) | P0 | open | Phase 4 |
| [0010-architecture-and-submission-docs](open/0010-architecture-and-submission-docs.md) | P0 | open | Phase 4 |
| [0011-nice-to-haves](open/0011-nice-to-haves.md) | P2 | open | Phase 5 |
| [0012-dockerize-backend](finished/0012-dockerize-backend.md) | P1 | finished | Phase 1 |
| [0013-normalize-error-response-contract](finished/0013-normalize-error-response-contract.md) | P1 | finished | Phase 2 |
| [0014-standardize-ticket-format](finished/0014-standardize-ticket-format.md) | P1 | finished | N/A |
| [0015-cloud-model-benchmark](finished/0015-cloud-model-benchmark.md) | P1 | finished | Phase 3 |
