# 0014 — Standardize ticket format with Log section

**Priority:** P1
**Phase:** N/A (process/tooling, not a roadmap phase)

## Description

Add a standardized `## Log` section to the end of every ticket, documenting work and decisions
relevant to that specific ticket over its lifetime. Going forward, an agent may not edit a
ticket's `Description` or `Definition of done` after creation without also adding a Log entry
stating what changed and why — those two sections are the stable contract for a ticket, the Log
is where reasoning and history accumulate.

This was prompted by two tickets (0012, 0013) already growing ad hoc `## Status` / `## Resolution`
sections because there was nowhere structured to put that narrative.

## Definition of done

- `docs/tickets/index.md`'s "Ticket format" section documents the new structure and the
  Description/DoD edit rule
- All existing tickets (0001-0013) migrated: Log section appended, ad hoc sections (0012's
  `Status`, 0013's `Resolution`) restructured into dated Log entries with no content lost
- Already-finished tickets with real work but no in-file narrative (0001) get their Log backfilled
  from commit history
- The one existing retroactive case (0003's Definition of done was amended after creation, before
  this rule existed) gets a Log entry explaining the change

## Log

### 2026-09-03 — Migration
Read every existing ticket file's exact current content before restructuring (not from memory).
Applied the template uniformly: empty-log placeholder for not-yet-started tickets (0002, 0004-0011),
backfilled Log entries from commit history for 0001 (no prior in-file narrative existed), and
restructured the ad hoc `Status`/`Resolution` sections in 0012/0013 into dated Log entries with no
content changes beyond formatting. Added a retroactive Log entry to 0003 documenting the DoD
amendment made when ticket 0013 was created, per the new rule applied backward to the one case that
predates it.
