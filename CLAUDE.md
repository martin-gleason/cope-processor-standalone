# CLAUDE.md — cope-processor-standalone

> Generated from the `cc-md` skill.

---

## What This Project Is

A single self-contained `.html` file for the **Office of Career Services, Cook County Juvenile Probation and Court Services**. It converts the MS Forms export of the Presumptive Provider Conference Credit Hours Verification form into AOIC-format `.xlsx` logs plus a JSON ledger — entirely client-side, zero install, zero network at runtime, **zero AI/LLM calls in the shipped tool**. Runs from a shared drive or double-click, in Edge/Chrome, over `file://`.

It is a faithful JS port of the Python reference logic in the archived `martin-gleason/cope-processor-flask` repo, with several **locked spec deviations** (2026–2027 form schema, one-log-per-submission grouping, new filename/ledger rules) — see `docs/specs/cope-processor-spec.md` §5–§8 for exactly what changed and why. The spec is authoritative and frozen; do not edit it during implementation. Design UX reference lives in `docs/design/` (`ocs-theme.css` vendored verbatim with a per-citizen navy/light-blue accent override; the prototype `.dc.html` + its README are read as a UX spec only — do not port that runtime).

| Artifact | Role | Lives |
|---|---|---|
| **CLAUDE.md** (this file) | Standing rules: workflow, authorization, conventions, hooks. Loaded every session. | Project root |
| **Spec** | The intention — what, why, locked decisions, out-of-scope. | `docs/specs/cope-processor-spec.md` |
| **Plan** | The build — detailed implementation; where hooks get defined. | `docs/plans/` |

The spec sets intention. The plan defines the hooks. This file governs how the agent moves between them.

---

## Conventions Sourcing

```markdown
@docs/conventions.md
```

Hybrid model: this repo vendors its own pinned `docs/conventions.md` rather than reaching into a parent workspace — it must stay independently viable if cloned alone (no OCS-Ecosystem monorepo parent exists for this citizen).

---

## Authorization Model

**This is non-negotiable. Read it before doing anything.**

1. The spec is context, not a work order.
2. Work begins ONLY when Marty gives explicit instruction in the current chat session.
3. Passing tests within a feature loop authorizes completing **that loop** — nothing more.
4. Moving to the next feature requires explicit authorization.
5. Do NOT start the next feature without Marty's go-ahead.

---

## The Working Loop

Every substantive task: **explore → plan → code → commit**.

1. **Spec review + plan generation — Ultrathink.** Read the spec, batch clarifying questions before generating, paraphrase back, draft the plan. The plan defines this build's hooks.
2. **Implementation — ultracode.** Code runs under ultracode unless the planning prompt states otherwise.
3. **Adversarial review — mandatory, on top of ultracode.** Fire `.claude/agents/adversarial-reviewer.md`:
   - **At the end of all feature development** — before "done."
   - **At session start / restart** — review what shipped *and* re-read the outstanding feature list (spec holds the list; plan holds the detailed implementation). Never resume blind.
4. **Verification.** Run `npm test` (Node's built-in test runner — no extra test-runner dependency) and `npm run build`; show the evidence, don't assert success. §11.8 of the spec (file:// + no-network in Edge) is a manual checklist item — not automatable in Node — call this out explicitly when claiming a release is done.
5. **Commit.** Conventional-commit, primary ID in scope. Open the PR. Log the review.

---

## The Learning Dial

**This project's level: 5% (floor).** JS/TS is Claude Code's authorship lane for Marty (his own 5% learning track is GitHub + Python, tracked elsewhere) — the agent authors here, Marty reviews every PR. No 🎓-tagged features on this repo by default; if Marty wants to hand-author a piece, he'll say so and it gets called out in the plan.

---

## PR Review Log

- `docs/pr-review-log.md`, committed directly to `main` right after merge (retrospective markdown, no code, no CI). Conventional message: `docs(cope-processor-standalone): add PR #N review-log entry`.
- **Branch-protection note:** leave admin/maintainer bypass on — require PRs for contributors, permit Marty's direct log commit.
- Before merging/reviewing a PR, check the log has an entry for the last-merged PR. If missing or stale, surface politely — **do not block**.

---

## Hooks

**Hooks are deterministic; CLAUDE.md text is advisory.** A rule the agent can drift past belongs in a hook. The spec sets the intention; the plan defines the hook; writing hook code follows the Authorization Model above.

| Candidate | Surface | Note |
|---|---|---|
| Conventional-commit format `<type>(<id>): <description>` | commit-msg hook | |
| Branch naming `<feature-id>/<slug>` | pre-action hook on branch create | |
| PR-review-log freshness | Stop hook / PR-event check | |
| No secrets/credentials in the diff | PreToolUse / PostToolUse scan | |
| Tests + build pass before "done" | Stop hook | `npm test && npm run build` |
| **No network calls anywhere in `src/`** — zero-network-at-runtime is a hard spec constraint (§2.2) | PostToolUse scan / dependency allowlist | blocks `fetch`, `XMLHttpRequest`, `WebSocket`, telemetry SDKs in shipped code |
| **No external asset URLs** — fonts, icons, scripts must be vendored inline into `dist/cope-processor.html` | PostToolUse scan | webfont fetches explicitly forbidden by spec §9.1 |
| **No AI/LLM attribution in emitted `.xlsx` outputs** — Author metadata field must read `Office of Career Services` (spec §6) | PostToolUse output check | |
| **No real staff/person names in fixtures** — this repo is public; test data must be synthetic (see spec deviation log in `docs/plans/`) | PreToolUse scan on `test/fixtures/` | |
| **Golden-test conformance** — hours-parser dispatch order, `pyGet`/`pyRound2` semantics, filename/ledger rules must match the ported Python behavior exactly before a parser/export change is "done" | Stop hook | `npm test` |
| WCAG 2.1 AA on the UI | CI check (not a local hook) | 4.5:1 normal text, 3:1 large |
| Rebase-and-merge only | GitHub branch-protection (not a hook) | |

---

## Adversarial Reviewer Subagent

Installed at `.claude/agents/adversarial-reviewer.md`. Fresh context, sees only the diff and the plan. Reviews the diff against the plan, checks lint, checks tests, and hunts security gaps. Reports only correctness / security / requirement gaps — not style.

---

## Global Rules

- **Zero network at runtime.** No `fetch`, no telemetry, no external APIs in anything under `src/` that ships in `dist/cope-processor.html`. Build-time npm dependencies are fine; runtime network calls are not.
- **No external asset URLs** in the emitted artifact — self-contained / embedded (fonts, icons, libraries all vendored inline).
- **Accessibility:** WCAG 2.1 AA on the UI, status conveyed by symbol + text + color (never color alone).
- **Module system:** ES modules throughout (`src/`), bundled via Vite + `vite-plugin-singlefile` into one `dist/cope-processor.html`.
- **Infrastructure:** none at runtime by design (static file). Dev/build tooling only: Vite, Preact, Node's built-in test runner. GitHub Actions for CI (`npm test` on push) — no deploy target, the artifact is downloaded/copied by hand.
- **Repo visibility:** public. County IP policy has not yet cleared a formal license (spec §10) — **no LICENSE file** until that's resolved; treat the repo as all-rights-reserved in the interim.
- **Output attribution:** `.xlsx` Author metadata = `Office of Career Services`. No AI/Claude attribution in any emitted output file (the tool itself is zero-AI at runtime — see spec §2.1). This CLAUDE.md and other repo *documentation* (not generated outputs) may carry the standard OCS `#AI/Claude` footer per house style below.
- **PII in fixtures:** synthetic only. The old Python reference repo's real 10-row export and any real staff names must never be copied into this public repo's `test/fixtures/`.

## OCS House Style (identity & footer, applies to markdown deliverables — not to shipped app code or generated user output)

- **Author tag:** `OCS — Marty` (subject) / `OCS — Claude Code` (preparer) on planning docs, matching the spec's own attribution line.
- **Footer on emitted markdown deliverables** (plans, handoffs, review logs — not the spec, which is frozen, and not app source):
  ```
  -----
  {Date created}

  #AI/Claude
  ```
  The `#AI/Claude` tag is load-bearing — it's how items are found later in Bear.

---

## Keeping This File Healthy

- **Lean beats complete.** If a rule keeps getting ignored, the file is too long. Prune.
- **Sometimes-relevant knowledge → a skill, not here.**
- **Emphasis allowed** on rules that matter.
- **Treat this file like code** — review when things go wrong; test by watching whether behavior shifts.

-----
July 19, 2026

#AI/Claude
