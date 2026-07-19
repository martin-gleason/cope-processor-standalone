// AOIC individual log export — one .xlsx per form submission.
// Ported/rewritten per docs/specs/cope-processor-spec.md §5-§6 and the locked
// deviations in docs/plans/f1-port-and-build.md: no cross-submission grouping,
// no continuation-form chunking (hard refusal past 14 sessions instead), new
// conference-label and filename rules.

import ExcelJS from "exceljs";
import {
  AOIC_FONT,
  AOIC_HEADER_FILL,
  AOIC_COL_A_WIDTH,
  AOIC_COL_B_WIDTH,
  AOIC_COL_C_WIDTH,
  AOIC_COL_D_WIDTH,
  AOIC_DATE_FORMAT,
  AOIC_SUM_FIRST_ROW,
  AOIC_SUM_LAST_ROW,
  AOIC_SUM_ROW,
  escapeFormula,
  sanitizeFilename
} from "./aoicTemplate.js";
import { MAX_SESSIONS_PER_SUBMISSION, WARNING_TYPES, makeWarning } from "../shared/constants.js";
import { pyGet, toJsDate } from "../shared/pyUtils.js";

const TITLE_TEXT = "Presumptive Provider Conference Credit Hours Verification";
const HEADER_TITLE = "Session Attended (List each session individually) ";
const HEADER_DATE = "Date";
const HEADER_HOURS = "Credit Hour(s) (per session) ";
const SINGLE_TRAINING_TYPE = "Single Training/Webinar";

function formatMDYYYY(date) {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

function formatMDYYFilename(date) {
  const yy = String(date.getFullYear() % 100).padStart(2, "0");
  return `${date.getMonth() + 1}-${date.getDate()}-${yy}`;
}

function styleCell(cell, { numFmt, fill, alignment } = {}) {
  cell.font = AOIC_FONT;
  if (numFmt) cell.numFmt = numFmt;
  if (fill) cell.fill = fill;
  if (alignment) cell.alignment = alignment;
}

export function generateIndividualLog(submission, tallRowsForSubmission) {
  if (!Array.isArray(tallRowsForSubmission) || tallRowsForSubmission.length === 0) {
    throw new Error("Cannot generate an AOIC log for a submission with no sessions.");
  }
  if (tallRowsForSubmission.length > MAX_SESSIONS_PER_SUBMISSION) {
    const sid = pyGet(submission, "ID", pyGet(tallRowsForSubmission[0], "Submission ID", "?"));
    throw new Error(
      `Submission ${sid} has ${tallRowsForSubmission.length} sessions, exceeding the ` +
        `${MAX_SESSIONS_PER_SUBMISSION}-session AOIC form. Refusing to generate a log for it — ` +
        "continuation-form chunking is not supported; split or correct the submission instead."
    );
  }

  const warnings = [];
  const first = tallRowsForSubmission[0];
  const sid = pyGet(first, "Submission ID", pyGet(submission, "ID", 0));
  const firstName = pyGet(first, "First Name", "") || pyGet(submission, "First Name", "");
  const lastName = pyGet(first, "Last Name", "") || pyGet(submission, "Last Name", "");
  const trainingType = pyGet(first, "Training Type", "");
  const conferenceName = pyGet(first, "Conference Name", "");
  const providerAcronym = pyGet(first, "Provider", "");
  const webinarLabel = `${providerAcronym} Webinars`;

  let label;
  if (trainingType === "Conference") {
    if (conferenceName) {
      label = conferenceName;
    } else {
      label = webinarLabel;
      warnings.push(makeWarning(sid, "Conference Name", "", label, WARNING_TYPES.MISSING_CONFERENCE));
    }
  } else {
    label = webinarLabel;
  }

  const sessionDates = tallRowsForSubmission
    .map((row) => toJsDate(pyGet(row, "Date of Training", null)))
    .filter((d) => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());

  const isSingle = trainingType === SINGLE_TRAINING_TYPE && tallRowsForSubmission.length === 1;
  const startDate = sessionDates[0] ?? null;
  const endDate = sessionDates[sessionDates.length - 1] ?? null;

  const datesStr =
    isSingle && startDate
      ? formatMDYYYY(startDate)
      : startDate && endDate
        ? `${formatMDYYYY(startDate)} - ${formatMDYYYY(endDate)}`
        : "";

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Office of Career Services";
  workbook.lastModifiedBy = "Office of Career Services";

  const sheet = workbook.addWorksheet("AOIC Log");
  sheet.getColumn(1).width = AOIC_COL_A_WIDTH;
  sheet.getColumn(2).width = AOIC_COL_B_WIDTH;
  sheet.getColumn(3).width = AOIC_COL_C_WIDTH;
  sheet.getColumn(4).width = AOIC_COL_D_WIDTH;

  sheet.mergeCells("A1:C1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = TITLE_TEXT;
  styleCell(titleCell, { alignment: { horizontal: "center", vertical: "middle" } });

  const a2 = sheet.getCell("A2");
  a2.value = escapeFormula(`Conference: ${label}`);
  styleCell(a2);

  const c2 = sheet.getCell("C2");
  c2.value = `Date(s): ${datesStr}`;
  styleCell(c2);

  const a3 = sheet.getCell("A3");
  a3.value = escapeFormula(`Name: ${firstName} ${lastName}`);
  styleCell(a3);

  const tableRows = [];
  for (let i = 0; i < MAX_SESSIONS_PER_SUBMISSION; i += 1) {
    const row = tallRowsForSubmission[i];
    if (!row) {
      tableRows.push(["", "", ""]);
      continue;
    }
    const title = escapeFormula(pyGet(row, "Session Title", ""));
    const rawDate = pyGet(row, "Date of Training", null);
    const date = toJsDate(rawDate) ?? rawDate ?? "";
    const hours = pyGet(row, "Credit Hours", 0);
    tableRows.push([title, date, hours]);
  }
  tableRows.push(["", "", { formula: `SUM(C${AOIC_SUM_FIRST_ROW}:C${AOIC_SUM_LAST_ROW})` }]);

  sheet.addTable({
    name: "Table1",
    ref: "A4:C19",
    headerRow: true,
    totalsRow: false,
    style: { theme: "TableStyleMedium2", showRowStripes: true },
    columns: [
      { name: HEADER_TITLE, filterButton: false },
      { name: HEADER_DATE, filterButton: false },
      { name: HEADER_HOURS, filterButton: false }
    ],
    rows: tableRows
  });

  ["A4", "B4", "C4"].forEach((ref) => {
    styleCell(sheet.getCell(ref), { fill: AOIC_HEADER_FILL });
  });

  for (let r = AOIC_SUM_FIRST_ROW; r <= AOIC_SUM_LAST_ROW; r += 1) {
    styleCell(sheet.getCell(`A${r}`));
    styleCell(sheet.getCell(`B${r}`), { numFmt: AOIC_DATE_FORMAT });
    styleCell(sheet.getCell(`C${r}`), { numFmt: "General" });
  }
  styleCell(sheet.getCell(`A${AOIC_SUM_ROW}`));
  styleCell(sheet.getCell(`B${AOIC_SUM_ROW}`));
  styleCell(sheet.getCell(`C${AOIC_SUM_ROW}`), { numFmt: "General" });

  const filenameDate = isSingle ? startDate : (startDate ?? endDate);
  const initial = firstName ? firstName.charAt(0).toUpperCase() : "";
  const sanitizedLast = sanitizeFilename(lastName || "");
  const datePart = filenameDate ? formatMDYYFilename(filenameDate) : "unknown-date";
  // Base filename only — collision suffixing (_2, _3, ...) across a batch is
  // the caller's responsibility, not this per-submission generator's.
  const filename = `${datePart}_presumed_provider_form_${initial}__${sanitizedLast}.xlsx`;

  return { workbook, filename, warnings };
}
