import test from "node:test";
import assert from "node:assert/strict";
import {
  readFormsExport,
  validateFormsExport,
  detectSessionColumns,
  InvalidFormatError
} from "../src/parser/formsReader.js";
import {
  SESSION_TITLE_BASE,
  DATE_OF_TRAINING_BASE,
  CREDIT_HOURS_BASE,
  LAST_SESSION_BASE,
  TRAINING_TYPE_COL,
  PROVIDER_COL,
  MAX_FORM_ROWS,
  MAX_FORM_COLS
} from "../src/shared/constants.js";
import {
  buildHeaders,
  buildWorkbookBuffer,
  buildOversizedColumnWorkbookBuffer,
  buildOversizedRowWorkbookBuffer,
  victorJuniousRow,
  conferenceRow
} from "./fixtures/buildSyntheticExport.js";

test("detectSessionColumns finds all 7 stock session groups with correct column keys", () => {
  const headers = buildHeaders(7);
  const sessions = detectSessionColumns(headers);
  assert.equal(sessions.length, 7);

  assert.deepEqual(sessions[0], {
    title: SESSION_TITLE_BASE,
    date: DATE_OF_TRAINING_BASE,
    hours: CREDIT_HOURS_BASE,
    last: LAST_SESSION_BASE
  });

  assert.deepEqual(sessions[1], {
    title: `${SESSION_TITLE_BASE}2`,
    date: `${DATE_OF_TRAINING_BASE}2`,
    hours: `${CREDIT_HOURS_BASE}2`,
    last: `${LAST_SESSION_BASE}2`
  });

  // Spec §4: session 7 has no last-session flag column.
  assert.deepEqual(sessions[6], {
    title: `${SESSION_TITLE_BASE}7`,
    date: `${DATE_OF_TRAINING_BASE}7`,
    hours: `${CREDIT_HOURS_BASE}7`,
    last: null
  });
});

test("detectSessionColumns auto-detects session groups beyond the hardcoded 7 (spec §4)", () => {
  const headers = buildHeaders(9);
  const sessions = detectSessionColumns(headers);
  assert.equal(sessions.length, 9);
  assert.deepEqual(sessions[7], {
    title: `${SESSION_TITLE_BASE}8`,
    date: `${DATE_OF_TRAINING_BASE}8`,
    hours: `${CREDIT_HOURS_BASE}8`,
    last: `${LAST_SESSION_BASE}8`
  });
  assert.deepEqual(sessions[8], {
    title: `${SESSION_TITLE_BASE}9`,
    date: `${DATE_OF_TRAINING_BASE}9`,
    hours: `${CREDIT_HOURS_BASE}9`,
    last: `${LAST_SESSION_BASE}9`
  });
});

test("detectSessionColumns stops cleanly when a group is missing (no gap-jumping)", () => {
  const headers = buildHeaders(3).filter((h) => h !== `${SESSION_TITLE_BASE}2`);
  const sessions = detectSessionColumns(headers);
  // Session 1 present; scanning for suffix 2 stops at the first missing title,
  // so session 3's columns (though present in the header list) are never reached.
  assert.equal(sessions.length, 1);
});

test("validateFormsExport passes on a full 2026-2027 header row", () => {
  const headers = buildHeaders(7);
  assert.doesNotThrow(() => validateFormsExport(headers));
});

test("validateFormsExport names every missing required header", () => {
  const headers = buildHeaders(7).filter(
    (h) => h !== "Email" && h !== "Last Name" && h !== TRAINING_TYPE_COL
  );
  assert.throws(
    () => validateFormsExport(headers),
    (err) => {
      assert.ok(err instanceof InvalidFormatError);
      assert.match(err.message, /Email/);
      assert.match(err.message, /Last Name/);
      assert.match(err.message, /Is this a single training/);
      return true;
    }
  );
});

test("validateFormsExport rejects a header row with no session columns at all", () => {
  const headers = buildHeaders(0);
  assert.throws(() => validateFormsExport(headers), InvalidFormatError);
});

test("validateFormsExport rejects the old Conference-or-Training-Name schema shape (missing provider column)", () => {
  const headers = buildHeaders(7).filter((h) => h !== PROVIDER_COL);
  assert.throws(
    () => validateFormsExport(headers),
    (err) => {
      assert.match(err.message, /Please indicate who provided the training/);
      return true;
    }
  );
});

test("readFormsExport round-trips a single-training submission built via ExcelJS", async () => {
  const buffer = await buildWorkbookBuffer([victorJuniousRow(17)]);
  const { headers, rows } = await readFormsExport(buffer);

  validateFormsExport(headers);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].ID, 17);
  assert.equal(rows[0]["First Name"], "Victor");
  assert.equal(rows[0]["Last Name"], "Junious");
  assert.equal(rows[0][TRAINING_TYPE_COL], "Single Training/Webinar");
  assert.equal(rows[0][PROVIDER_COL], "APPA: American Probation and Parole Association");
  assert.equal(rows[0][CREDIT_HOURS_BASE], 1.5);
});

test("readFormsExport round-trips a 3-session conference submission built via ExcelJS", async () => {
  const buffer = await buildWorkbookBuffer([conferenceRow(42)]);
  const { headers, rows } = await readFormsExport(buffer);

  validateFormsExport(headers);
  const sessions = detectSessionColumns(headers);
  assert.equal(rows.length, 1);
  const row = rows[0];
  assert.equal(row["Conference Name"], "NCSC Annual Justice Conference");

  const titles = sessions.map((s) => row[s.title]).filter((v) => v !== null && v !== "");
  assert.equal(titles.length, 3);
  assert.deepEqual(titles, ["Opening Plenary", "Breakout: Data-Driven Supervision", "Closing Session"]);
});

test("readFormsExport skips fully-blank rows but keeps rows with any value", async () => {
  const rowWithData = victorJuniousRow(1);
  // A row with no keys at all maps every header to null via buildWorkbookBuffer
  // (as opposed to explicit empty strings, which xlsx round-trips as real,
  // non-null cell values and would therefore count as "has a value").
  const blankRow = {};
  const buffer = await buildWorkbookBuffer([rowWithData, blankRow]);
  const { rows } = await readFormsExport(buffer);
  assert.equal(rows.length, 1);
});

test("readFormsExport rejects an empty file", async () => {
  // A worksheet with zero rows and no dimension at all — ExcelJS always
  // writes a placeholder dimension even for an "empty" sheet, so this needs
  // the lower-level xlsx (SheetJS) writer to produce a genuinely empty one.
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([]);
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  await assert.rejects(() => readFormsExport(buffer), InvalidFormatError);
});

test("readFormsExport enforces the column decompression-bomb guard", async () => {
  const buffer = await buildOversizedColumnWorkbookBuffer(MAX_FORM_COLS + 1);
  await assert.rejects(
    () => readFormsExport(buffer),
    (err) => {
      assert.ok(err instanceof InvalidFormatError);
      assert.match(err.message, new RegExp(`${MAX_FORM_COLS}-column`));
      return true;
    }
  );
});

test("readFormsExport enforces the row decompression-bomb guard", async () => {
  const buffer = await buildOversizedRowWorkbookBuffer(MAX_FORM_ROWS + 1);
  await assert.rejects(
    () => readFormsExport(buffer),
    (err) => {
      assert.ok(err instanceof InvalidFormatError);
      assert.match(err.message, /row limit/);
      return true;
    }
  );
});

test("readFormsExport accepts a file right at the row/column limits", async () => {
  const buffer = await buildOversizedRowWorkbookBuffer(MAX_FORM_ROWS);
  const { rows } = await readFormsExport(buffer);
  // Only the header row + one sparse populated row exist; nothing to reject.
  assert.ok(Array.isArray(rows));
});

test("readFormsExport resets bad MS-Forms sheet dimension metadata before scanning", async () => {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sheet1");
  sheet.addRow(["ID", "First Name"]);
  sheet.addRow([1, "Victor"]);
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Corrupt the declared dimension the way MS Forms exports do, by patching
  // the raw zip's sheet1.xml <dimension ref="..."/> to claim far more rows
  // than actually exist. formsReader must recompute the real range itself.
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);
  const sheetPath = "xl/worksheets/sheet1.xml";
  const xml = await zip.file(sheetPath).async("string");
  const corrupted = xml.replace(/<dimension ref="[^"]*"\/>/, '<dimension ref="A1:ZZ99999"/>');
  zip.file(sheetPath, corrupted);
  const corruptedBuffer = await zip.generateAsync({ type: "nodebuffer" });

  const { rows } = await readFormsExport(corruptedBuffer);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]["First Name"], "Victor");
});

test("readFormsExport accepts a Buffer, a Uint8Array, and an ArrayBuffer identically", async () => {
  const buffer = await buildWorkbookBuffer([victorJuniousRow(17)]);
  const fromBuffer = await readFormsExport(buffer);
  const fromUint8 = await readFormsExport(new Uint8Array(buffer));
  const fromArrayBuffer = await readFormsExport(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  );
  assert.deepEqual(fromBuffer.rows, fromUint8.rows);
  assert.deepEqual(fromBuffer.rows, fromArrayBuffer.rows);
});
