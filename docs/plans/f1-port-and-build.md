# F1 — Port reference logic, build the single-file app

**Status:** authorized by Marty 2026-07-19 (chat go-ahead, ultracode).
**Spec:** `docs/specs/cope-processor-spec.md` (frozen, authoritative).
**Reference implementation:** `martin-gleason/cope-processor-flask` (archived, GitHub) — Python source of truth for parser/export behavior, per spec §5/§10.
**Design reference:** `docs/design/` — `ocs-theme.css` (vendor verbatim, local accent override), prototype `.dc.html`/README (UX spec only, do not port runtime).

## Decisions locked at kickoff (2026-07-19)

- Repo: `martin-gleason/cope-processor-standalone`, public. No LICENSE file yet — county IP policy unresolved (spec §10).
- Frontend: Preact + Vite + `vite-plugin-singlefile`, inlining SheetJS (read), ExcelJS (write styled xlsx w/ real Excel Tables), JSZip (bundle) into `dist/cope-processor.html`.
- Test fixtures: synthetic only (no real staff PII in this public repo) — including a fabricated "Victor Junious"-shaped row for the spec §11.2 golden E2E test, since the spec itself names that acceptance criterion.
- Theme: vendor `ocs-theme.css` verbatim; this citizen's local `--ocs-accent`/font-family override points at spec §9.1's navy `#1a365d` / light-blue `#d5e8f0` / Noto Sans, not the old `cope-processor-flask` citizen's violet/Source-Sans override.
- Test runner: Node's built-in `node:test` — no extra dependency, matches the "runnable via Node in CI" requirement (spec §10).

## Feature list

- **F1** — Parser port: `formsReader`, `hoursParser`, `sessionUnpivot`, `validators`, updated to the 2026–2027 schema (spec §4).
- **F2** — Export port: `aoicTemplate` (escaping/sanitization helpers), `aoicIndividual` (rewritten grouping — one log per submission, 14-session hard refusal, new label/filename rules per spec §5–§6), `masterTracker` (spec §7 styling).
- **F3** — Ledger module (new, no Python analog): schema v2.0, key/merge/mark-sent per spec §8.
- **F4** — UI: Preact four-view app (landing/summary/preview/ledger + help drawer), wired to F1–F3, matching `docs/design/handoff-reference/README.md` UX with real field names/filenames/warnings.
- **F5** — Golden tests: ported pytest vectors (hours parsing table, unpivot, header detection, AOIC structure) + new tests (ledger merge, filename collisions, 14-session refusal, Victor Junious E2E fixture) — all via `node:test`.
- **F6** — Build/CI: `package.json` scripts (`build`, `test`), GitHub Actions running `npm test` on push.

## Known deviations from the Python reference (intentional — spec overrides)

1. Required headers / provider dropdown / session detection: 2026–2027 schema (spec §4), not the old `Conference or Training Name` schema.
2. Grouping: one AOIC log per submission (not per person+conference across submissions).
3. Session cap: >14 sessions on one submission is a hard refusal with a clear error, not continuation-form chunking (deleted per spec §5).
4. Conference label rule and filename pattern are new (spec §5–§6), replacing `COPE_{Last}_{First}_{Conf}_{date}.xlsx`.
5. Excel Table ref for AOIC individual logs is `A4:C19` (spec §6, includes the SUM row) — the old Python code used `A4:C18`. Follow the spec, not the old code, on this point.
6. Master Tracker gains explicit header fill/text-color styling (spec §7) that the old `master_tracker.py` defined as constants but never applied to header cells.

## Open items carried from spec §12

1. Additional provider log visual examples from Marty — helpful, not blocking.
2. Training Series with per-session dates spanning weeks — label rule confirmed as provider-label; flag if a real submission looks wrong once Marty has real data to check against.
3. `/pacelt` tradition from the old `services/joe.py` — parked, no home in a static page.
4. No blank AOIC template fixture (`docs/presumed_provider_form.xlsx`) exists in the old repo or on disk — the old Python test suite validates the generated output structurally (cell values, fonts, table ref) rather than diffing against a binary template, so this isn't blocking. If Marty has a copy, it'd tighten the visual fixture set (spec §12.1).

-----
July 19, 2026

#AI/Claude
