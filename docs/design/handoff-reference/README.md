# Handoff: OCS Training Log Generator (front end)

## Overview
A standalone, **static** web page that runs on local OCS computers. It reads a Microsoft Forms
export of staff training submissions and generates one AOIC-format log file per person, tracking
what has been generated and sent in a ledger so nothing is done twice. No server, no login, no
network — all file handling is client-side.

Owner: Office of Career Services, Cook County Juvenile Probation & Court Services.

## About the Design Files
The files in this bundle are **design references created in HTML** — a working prototype showing
the intended look, layout, and behavior. They are **not** production code to ship as-is.

The task is to **recreate this design in the target codebase's environment**, using its established
patterns and libraries. If no environment exists yet, this is a static single-page app with no
backend requirement — a plain HTML/CSS/vanilla-JS build (or a light framework like Preact/Vite)
is appropriate. Keep it dependency-light so it runs by opening a file locally.

> The prototype was authored with an internal component runtime (`support.js`, `.dc.html`). **Do not
> port that runtime.** Read the template + logic as a spec and rebuild with normal HTML/JS. The one
> file you SHOULD use verbatim is `ocs-theme.css`.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, states, and interactions are all decided and
come from `ocs-theme.css`. Recreate the UI to match, pulling every color/spacing/radius value from
that stylesheet's CSS custom properties rather than hardcoding hex.

## Locked — do NOT redesign
Per the spec these are fixed and this UI only orchestrates them:
- The AOIC .xlsx output layout (§6)
- The generated-log filename convention (§6)
- The ledger schema
- The processing/parsing rules

The prototype uses a **placeholder** filename pattern (`Last_First__Label__YYYY-MM-DD.xlsx`) and
**mocked** warning types. Replace both with the real spec values when implementing — they were not
provided to the designer.

---

## Screens / Views

The app is a single page with four views switched in the header: **Landing → Summary → Preview →
Ledger**. A persistent header (branding + text-size stepper + dark-mode toggle + Help) sits above all
views; a secondary nav tab row (Summary / Preview / Ledger) appears once a file is loaded.

### 1. Header (persistent)
- **Layout:** full-width bar, navy background (`--ocs-sb-bg`), `max-width:1180px` centered inner row,
  `padding:0.75rem 1.25rem`, flex, wraps on narrow screens.
- **Left:** 2.5rem rounded "OCS" badge (translucent white on navy) + two-line title:
  "Training Log Generator" (display font, 600) over "Office of Career Services · Cook County Juvenile
  Probation & Court Services" (0.78rem, muted).
- **Right controls (flex, gap 0.5rem):**
  - **Text-size stepper** — `role="group" aria-label="Text size"`, three "A" buttons at increasing
    glyph sizes (0.8 / 0.98 / 1.16rem). Sets `documentElement.style.fontSize` to **100% / 115% / 130%**.
    Active button = white bg, navy text, `aria-pressed="true"`. Persist to `localStorage['ocs-fontscale']`.
  - **Dark-mode toggle** — moon/sun glyph + "Dark"/"Light" label. Sets `html[data-ocs-mode="dark|light"]`.
    Default = **follow OS** (no attribute → theme falls through to `@media (prefers-color-scheme)`).
    Persist to `localStorage['ocs-mode']`. `aria-pressed` reflects dark on/off.
  - **Help** — "?" button; opens the Help drawer.
- **Secondary nav** (only when loaded): tab buttons with a 3px bottom border on the current tab;
  `aria-current="page"` on the active one.

### 2. Landing / drop zone
- **Purpose:** load the Forms export (and optional ledger) to begin.
- **Layout:** centered column, `max-width:720px`. Heading (1.6rem display) + one-paragraph plain-language
  intro (max 52ch).
- **Drop zone:** card (`--ocs-card-bg`), **2px dashed** border (`--ocs-border-hover`, → `--ocs-accent`
  while dragging), `border-radius:--ocs-radius-lg`, `padding:2.5rem 1.5rem`, centered. Contains: upload
  icon in a rounded tile, "Drag the form responses file here" (1.1rem, 600), sub-line "Add the ledger
  file too, if you have one. Accepts .xlsx and .csv." (0.95rem, secondary), a **"Browse files…"** primary
  button, a visually-hidden `<input type="file" multiple accept=".xlsx,.csv">`, and a reassurance line
  "Files never leave this computer. Nothing is uploaded." (0.8rem, muted).
- **Keyboard/a11y:** the drop zone is `role="button" tabindex="0"` with an `aria-label`; Enter/Space
  opens the picker. Drag events call `preventDefault`. The Browse button stops propagation so it doesn't
  double-fire the zone click.
- **"Load sample data to explore"** ghost button below — dev/demo affordance; optional in production.
- On file selected / dropped → go to **Summary**.

### 3. Summary
- **Purpose:** show what was found and offer the two paths.
- **Summary strip:** responsive grid (`auto-fit, minmax(150px,1fr)`, gap 0.85rem) of 4 stat cards:
  1. **submissions found** (plain number)
  2. **new (not yet generated)** — accent dot `●` + count
  3. **already generated** — green check `✓` + count
  4. **with warnings** — amber `⚠` + count
  Each card: `--ocs-card-bg`, 1px border, `--ocs-radius-lg`, `padding:1rem 1.1rem`, big display number
  (1.9rem/700) over a 0.85rem secondary label.
- **Initials prompt:** tinted bar (`--ocs-code-bg`) with `<label for="ocs-initials">Your initials</label>`,
  a `maxlength="4"` uppercase text input (6rem wide), and helper text "Stamped on every log you generate,
  so runs are traceable." This is the **only identity input** in the whole app.
- **Two path cards** (grid, `auto-fit minmax(260px,1fr)`, gap 1rem):
  - **Generate all new logs** (badge "QUICK") — primary filled button "Generate N logs". **Disabled until
    initials ≥ 2 chars** (button greys to `--ocs-status-neutral`, opacity 0.6, and a "⚠ Enter your initials
    above first." line shows). On click → mark all `new` subs `generated`, append to ledger, go to Ledger,
    toast confirmation with the initials.
  - **Preview & choose** — outline button "Open preview table" → Preview view.

### 4. Preview table
- **Purpose:** review each submission, resolve warnings, pick which to generate.
- **Header row:** title "Preview submissions" + "Newest first · N shown".
- **Filters (flex, wrap, align-end):** **Person** `<select>` (All people + one per submission) and
  **Status** `<select>` (All / New only / Already generated). Right-aligned **"Generate selected (N)"**
  button — disabled (grey, 0.6 opacity) when 0 selected.
- **Table:** card wrapper, horizontal scroll, `min-width:820px`. Columns:
  1. **checkbox** (select-all in header; only `new` rows are selectable)
  2. **Person** (600, nowrap)
  3. **Conference / Label** (max 26rem)
  4. **Date(s)** (mono, 0.85rem, secondary, nowrap)
  5. **Sessions** (count, centered)
  6. **Hours** (sum of session hours, 1 decimal, right-aligned, 600)
  7. **Status** — pill badge: **New** = neutral bg + `●`; **Already Generated (on MM/DD/YYYY)** = green
     bg + `✓`. Always symbol **and** text **and** color.
  8. **Warnings** — if any, a bordered chip "`⚠ N warnings ▾`" colored **red** if any error-level warning,
     else **amber**; `aria-expanded` toggles a detail row. Clean rows show an em-dash.
- **Expanded warning row:** inset panel listing each warning as "**Warning:**/**Error:** …" (tag colored),
  followed by the session breakdown (title + "date · N.N hr" mono).
- Selected rows get a `--ocs-row-hover` background tint.
- **Newest submission first** — do not paginate (hundreds of rows max; simple scroll).

### 5. Ledger
- **Purpose:** track generated logs, mark sent, sync back to the shared file.
- **Header:** "Ledger" + "N generated logs · M sent" + a one-paragraph explainer.
- **Actions (flex):** **"⭳ Download updated ledger"** (primary) and **"⤵ Merge another ledger…"** (outline).
- **Table** (card, scroll, `min-width:760px`): Person / Conference-Label / **Log file** (mono, 0.78rem,
  `--ocs-code-fg`) / **Generated** (date) / **Sent** toggle.
  - **Sent toggle** = `role="switch"` pill button. Unsent: `○ Mark as sent`, transparent, secondary text.
    Sent: `✓ Sent MM/DD/YYYY`, green bg/border/text, and the row gets a `--ocs-row-tint-good` background.
    `aria-checked` reflects state.

### 6. Help drawer
- Right-side overlay panel (`width:min(440px,100%)`, full height, slides/fades in), dimmed backdrop
  (click backdrop or × to close; `role="dialog" aria-modal="true"`).
- Sticky navy header with title + close button.
- Sections: **What this tool does** (2 lines), **Sync procedure (§8.5)** (ordered list), **Manual path —
  OCS-Pivot (§2.6)** (paragraph), and a collapsible **Developer handoff notes** block (see below).

---

## Interactions & Behavior
- **View switching:** landing → summary (on file load) → preview/ledger via the two path buttons and the
  nav tabs. Nav tabs appear only after load.
- **Generate (Quick):** requires initials ≥ 2 chars. Sets each affected submission `status:'generated'`,
  stamps `generatedOn = today`, appends a ledger entry (`sent:false`), routes to Ledger, shows a toast.
- **Generate selected:** same but only for checked `new` rows.
- **Select-all:** toggles all currently-shown `new` rows.
- **Warning expand/collapse:** per row, `aria-expanded` on the chip.
- **Mark as sent:** toggles `sent` and stamps/clears `sentOn`; tints the row.
- **Download / Merge:** in the prototype these fire a toast; in production wire to real file write / file
  picker per the locked ledger schema.
- **Toast:** `role="status"`, bottom-center, auto-dismiss ~3.2s.
- **Animations:** subtle `ocsIn` (6px rise + fade, 0.2–0.25s) on view/drawer/toast entry. **All animation
  and transition is disabled under `prefers-reduced-motion: reduce`** — keep this.
- **Responsive:** header wraps; stat/path grids use `auto-fit minmax`; tables scroll horizontally with a
  `min-width`. Targets are comfortable (roomy rows) per accessibility preference.

## State Management
Single-page local state (no fetching, no backend):
- `view`: `'landing' | 'summary' | 'preview' | 'ledger'`
- `mode`: `'system' | 'light' | 'dark'` → mirrored to `html[data-ocs-mode]` + localStorage
- `fontScale`: `1 | 1.15 | 1.3` → `documentElement.style.fontSize` + localStorage
- `initials`: string (uppercased, 2–4 chars; gates generation)
- `helpOpen`, `devOpen`, `dragOver`: booleans
- `filterPerson`, `filterStatus`: filter selections
- `selected`: map of submissionId → checked
- `expanded`: map of submissionId → warning-detail open
- `subs`: array of submissions (see data shape) — mutated to `generated` on generate
- `ledger`: array of ledger entries — appended on generate, `sent` toggled in Ledger view
- `toast`: transient string

**Data shapes** (prototype mock — replace field names with the real Forms/ledger schema):
```
submission = { id, person, last, label, dates, status:'new'|'generated', generatedOn?,
               sessions:[{ name, date, hours }],
               warnings:[{ level:'warn'|'error', text }] }
ledgerEntry = { id, subId, person, label, filename, generatedOn, sent, sentOn? }
```
Hours total = sum of `sessions[].hours`, shown to 1 decimal.

## Design Tokens
**Use `ocs-theme.css` as the single source of truth** — it defines light + dark values for every token
via CSS custom properties and a `[data-ocs-mode]` / `prefers-color-scheme` strategy. Do not hardcode
hex; reference the variables. Key groups used by this design:
- **Brand:** `--ocs-navy` (#1a365d), `--ocs-accent`, light-blue accents (#d5e8f0 family), `--ocs-on-accent`
- **Surfaces:** `--ocs-page-bg`, `--ocs-card-bg`, `--ocs-code-bg`, `--ocs-sb-bg` (header navy) + `--ocs-sb-*`
- **Text:** `--ocs-text-primary | -secondary | -muted`, `--ocs-code-fg`
- **Lines:** `--ocs-border`, `--ocs-border-hover`, `--ocs-row-hover`, `--ocs-row-tint-good`
- **Status (each has fg + bg):** `--ocs-status-good`, `--ocs-status-warn`, `--ocs-status-bad`,
  `--ocs-status-neutral` — always paired with a symbol + text label
- **Buttons:** `--ocs-btn-bg`, shadows `--ocs-shadow-btn`, `--ocs-shadow-card`
- **Radius:** `--ocs-radius-sm | -md | -lg`; **Focus:** `--ocs-focus-ring`
- **Type:** `--ocs-font-body`, `--ocs-font-display`, `--ocs-font-mono` — Noto Sans stack with **system-font
  fallbacks, no webfont fetches** (required — this runs offline/local).

## Accessibility requirements (WCAG 2.1 AA — required, not optional)
- Status/state conveyed by **symbol + text + color, never color alone** (badges, sent toggle, warnings).
- Real semantic `<button>`, `<input>`, `<select>`, `<label for>`; drop zone keyboard-operable.
- Visible `:focus-visible` ring (`--ocs-focus-ring`) — keep it.
- Text-size stepper (100/115/130%) **and** zoom-safe layout (everything in `rem`; no fixed px type).
- Dark mode defaults to OS, toggle overrides, choice persists.
- `prefers-reduced-motion` honored.
- Comfortable/roomy row density.

## Assets
- **`ocs-theme.css`** — the design-system tokens. Ship/adapt this file; it is the styling contract.
- **Icons:** inline SVG (upload arrow) and text glyphs (`● ✓ ⚠ ○ ☾ ☀ × ▾ ▴ ⭳ ⤵`). No external icon
  font or image assets — keep it self-contained for offline use.
- **No images.** No webfonts (system Noto/sans fallback stack only).

## Files
- `OCS Log Generator.dc.html` — the full prototype (all four views + help + toast). Read the markup for
  exact structure/copy and the embedded logic class for exact behavior/state. **Reference only — rebuild
  in the target environment; do not ship the `.dc.html` runtime.**
- `ocs-theme.css` — design tokens (**use verbatim**).
- `support.js` — the prototype's component runtime. **Ignore / do not port.**

## Developer handoff notes (also embedded in the app's Help drawer)
- Tokens from `ocs-theme.css` verbatim; no hardcoded hex. Dark mode = `html[data-ocs-mode]`, default OS,
  persisted. Text-size stepper sets `documentElement.style.fontSize` (100/115/130%); all type in `rem`.
- WCAG 2.1 AA; status = symbol + text + color; real controls; visible focus; keyboard-operable drop zone.
- Locked (do not redesign): AOIC xlsx layout (§6), filename convention (§6), ledger schema, processing
  rules. Replace the prototype's placeholder filename pattern and mocked warning types with the real spec.
- Parsing: one submission = one person's form (Name / Conference / Date(s) + a session table of
  Session / Date / Credit Hours / Relias flag). Sum hours; carry per-session warnings.
- No network, no login, no accounts, no settings page. Initials are the only identity input.
