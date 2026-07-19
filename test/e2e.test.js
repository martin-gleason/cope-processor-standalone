// One true end-to-end fixture: synthetic .xlsx (built via ExcelJS in
// test/fixtures/buildSyntheticExport.js) -> formsReader -> sessionUnpivot ->
// aoicIndividual, exercising the full port pipeline the way an operator's
// real Forms export would run through it. Spec §11.2/§11.3 acceptance
// criteria: Victor Junious byte-equivalent-in-substance replica, and a
// 3-session conference producing one log with a correct date range and SUM.
import test from "node:test";
import assert from "node:assert/strict";
import { readFormsExport, validateFormsExport, detectSessionColumns } from "../src/parser/formsReader.js";
import { unpivotSessions } from "../src/parser/sessionUnpivot.js";
import { generateIndividualLog } from "../src/export/aoicIndividual.js";
import { buildWorkbookBuffer, victorJuniousRow, conferenceRow } from "./fixtures/buildSyntheticExport.js";

// detectSessionColumns() (formsReader.js) returns { title, date, hours, last }
// per session group; unpivotSessions() (sessionUnpivot.js) reads
// col.titleCol / col.dateCol / col.hoursCol. Mirror pipeline.js's
// toUnpivotSessionCols() normalization here so this fixture exercises the
// pipeline the same way the real UI glue does.
function toUnpivotSessionCols(sessionCols) {
  return sessionCols.map((c) => ({ titleCol: c.title, dateCol: c.date, hoursCol: c.hours, lastCol: c.last }));
}

async function runPipeline(rows) {
  const buffer = await buildWorkbookBuffer(rows);
  const { headers, rows: parsedRows } = await readFormsExport(buffer);
  validateFormsExport(headers);
  const sessionCols = detectSessionColumns(headers);
  const [tallRows, warnings] = unpivotSessions(parsedRows, toUnpivotSessionCols(sessionCols));
  return { tallRows, warnings };
}

function groupBySubmission(tallRows) {
  const bySubmission = new Map();
  for (const row of tallRows) {
    const sid = row["Submission ID"];
    if (!bySubmission.has(sid)) bySubmission.set(sid, []);
    bySubmission.get(sid).push(row);
  }
  return bySubmission;
}

test("spec §11.2: Victor Junious's raw form row survives the full pipeline as a byte-equivalent-in-substance replica", async () => {
  const { tallRows, warnings } = await runPipeline([victorJuniousRow(17)]);

  assert.equal(warnings.length, 0);
  assert.equal(tallRows.length, 1, "unpivot must produce exactly one tall row for one single-training session");

  const bySubmission = groupBySubmission(tallRows);
  assert.equal(bySubmission.size, 1);
  const [sessionsForSubmission] = bySubmission.values();

  const { filename, workbook, warnings: logWarnings } = generateIndividualLog({ ID: 17 }, sessionsForSubmission);
  assert.deepEqual(logWarnings, []);
  assert.equal(filename, "6-9-26_presumed_provider_form_V__Junious.xlsx");

  const sheet = workbook.getWorksheet("AOIC Log");
  assert.equal(sheet.getCell("A2").value, "Conference: APPA Webinars");
  assert.equal(sheet.getCell("C2").value, "Date(s): 6/9/2026");
  assert.equal(sheet.getCell("A3").value, "Name: Victor Junious");
  assert.equal(sheet.getCell("A5").value, "APPA Presumptive Provider Webinar");
  assert.ok(sheet.getCell("B5").value instanceof Date);
  assert.equal(sheet.getCell("B5").value.getFullYear(), 2026);
  assert.equal(sheet.getCell("B5").value.getMonth(), 5);
  assert.equal(sheet.getCell("B5").value.getDate(), 9);
  assert.equal(sheet.getCell("C5").value, 1.5);
  assert.equal(sheet.getCell("C19").formula, "SUM(C5:C18)");
  assert.equal(sheet.getTable("Table1").table.ref, "A4:C19");
});

test("spec §11.3: a 3-session conference submission produces exactly one log with a m/d/yyyy - m/d/yyyy date range", async () => {
  const { tallRows, warnings } = await runPipeline([conferenceRow(42)]);

  assert.equal(warnings.length, 0);
  assert.equal(tallRows.length, 3, "unpivot must produce one tall row per non-empty session");

  const bySubmission = groupBySubmission(tallRows);
  assert.equal(bySubmission.size, 1, "one AOIC log per submission — not grouped across submissions");
  const [sessionsForSubmission] = bySubmission.values();

  const { filename, workbook } = generateIndividualLog({ ID: 42 }, sessionsForSubmission);
  assert.equal(filename, "4-10-26_presumed_provider_form_P__Rivera.xlsx");

  const sheet = workbook.getWorksheet("AOIC Log");
  assert.equal(sheet.getCell("A2").value, "Conference: NCSC Annual Justice Conference");
  assert.equal(sheet.getCell("C2").value, "Date(s): 4/10/2026 - 4/12/2026");
  assert.equal(sheet.getCell("A5").value, "Opening Plenary");
  assert.equal(sheet.getCell("A6").value, "Breakout: Data-Driven Supervision");
  assert.equal(sheet.getCell("A7").value, "Closing Session");
  assert.equal(sheet.getCell("C19").formula, "SUM(C5:C18)");
});

test("spec §11.4-shaped: a batch of both fixture rows produces two independent logs, not one merged log", async () => {
  const { tallRows } = await runPipeline([victorJuniousRow(17), conferenceRow(42)]);
  const bySubmission = groupBySubmission(tallRows);
  assert.equal(bySubmission.size, 2);

  const filenames = [];
  for (const [sid, sessions] of bySubmission) {
    const { filename } = generateIndividualLog({ ID: sid }, sessions);
    filenames.push(filename);
  }
  filenames.sort();
  assert.deepEqual(filenames, [
    "4-10-26_presumed_provider_form_P__Rivera.xlsx",
    "6-9-26_presumed_provider_form_V__Junious.xlsx"
  ]);
});
