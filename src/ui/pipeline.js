// UI-layer glue: wires the parser/validator/ledger/export modules together
// into the shapes the views need. No processing rules live here — this file
// only calls the real modules and reshapes their output for display.

import JSZip from "jszip";
import {
  readFormsExport,
  validateFormsExport,
  detectSessionColumns,
  InvalidFormatError
} from "../parser/formsReader.js";
import { unpivotSessions } from "../parser/sessionUnpivot.js";
import { validateRow, findDuplicates, checkEarlyCompletion } from "../shared/validators.js";
import { FORM_YEAR } from "../shared/constants.js";
import { pyGet, toJsDate } from "../shared/pyUtils.js";
import { getSubmissionStatus, mergeLedgers, makeLedgerEntry, markSent as markSentEntry } from "../ledger/ledger.js";
import { generateIndividualLog } from "../export/aoicIndividual.js";
import { generateMasterTracker } from "../export/masterTracker.js";

export { InvalidFormatError };

// detectSessionColumns() (formsReader.js) returns { title, date, hours, last }
// per session group; unpivotSessions() (sessionUnpivot.js) reads
// col.titleCol / col.dateCol / col.hoursCol. Normalize once here rather than
// touch either module (owned by other agents this pass).
function toUnpivotSessionCols(sessionCols) {
  return sessionCols.map((c) => ({ titleCol: c.title, dateCol: c.date, hoursCol: c.hours, lastCol: c.last }));
}

// UI-only severity heuristic for the warning chip color (spec's warning
// taxonomy, §5, is a flat list with no warn/error split of its own).
const ERROR_LEVEL_WARNING_TYPES = new Set([
  "PARSE_ERROR",
  "MISSING_NAME",
  "MISSING_CONFERENCE",
  "MISSING_DATE",
  "OUT_OF_RANGE"
]);

export function warningLevel(warningType) {
  return ERROR_LEVEL_WARNING_TYPES.has(warningType) ? "error" : "warn";
}

function formatMDYYYY(date) {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

function isoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function computeLabel(row) {
  const trainingType = pyGet(row, "Training Type", "");
  const conferenceName = pyGet(row, "Conference Name", "");
  const provider = pyGet(row, "Provider", "");
  const webinarLabel = `${provider} Webinars`;
  if (trainingType === "Conference") {
    return conferenceName || webinarLabel;
  }
  return webinarLabel;
}

function displayDates(sessionRows) {
  const dates = sessionRows
    .map((r) => toJsDate(pyGet(r, "Date of Training", null)))
    .filter((d) => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());
  if (dates.length === 0) return "";
  if (dates.length === 1) return formatMDYYYY(dates[0]);
  return `${formatMDYYYY(dates[0])} - ${formatMDYYYY(dates[dates.length - 1])}`;
}

function emptyLedger() {
  return { schema_version: "2.0", form_year: FORM_YEAR, updated: null, updated_by: null, entries: [] };
}

// Reads File objects, runs the real pipeline (parse -> unpivot -> validate ->
// ledger status), and returns { subs, tallRows, ledger } for the UI.
export async function buildSubmissions(formsFile, ledgerFileObjects) {
  const buffer = await formsFile.arrayBuffer();
  const { headers, rows } = await readFormsExport(new Uint8Array(buffer));
  validateFormsExport(headers);

  const sessionColsRaw = detectSessionColumns(headers);
  const [tallRows, hoursWarnings] = unpivotSessions(rows, toUnpivotSessionCols(sessionColsRaw));

  const allWarnings = [...hoursWarnings];
  for (const row of tallRows) allWarnings.push(...validateRow(row));
  allWarnings.push(...findDuplicates(tallRows));
  for (const wideRow of rows) allWarnings.push(...checkEarlyCompletion(wideRow, sessionColsRaw));

  const warningsBySubmission = new Map();
  for (const w of allWarnings) {
    const sid = w.submission_id;
    if (!warningsBySubmission.has(sid)) warningsBySubmission.set(sid, []);
    warningsBySubmission.get(sid).push(w);
  }

  const bySubmission = new Map();
  for (const row of tallRows) {
    const sid = pyGet(row, "Submission ID", 0);
    if (!bySubmission.has(sid)) bySubmission.set(sid, []);
    bySubmission.get(sid).push(row);
  }

  const ledger = mergeLedgers(ledgerFileObjects.length > 0 ? ledgerFileObjects : [emptyLedger()]);

  const subs = [];
  for (const [sid, sessionRows] of bySubmission) {
    const first = sessionRows[0];
    const key = `${FORM_YEAR}#${sid}`;
    const status = getSubmissionStatus(ledger.entries, key);
    const ledgerEntry = ledger.entries.find((e) => e.key === key) || null;
    const totalHours = sessionRows.reduce((sum, r) => sum + (pyGet(r, "Credit Hours", 0) || 0), 0);

    subs.push({
      id: sid,
      key,
      firstName: pyGet(first, "First Name", ""),
      lastName: pyGet(first, "Last Name", ""),
      email: pyGet(first, "Email", ""),
      trainingType: pyGet(first, "Training Type", ""),
      provider: pyGet(first, "Provider", ""),
      label: computeLabel(first),
      dates: displayDates(sessionRows),
      submitted: pyGet(first, "Submitted", ""),
      sessions: sessionRows,
      totalHours,
      status,
      ledgerEntry,
      warnings: warningsBySubmission.get(sid) || []
    });
  }

  subs.sort((a, b) => b.id - a.id);

  return { subs, tallRows, ledger };
}

function zipStamp(date) {
  const yy = String(date.getFullYear() % 100).padStart(2, "0");
  return `${date.getMonth() + 1}-${date.getDate()}-${yy}`;
}

// Generates one AOIC log per submission, bundles them into a zip, and returns
// an updated ledger (merged, not mutated). Per spec §3/§8.
export async function generateLogs(submissions, ledger, initials) {
  const zip = new JSZip();
  const usedFilenames = new Map();
  const newEntries = [];
  const genWarnings = [];
  const now = new Date();
  const nowIso = now.toISOString();

  for (const sub of submissions) {
    const { workbook, filename, warnings } = generateIndividualLog(sub, sub.sessions);
    genWarnings.push(...warnings.map((w) => ({ ...w, submission_id: sub.id })));

    let finalName = filename;
    if (usedFilenames.has(filename)) {
      const n = usedFilenames.get(filename) + 1;
      usedFilenames.set(filename, n);
      finalName = filename.replace(/\.xlsx$/, `_${n}.xlsx`);
    } else {
      usedFilenames.set(filename, 1);
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    zip.file(finalName, arrayBuffer);

    const dates = Array.from(
      new Set(
        sub.sessions
          .map((r) => toJsDate(pyGet(r, "Date of Training", null)))
          .filter((d) => d !== null)
          .sort((a, b) => a.getTime() - b.getTime())
          .map(isoDate)
      )
    );

    newEntries.push(
      makeLedgerEntry({
        submissionId: sub.id,
        formYear: FORM_YEAR,
        firstName: sub.firstName,
        lastName: sub.lastName,
        label: sub.label,
        provider: sub.provider,
        dates,
        totalHours: sub.totalHours,
        filename: finalName,
        generatedAt: nowIso,
        generatedBy: initials
      })
    );
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const updatedLedger = mergeLedgers([
    ledger,
    { schema_version: "2.0", form_year: FORM_YEAR, updated: nowIso, updated_by: initials, entries: newEntries }
  ]);

  return {
    zipBlob,
    zipFilename: `AOIC_Logs_${zipStamp(now)}.zip`,
    updatedLedger,
    genWarnings
  };
}

export function buildTrackerRows(tallRows, subs) {
  const statusBySubmission = new Map(subs.map((s) => [s.id, s]));
  return tallRows.map((row) => {
    const sub = statusBySubmission.get(pyGet(row, "Submission ID", 0));
    return {
      ...row,
      "Conference/Label": sub ? sub.label : "",
      Date: pyGet(row, "Date of Training", null),
      Warnings: sub ? sub.warnings : [],
      "Ledger Status": sub ? sub.status.charAt(0).toUpperCase() + sub.status.slice(1) : "New"
    };
  });
}

export function exportTracker(tallRows, subs) {
  const rows = buildTrackerRows(tallRows, subs);
  return generateMasterTracker(rows, new Date());
}

export function markSent(ledger, key, updatedBy) {
  return markSentEntry(ledger, key, new Date().toISOString(), updatedBy);
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ledgerToBlob(ledger) {
  return new Blob([JSON.stringify(ledger, null, 2)], { type: "application/json" });
}

export function recomputeStatuses(subs, ledger) {
  return subs.map((sub) => {
    const status = getSubmissionStatus(ledger.entries, sub.key);
    const ledgerEntry = ledger.entries.find((e) => e.key === sub.key) || null;
    return { ...sub, status, ledgerEntry };
  });
}

export function statFor(subs) {
  const total = subs.length;
  const newCount = subs.filter((s) => s.status === "new").length;
  const generatedCount = subs.filter((s) => s.status === "generated" || s.status === "sent").length;
  const warningCount = subs.filter((s) => s.warnings.length > 0).length;
  return { total, newCount, generatedCount, warningCount };
}
