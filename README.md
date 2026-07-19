# COPE Processor — Standalone

A single self-contained `.html` file for the Office of Career Services, Cook County Juvenile Probation and Court Services. It converts the MS Forms export of the *Presumptive Provider Conference Credit Hours Verification* form into AOIC-format `.xlsx` logs, plus a JSON ledger tracking what's been generated and sent to AOIC.

- **Zero AI.** No LLM calls, no external APIs, no telemetry.
- **Zero install.** One `.html` file, opened by double-click or from a shared drive. Works over `file://` with no network access.
- **Data never leaves the machine.** All parsing and generation happens client-side.

See `docs/specs/cope-processor-spec.md` for the full specification.

## Development

```sh
npm install
npm run build   # produces dist/cope-processor.html — the shipped artifact
npm test        # node:test — golden vectors ported from the Python reference implementation
```

## Repo layout

- `docs/specs/` — the frozen spec (intention, locked decisions).
- `docs/plans/` — implementation plans (the build, where hooks get defined).
- `docs/design/` — UX design handoff reference (`ocs-theme.css`, prototype, README) — read as spec, not shipped.
- `src/parser/`, `src/export/`, `src/ledger/` — ported/new logic modules.
- `src/ui/` — Preact application.
- `test/` — golden tests and synthetic fixtures.

## License

Not yet assigned — county IP policy review pending (see spec §10). Treat as all-rights-reserved until resolved.
