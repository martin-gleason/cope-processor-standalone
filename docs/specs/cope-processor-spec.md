# COPE Processor — Standalone Static Tool Specification

**Office of Career Services — Cook County Juvenile Probation and Court Services**
**Version:** v1.0 | July 17, 2026
**Author:** OCS — Marty (subject) / OCS-1138 (preparer)
**Audience:** Claude Design (page design pass), then Claude Code (build), then successors reading cold
**Status:** Spec. This document is context, not a work order. No implementation begins without Marty's explicit verbal go-ahead.

---

## 1. Purpose

OCS-Ecosystem is paused. COPE Processor is being extracted from it as a standalone tool that survives on its own with no ecosystem, no server, no database, and no Marty.

The tool converts the raw MS Forms export of the **Presumptive Provider Conference Credit Hours Verification 2026–2027** form into official AOIC presumptive provider log spreadsheets, plus a JSON ledger that tracks what has been generated and what has been sent to AOIC.

Primary operators: **Shelly Golden-Harris and Leanne Engleman (SPO Trainers)** and **Tammi Akis (OCS Assistant)**. They are capable professionals and non-programmers. The tool must require nothing beyond a browser and a file.

## 2. Hard constraints

1. **Zero AI.** No LLM calls, no external APIs, no telemetry. Every transform is deterministic code.
2. **Zero install.** Cook County machines cannot install applications. The tool is a **single self-contained `.html` file** — all JavaScript libraries vendored inline — opened by double-click or from a shared drive. It must work over `file://` in Edge and Chrome with **no network access at runtime**.
3. **Data never leaves the machine.** All parsing and generation happens client-side. No uploads anywhere.
4. **Must process the form export as it currently stands** (the 2026–2027 schema in §4). The prior codebases cannot — that is the break being fixed.
5. **Do not reinvent.** The Python library in `cope-processor-flask/cope_processor/` is the reference implementation. Port its behavior (parser, hours logic, warnings, escaping, sanitization) faithfully into JavaScript. Clean, correct, and simplify — but the Python behavior and its test vectors define correctness.
6. **OCS-Pivot.** If the tool is unavailable, the manual path is: open the Forms export in Excel, copy sessions into the blank AOIC template by hand, and note it in the ledger JSON with a text editor. The Help panel (§9.4) documents this.

## 3. What the tool does — two modes

**Quick mode.** Drag the Forms export (and the ledger file, if one exists) onto the page. The tool generates an AOIC log for **every submission not already in the ledger**, bundles the logs into a zip, produces an updated ledger, and offers both as downloads.

**Preview mode.** Same inputs, but the tool first shows a table of all submissions — newest first — with ledger status badges (**New / Generated / Sent**) and inline warnings. The operator checks the submissions to transform, then generates. This is how an operator finds "just the ones since last month" without generating duplicates.

Both modes end with two downloads: `AOIC_Logs_{M-D-YY}.zip` and the updated ledger JSON. The tool never sends anything; a human emails the logs to AOIC and later marks them Sent (§8).

## 4. Input contract — the 2026–2027 MS Forms export

One `.xlsx`, first sheet, header row 1, one row per form submission. Exact headers (39 columns):

| Column | Notes |
|---|---|
| `ID` | Submission key, integer, required |
| `Start time`, `Completion time` | Timestamps |
| `Email` | Usually "anonymous" |
| `Name` | Usually blank |
| `First Name`, `Last Name` | Required |
| `Date of Conference or Training` | Header-level date; fallback for sessions with no date |
| `Is this a single training, a training series, or a conference` | Values: `Single Training/Webinar`, `Training Series`, `Conference` |
| `Conference Name` | Only filled when type = Conference |
| `Please indicate who provided the training -- this is necessary to ensure the training was done by a COPE Presumptive Provider.` | Provider dropdown; exact header text including double hyphen and trailing period |
| `When was the last day of the conference` | Only filled for conferences |
| Session groups 1–7 | `Session Attended or Training Name`, `Date of training`, `Credit Hours Per Session`, `Is this your last session or training` — session 1 unsuffixed; sessions 2–7 append the number directly (`Date of training2`); session 7 has no last-session flag |

**Provider dropdown values** (acronym = text before the colon, used verbatim):
`APPA: American Probation and Parole Association` · `AOIC: Administrative Offices of the Illinois Courts` · `NCSC: National Center for State Courts` · `ACJI: Alliance for Community and Justice Innovation` · `IPSCA: Illinois Probation and Court Services Association` · `JDAI: Juvenile Detention Alternative Initiative`

**Validation on load** (port from `forms_reader.py`): reject non-`.xlsx`; reject if required headers are missing (ID, Email, First Name, Last Name, Date of Conference or Training, the training-type column, the provider column, and at least one session group); reject empty files; keep the decompression-bomb guards (50,000-row / 2,000-column caps); reset sheet dimensions before scanning (MS Forms exports carry bad dimension metadata). Errors are plain-English and name the missing columns.

If MS Forms adds session groups beyond 7 in a future form revision, the suffix-scanning detection must pick them up automatically — do not hardcode 7.

## 5. Processing rules

Port these behaviors from the Python reference without change in outcome:

**Session unpivot** (`session_unpivot.py`): one tall row per non-empty session title. Shared fields extracted once per submission. Per-session date falls back to the header-level `Date of Conference or Training` when blank — single trainings always use the header date.

**Hours parsing** (`hours_parser.py`): numeric values pass through rounded to 2 places; word numbers via the word map (`one`…`ten`, `half`, `quarter`, `a half`, `an hour`, `a quarter`); `"N hours"` and `"N hrs"`; `"N minutes"` converted; combined `"1 hour 30 minutes"` in either order; empty/unparseable → `0.0` with `PARSE_ERROR`. Values `< 0` or `> 24` are kept but flagged `OUT_OF_RANGE` — never clamped, never silently corrected. Every non-trivial parse emits its typed warning.

**Warning taxonomy** (keep all): `PARSE_ERROR`, `WORD_TO_NUMBER`, `MINUTES_CONVERTED`, `COMBINED_PARSED`, `HOURS_SUFFIX`, `FRACTION_WORD`, `MISSING_NAME`, `MISSING_CONFERENCE`, `ZERO_HOURS`, `POSSIBLE_DUPLICATE`, `MISSING_DATE`, `EARLY_COMPLETION`, `OUT_OF_RANGE`. Warnings attach to submissions and surface in Preview mode; they never block generation — the operator decides.

**Validators** (`validators.py`): missing first name falls back to the email prefix with a `MISSING_NAME` warning; duplicate detection flags same person + same label + same session title as `POSSIBLE_DUPLICATE`.

**Security** (`aoic_template.py`): formula-injection escaping (leading `=`, `+`, `-`, `@`, tab, CR get an apostrophe prefix) on every user-supplied string written to any xlsx. Filename sanitization strips `< > : " / \ | ? *`, converts spaces to underscores.

**Grouping — locked decision:** **one AOIC log per submission.** A webinar submission becomes one log; a conference submission groups all its sessions into one log. Do **not** group by person + conference across submissions (the old code did; this replaces it). Because the form caps at 7 sessions and the AOIC data area holds 14, continuation-form chunking is deleted. Add a guard instead: if a submission somehow exceeds 14 sessions, refuse that submission with a clear error rather than truncating.

**Conference label — locked decision:** if training type = `Conference`, the label is the `Conference Name` field. Otherwise (Single Training/Webinar or Training Series, where Conference Name is blank), the label is `{Provider acronym} Webinars` — e.g., `APPA Webinars`, matching the Junious precedent. If Conference Name is blank on a type = Conference submission, fall back to the provider label and flag `MISSING_CONFERENCE`.

## 6. Output contract — the AOIC log

One `.xlsx` per selected submission, matching the original AOIC template (`docs/presumed_provider_form.xlsx` in the old repo — include it as a fixture):

| Element | Requirement |
|---|---|
| Font | Times New Roman 12pt throughout, no bold |
| Row 1 | `Presumptive Provider Conference Credit Hours Verification`, merged A1:C1, centered |
| Row 2 | A2: `Conference: {label}` · C2: `Date(s): {dates}` |
| Row 3 | A3: `Name: {First} {Last}` |
| Row 4 | Headers exactly, with trailing spaces: `Session Attended (List each session individually) ` / `Date` / `Credit Hour(s) (per session) ` |
| Rows 5–18 | Sessions: title (escaped) / date, number format `m/d/yyyy` / hours, General format (shows 1, 1.5, 1.75) |
| Row 19 | C19: `=SUM(C5:C18)` |
| Table | Excel Table over **A4:C19**, style **TableStyleMedium2**, row stripes on — this supplies the header color and alternating rows, which are required visuals |
| Column widths | A = 123.5 · B = 10.2 · C = 41.5 · D = 8.85 |

**Date(s) rule — locked:** single training → the training date as `m/d/yyyy` (Victor's reads `6/9/2026`). Conference or series → `m/d/yyyy - m/d/yyyy`, first through last session date, with each session's own date in its row. No spelled-out month names.

**Filename — locked to the replica pattern:**
`{M-D-YY}_presumed_provider_form_{FirstInitial}__{LastName}.xlsx`
Example: `6-9-26_presumed_provider_form_V__Junious.xlsx`. Date = the training date; for conferences, the first day. No leading zeros. Double underscore between initial and last name. Sanitize the last name per §5. On collision (same person, same date, two submissions), append `_2`, `_3`.

**File metadata:** Author = `Office of Career Services`. No AI attribution anywhere in outputs.

## 7. Secondary output — Master Tracker

The Preview table doubles as the Master Tracker. One button — **Export Tracker** — writes it as a single-sheet xlsx in OCS internal styling (header fill `#D5E8F0`, header text `#1A365D`, alternating rows `#F5F5F5`, warning cells `#FEF3C7`), columns: Last Name, First Name, Email, Conference/Label, Session Title, Date, Credit Hours, Original Hours Input, Submitted, Warnings, Ledger Status.

The old Compiled Training List output (sheet per conference) is **dropped**. Rationale: per-submission logs plus the tracker cover its use, and every removed button makes the tool easier for its operators.

## 8. The ledger — dedupe and "did this go to AOIC"

A JSON file, human- and machine-readable, replacing `aoic_submissions_sent.json` v1.2. It is the tool's memory: since the page is static and stateless, the ledger is dragged in with the export and downloaded updated after each run.

```json
{
  "schema_version": "2.0",
  "form_year": "2026-2027",
  "updated": "2026-07-17T14:30:00-05:00",
  "updated_by": "SGH",
  "entries": [
    {
      "key": "2026-2027#17",
      "submission_id": 17,
      "first_name": "Victor",
      "last_name": "Junious",
      "label": "APPA Webinars",
      "provider": "APPA",
      "dates": ["2026-06-09"],
      "total_hours": 1.5,
      "filename": "6-9-26_presumed_provider_form_V__Junious.xlsx",
      "generated_at": "2026-07-17T14:29:00-05:00",
      "generated_by": "SGH",
      "sent_to_aoic": false,
      "sent_at": null
    }
  ]
}
```

Rules:

1. **Key** = `{form_year}#{submission_id}`. MS Forms IDs are stable and monotonically increasing within a form; the form-year prefix protects against ID reuse when the 2027–2028 form launches.
2. **Statuses:** absent from ledger = **New**; present with `sent_to_aoic: false` = **Generated**; `true` = **Sent**. Quick mode skips anything present; Preview shows badges and pre-unchecks non-New rows (operator can override to regenerate).
3. **Marking Sent** happens in the tool: a ledger view lists Generated entries with a "Mark as sent to AOIC" toggle; saving downloads the updated ledger. The tool never emails anything.
4. **Merging:** the page accepts multiple ledger files and unions them by key — latest `updated`/`generated_at` wins per entry, and `sent_to_aoic: true` always beats `false`. This is how two operators who ran separately reconcile.
5. **Sync procedure** (rendered in the Help panel, 8th-grade reading level): the ledger lives in **one shared folder** (the same Teams/shared-drive location as the tool itself). Before a run: get the ledger from the shared folder. After a run: save the downloaded ledger back to the shared folder, replacing the old one. If you forgot and two copies exist: drag both in, the tool merges them, save the merged one back. Operator identity: the page asks for initials once per session and stamps `generated_by`/`updated_by`.

## 9. UI requirements — Claude Design's canvas

Claude Design owns page layout, visual design, and flow polish within these bounds. **Locked and not designable:** the AOIC xlsx visuals (§6), filename convention, ledger schema, and processing rules.

1. **Branding:** Office of Career Services, Cook County Juvenile Probation and Court Services. White background, navy `#1a365d` headers, light blue `#d5e8f0` accents, Noto Sans (system-font fallback stack — no webfont fetches). WCAG 2.1 AA. Status conveyed by text/symbol plus color, never color alone. Reference `ocs-theme.css` in the old Flask repo for tokens.
2. **Landing state:** one large drop zone accepting the Forms export and ledger file(s) together, plus a file-picker button fallback. Plain-language guidance visible before any file is loaded ("Drag the form responses file here. Add the ledger file too, if you have one.").
3. **After load:** summary strip (submissions found, new vs. already generated vs. sent, warning count), then the two paths: **Generate all new logs** (Quick) and **Preview & choose** (Preview).
4. **Preview table:** newest submission first; checkbox per row; columns for person, label, date(s), sessions, hours total, status badge, warnings indicator with expandable detail. Filter by person and by status. No pagination games — these exports are hundreds of rows at most.
5. **Ledger view:** entries list, Mark-as-sent toggles, merge affordance, download-updated-ledger button.
6. **Help panel:** always reachable; contains the sync procedure (§8.5), the OCS-Pivot manual path (§2.6), and a two-line "what this tool does."
7. No login, no accounts, no settings pages. Initials prompt is the only identity input.

## 10. Implementation notes for Claude Code

- Single `.html` file. Vendor **SheetJS** (read xlsx), **ExcelJS** (write styled xlsx with real Excel Tables), and **JSZip** (bundle logs) inline. Verify Excel Table + style output from ExcelJS opens clean in county desktop Excel.
- Port, don't rewrite: translate `forms_reader`, `session_unpivot`, `hours_parser`, `validators`, and the `aoic_template` escaping/sanitization into JS modules within the file. Delete: all auth (both stacks), data model/store/backup, processing-log/diff-engine (the ledger replaces it), Flask web layer, Neon, email, rate limiting, run history, continuation-form chunking.
- **Golden tests:** port the pytest vectors from `tests/test_hours_parser.py`, `test_session_unpivot.py`, `test_forms_reader.py`, and `test_aoic_individual.py` into a JS test file (runnable via Node in CI; the shipped page carries no test code). Add one end-to-end fixture: the Victor Junious submission row must produce a log whose cell values, labels, dates, SUM range, and filename match `6-9-26_presumed_provider_form_V__Junious.xlsx` exactly, and whose table/fonts match the blank template fixture.
- Repo layout: source modules + a build step that inlines everything into `dist/cope-processor.html` is acceptable, provided the shipped artifact is the one self-contained file.
- License posture: open source, county IP policy check before formal license assignment.

## 11. Acceptance criteria

1. Today's real 2026–2027 export loads without error; the old `Conference or Training Name` schema is gone from validation.
2. Victor's submission → byte-equivalent-in-substance replica (values, formats, table, filename).
3. A 3-session conference submission → one log, `Date(s): m/d/yyyy - m/d/yyyy`, per-row dates, correct SUM.
4. Quick mode with a ledger containing 2 of 5 submissions generates exactly 3 logs and a 5-entry updated ledger.
5. Dragging two divergent ledgers merges correctly; Sent status survives the merge.
6. Messy hours inputs ("1 hour 30 minutes", "ninety minutes", "two hours", "-1", "300") parse to the same values and warnings as the Python reference.
7. A session title beginning with `=` lands in the xlsx as inert text.
8. Everything above works in Edge over `file://` with networking disabled.

## 12. Open items

1. Additional provider log examples from Marty would tighten the visual fixture set — helpful, not blocking; the blank template is canonical.
2. Training Series with per-session dates spanning weeks: label rule (§5) says provider label; confirm during build if a real series submission looks wrong.
3. The `/pacelt` tradition from `services/joe.py` has no home in a single static page. Parked, not forgotten.

---
-----
July 17, 2026

#AI/Claude
