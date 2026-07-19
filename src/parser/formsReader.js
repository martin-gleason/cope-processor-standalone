import { read as readWorkbook, utils as xlsxUtils } from "xlsx";
import {
  SESSION_TITLE_BASE,
  DATE_OF_TRAINING_BASE,
  CREDIT_HOURS_BASE,
  LAST_SESSION_BASE,
  TRAINING_TYPE_COL,
  PROVIDER_COL,
  MAX_FORM_ROWS,
  MAX_FORM_COLS
} from "../shared/constants.js";

export class InvalidFormatError extends Error {
  constructor(message) {
    super(message);
    this.name = "InvalidFormatError";
  }
}

const REQUIRED_HEADERS = [
  "ID",
  "Email",
  "First Name",
  "Last Name",
  "Date of Conference or Training",
  TRAINING_TYPE_COL,
  PROVIDER_COL
];

export function detectSessionColumns(headers) {
  const headerSet = new Set(headers);
  const sessions = [];

  if (headerSet.has(SESSION_TITLE_BASE) && headerSet.has(CREDIT_HOURS_BASE)) {
    sessions.push({
      title: SESSION_TITLE_BASE,
      date: headerSet.has(DATE_OF_TRAINING_BASE) ? DATE_OF_TRAINING_BASE : null,
      hours: CREDIT_HOURS_BASE,
      last: headerSet.has(LAST_SESSION_BASE) ? LAST_SESSION_BASE : null
    });
  }

  let n = 2;
  while (headerSet.has(`${SESSION_TITLE_BASE}${n}`)) {
    const title = `${SESSION_TITLE_BASE}${n}`;
    const date = `${DATE_OF_TRAINING_BASE}${n}`;
    const hours = `${CREDIT_HOURS_BASE}${n}`;
    const last = `${LAST_SESSION_BASE}${n}`;
    sessions.push({
      title,
      date: headerSet.has(date) ? date : null,
      hours,
      last: headerSet.has(last) ? last : null
    });
    n += 1;
  }

  return sessions;
}

function checkHeaderWidth(headers) {
  if (headers.length > MAX_FORM_COLS) {
    throw new InvalidFormatError(
      `File has ${headers.length} columns, exceeding the ${MAX_FORM_COLS}-column ` +
        "limit. This does not look like an MS Forms COPE export."
    );
  }
}

export function validateFormsExport(headers) {
  checkHeaderWidth(headers);

  const headerSet = new Set(headers.filter((h) => h !== null && h !== undefined && h !== ""));
  const missing = REQUIRED_HEADERS.filter((h) => !headerSet.has(h));
  if (missing.length > 0) {
    throw new InvalidFormatError(
      "This file is missing required columns:\n  - " +
        missing.join("\n  - ") +
        "\n\nThis does not look like an MS Forms COPE export."
    );
  }

  if (detectSessionColumns(headers).length === 0) {
    throw new InvalidFormatError(
      `No session columns found ('${SESSION_TITLE_BASE}' / '${CREDIT_HOURS_BASE}').`
    );
  }
}

async function toWorkbookInput(fileData) {
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(fileData)) {
    return { data: fileData, type: "buffer" };
  }
  if (typeof File !== "undefined" && fileData instanceof File) {
    const buffer = await fileData.arrayBuffer();
    return { data: new Uint8Array(buffer), type: "array" };
  }
  if (fileData instanceof ArrayBuffer) {
    return { data: new Uint8Array(fileData), type: "array" };
  }
  if (fileData instanceof Uint8Array) {
    return { data: fileData, type: "array" };
  }
  throw new InvalidFormatError(
    "Unsupported input: expected an ArrayBuffer, File, Uint8Array, or Node Buffer."
  );
}

function recalculateSheetRange(sheet) {
  const range = { s: { r: Infinity, c: Infinity }, e: { r: -1, c: -1 } };
  for (const key in sheet) {
    if (key[0] === "!") continue;
    const cell = xlsxUtils.decode_cell(key);
    if (cell.r < range.s.r) range.s.r = cell.r;
    if (cell.c < range.s.c) range.s.c = cell.c;
    if (cell.r > range.e.r) range.e.r = cell.r;
    if (cell.c > range.e.c) range.e.c = cell.c;
  }
  if (range.e.r === -1) return sheet;
  sheet["!ref"] = xlsxUtils.encode_range(range);
  return sheet;
}

export async function readFormsExport(fileData) {
  const { data, type } = await toWorkbookInput(fileData);
  const workbook = readWorkbook(data, { type, cellDates: false, raw: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  recalculateSheetRange(sheet);

  const rowsAoa = xlsxUtils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    blankrows: true,
    raw: true
  });

  if (rowsAoa.length === 0) {
    throw new InvalidFormatError("File is empty.");
  }

  const headers = rowsAoa[0];
  checkHeaderWidth(headers);

  const validIndices = [];
  headers.forEach((h, i) => {
    if (h !== null && h !== undefined && h !== "") validIndices.push([i, h]);
  });

  const rows = [];
  for (let scanned = 1; scanned < rowsAoa.length; scanned += 1) {
    if (scanned > MAX_FORM_ROWS) {
      throw new InvalidFormatError(
        `File exceeds the ${MAX_FORM_ROWS.toLocaleString()}-row limit. This does not ` +
          "look like an MS Forms COPE export."
      );
    }
    const excelRow = rowsAoa[scanned];
    const rowDict = {};
    let hasValue = false;
    for (const [i, h] of validIndices) {
      const v = i < excelRow.length ? excelRow[i] : null;
      rowDict[h] = v === undefined ? null : v;
      if (rowDict[h] !== null) hasValue = true;
    }
    if (hasValue) rows.push(rowDict);
  }

  return { headers, rows };
}
