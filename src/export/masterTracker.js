// Master Tracker export (spec §7). Single-sheet xlsx built from the tall,
// unpivoted rows once ledger status has been merged in. Adds header
// fill/text-color styling that the old master_tracker.py defined as
// constants but never applied to header cells (docs/plans/f1-port-and-build.md).
import ExcelJS from "exceljs";
import { escapeFormula, AOIC_DATE_FORMAT } from "./aoicTemplate.js";
import { HEADER_BG_COLOR, HEADER_TEXT_COLOR, ALT_ROW_COLOR, WARNING_BG_COLOR } from "../shared/constants.js";
import { toJsDate } from "../shared/pyUtils.js";

const COLUMNS = [
  { header: "Last Name", key: "lastName" },
  { header: "First Name", key: "firstName" },
  { header: "Email", key: "email" },
  { header: "Conference/Label", key: "label" },
  { header: "Session Title", key: "sessionTitle" },
  { header: "Date", key: "date" },
  { header: "Credit Hours", key: "creditHours" },
  { header: "Original Hours Input", key: "originalHoursInput" },
  { header: "Submitted", key: "submitted" },
  { header: "Warnings", key: "warnings" },
  { header: "Ledger Status", key: "ledgerStatus" }
];

const CREDIT_HOURS_COL_INDEX = COLUMNS.findIndex((c) => c.key === "creditHours") + 1;
const WARNINGS_COL_INDEX = COLUMNS.findIndex((c) => c.key === "warnings") + 1;

const SENTINEL_DATE = new Date(0);

// The upstream grouping/label module (aoicIndividual) isn't built yet, so the
// exact key casing on incoming rows isn't locked. Pull each field through a
// short alias list rather than one hardcoded key, so this module keeps
// working once that contract settles.
function firstOf(row, keys, fallback = "") {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      const value = row[key];
      if (value !== undefined && value !== null && value !== "") return value;
    }
  }
  return fallback;
}

function toDate(value) {
  if (value === null || value === undefined || value === "") return null;
  return toJsDate(value);
}

function warningsText(rawWarnings) {
  if (Array.isArray(rawWarnings)) {
    return rawWarnings
      .map((w) => (typeof w === "string" ? w : w.warning_type || w.field || JSON.stringify(w)))
      .join("; ");
  }
  return rawWarnings || "";
}

function extractRow(row) {
  const rawWarnings = firstOf(row, ["Warnings", "warnings"], []);
  const dateRaw = firstOf(row, ["Date", "Date of Training", "date_of_training", "date"], null);

  return {
    lastName: firstOf(row, ["Last Name", "lastName", "last_name"]),
    firstName: firstOf(row, ["First Name", "firstName", "first_name"]),
    email: firstOf(row, ["Email", "email"]),
    label: firstOf(row, [
      "Conference/Label",
      "Label",
      "label",
      "Conference Name",
      "conference_name",
      "Provider",
      "provider"
    ]),
    sessionTitle: firstOf(row, ["Session Title", "sessionTitle", "session_title"]),
    date: toDate(dateRaw),
    creditHours: firstOf(row, ["Credit Hours", "creditHours", "credit_hours"], 0),
    originalHoursInput: firstOf(row, ["Original Hours Input", "originalHoursInput", "original_hours_input"]),
    submitted: firstOf(row, ["Submitted", "submitted"]),
    warnings: warningsText(rawWarnings),
    hasWarnings: Array.isArray(rawWarnings) ? rawWarnings.length > 0 : Boolean(rawWarnings),
    ledgerStatus: firstOf(row, ["Ledger Status", "ledgerStatus", "ledger_status"])
  };
}

function compareCaseInsensitive(a, b) {
  return String(a).toLowerCase().localeCompare(String(b).toLowerCase());
}

function sortRows(rows) {
  return [...rows].sort((a, b) => {
    const lastCmp = compareCaseInsensitive(a.lastName, b.lastName);
    if (lastCmp !== 0) return lastCmp;
    const labelCmp = compareCaseInsensitive(a.label, b.label);
    if (labelCmp !== 0) return labelCmp;
    const aDate = a.date ?? SENTINEL_DATE;
    const bDate = b.date ?? SENTINEL_DATE;
    return aDate.getTime() - bDate.getTime();
  });
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

export function generateMasterTracker(tallRowsWithLedgerStatus, runDate) {
  const rows = sortRows(tallRowsWithLedgerStatus.map(extractRow));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Office of Career Services";
  const worksheet = workbook.addWorksheet("Master Tracker");

  worksheet.addTable({
    name: "MasterTracker",
    ref: "A1",
    headerRow: true,
    totalsRow: false,
    style: { theme: "TableStyleMedium2", showRowStripes: true },
    columns: COLUMNS.map((c) => ({ name: escapeFormula(c.header) })),
    rows: rows.map((row) => [
      escapeFormula(row.lastName),
      escapeFormula(row.firstName),
      escapeFormula(row.email),
      escapeFormula(row.label),
      escapeFormula(row.sessionTitle),
      row.date ?? escapeFormula(""),
      typeof row.creditHours === "number" ? row.creditHours : escapeFormula(row.creditHours),
      escapeFormula(row.originalHoursInput),
      escapeFormula(row.submitted),
      escapeFormula(row.warnings),
      escapeFormula(row.ledgerStatus)
    ])
  });

  const headerRow = worksheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + HEADER_BG_COLOR } };
    cell.font = { color: { argb: "FF" + HEADER_TEXT_COLOR }, bold: true };
  });

  rows.forEach((row, i) => {
    const excelRow = worksheet.getRow(i + 2);

    excelRow.getCell(CREDIT_HOURS_COL_INDEX).numFmt = "0.00";
    if (row.date) {
      excelRow.getCell(COLUMNS.findIndex((c) => c.key === "date") + 1).numFmt = AOIC_DATE_FORMAT;
    }

    if (i % 2 === 1) {
      excelRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + ALT_ROW_COLOR } };
      });
    }

    if (row.hasWarnings) {
      excelRow.getCell(WARNINGS_COL_INDEX).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF" + WARNING_BG_COLOR }
      };
    }
  });

  worksheet.views = [{ state: "frozen", xSplit: 0, ySplit: 1 }];

  const runDateObj = runDate instanceof Date ? runDate : new Date(runDate);
  const stamp = `${runDateObj.getFullYear()}${pad2(runDateObj.getMonth() + 1)}${pad2(runDateObj.getDate())}`;
  const filename = `OCS_Master_Tracker_${stamp}.xlsx`;

  return { workbook, filename };
}
