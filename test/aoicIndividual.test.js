import test from "node:test";
import assert from "node:assert/strict";
import { generateIndividualLog } from "../src/export/aoicIndividual.js";
import { AOIC_FONT, AOIC_HEADER_FILL } from "../src/export/aoicTemplate.js";
import { MAX_SESSIONS_PER_SUBMISSION } from "../src/shared/constants.js";

function baseTallRow(overrides = {}) {
  return {
    "Last Name": "Junious",
    "First Name": "Victor",
    Email: "anonymous",
    "Training Type": "Single Training/Webinar",
    "Conference Name": "",
    Provider: "APPA",
    "Session Title": "APPA Presumptive Provider Webinar",
    "Date of Training": new Date("2026-06-09T00:00:00"),
    "Credit Hours": 1.5,
    "Original Hours Input": 1.5,
    Submitted: "2026-06-09T10:00:00",
    "Submission ID": 17,
    ...overrides
  };
}

function victorSubmission() {
  return { ID: 17 };
}

test("font is Times New Roman 12pt, not bold, on title/label/header/data cells", () => {
  const { workbook } = generateIndividualLog(victorSubmission(), [baseTallRow()]);
  const sheet = workbook.getWorksheet("AOIC Log");
  for (const ref of ["A1", "A2", "C2", "A3", "A4", "B4", "C4", "A5", "B5", "C5", "C19"]) {
    assert.deepEqual(sheet.getCell(ref).font, AOIC_FONT, `font mismatch on ${ref}`);
  }
});

test("row 1 title is merged A1:C1 and centered", () => {
  const { workbook } = generateIndividualLog(victorSubmission(), [baseTallRow()]);
  const sheet = workbook.getWorksheet("AOIC Log");
  const a1 = sheet.getCell("A1");
  assert.equal(a1.value, "Presumptive Provider Conference Credit Hours Verification");
  assert.ok(sheet.getCell("A1").isMerged);
  assert.ok(sheet.getCell("B1").isMerged);
  assert.ok(sheet.getCell("C1").isMerged);
  assert.deepEqual(a1.alignment, { horizontal: "center", vertical: "middle" });
});

test("row 2 / row 3 carry the exact label strings", () => {
  const { workbook } = generateIndividualLog(victorSubmission(), [baseTallRow()]);
  const sheet = workbook.getWorksheet("AOIC Log");
  assert.equal(sheet.getCell("A2").value, "Conference: APPA Webinars");
  assert.equal(sheet.getCell("C2").value, "Date(s): 6/9/2026");
  assert.equal(sheet.getCell("A3").value, "Name: Victor Junious");
});

test("row 4 headers match exactly, including trailing spaces, with the header fill", () => {
  const { workbook } = generateIndividualLog(victorSubmission(), [baseTallRow()]);
  const sheet = workbook.getWorksheet("AOIC Log");
  assert.equal(sheet.getCell("A4").value, "Session Attended (List each session individually) ");
  assert.equal(sheet.getCell("B4").value, "Date");
  assert.equal(sheet.getCell("C4").value, "Credit Hour(s) (per session) ");
  for (const ref of ["A4", "B4", "C4"]) {
    assert.deepEqual(sheet.getCell(ref).fill, AOIC_HEADER_FILL, `fill mismatch on ${ref}`);
  }
});

test("row 19 carries the SUM(C5:C18) formula", () => {
  const { workbook } = generateIndividualLog(victorSubmission(), [baseTallRow()]);
  const sheet = workbook.getWorksheet("AOIC Log");
  assert.equal(sheet.getCell("C19").formula, "SUM(C5:C18)");
});

test("the Excel Table spans exactly A4:C19", () => {
  const { workbook } = generateIndividualLog(victorSubmission(), [baseTallRow()]);
  const sheet = workbook.getWorksheet("AOIC Log");
  assert.equal(sheet.getTable("Table1").table.ref, "A4:C19");
});

test("column widths match the template exactly", () => {
  const { workbook } = generateIndividualLog(victorSubmission(), [baseTallRow()]);
  const sheet = workbook.getWorksheet("AOIC Log");
  assert.equal(sheet.getColumn(1).width, 123.5);
  assert.equal(sheet.getColumn(2).width, 10.2);
  assert.equal(sheet.getColumn(3).width, 41.5);
  assert.equal(sheet.getColumn(4).width, 8.85);
});

test("data row: title/date/hours land correctly with m/d/yyyy date format", () => {
  const { workbook } = generateIndividualLog(victorSubmission(), [baseTallRow()]);
  const sheet = workbook.getWorksheet("AOIC Log");
  assert.equal(sheet.getCell("A5").value, "APPA Presumptive Provider Webinar");
  const dateCell = sheet.getCell("B5");
  assert.ok(dateCell.value instanceof Date);
  assert.equal(dateCell.value.getFullYear(), 2026);
  assert.equal(dateCell.value.getMonth(), 5);
  assert.equal(dateCell.value.getDate(), 9);
  assert.equal(dateCell.numFmt, "m/d/yyyy");
  assert.equal(sheet.getCell("C5").value, 1.5);
  assert.equal(sheet.getCell("C5").numFmt, "General");
});

test("spec §11.2 acceptance criterion: Victor Junious fixture produces the exact filename", () => {
  const { filename, warnings } = generateIndividualLog(victorSubmission(), [baseTallRow()]);
  assert.equal(filename, "6-9-26_presumed_provider_form_V__Junious.xlsx");
  assert.deepEqual(warnings, []);
});

test("a 3-session conference submission produces one log with a date range and correct SUM inputs", () => {
  const rows = [
    baseTallRow({
      "Training Type": "Conference",
      "Conference Name": "NCSC Annual Justice Conference",
      Provider: "NCSC",
      "Session Title": "Opening Plenary",
      "Date of Training": new Date("2026-04-10T00:00:00"),
      "Credit Hours": 1.5
    }),
    baseTallRow({
      "Training Type": "Conference",
      "Conference Name": "NCSC Annual Justice Conference",
      Provider: "NCSC",
      "Session Title": "Breakout: Data-Driven Supervision",
      "Date of Training": new Date("2026-04-11T00:00:00"),
      "Credit Hours": 2
    }),
    baseTallRow({
      "Training Type": "Conference",
      "Conference Name": "NCSC Annual Justice Conference",
      Provider: "NCSC",
      "Session Title": "Closing Session",
      "Date of Training": new Date("2026-04-12T00:00:00"),
      "Credit Hours": 1
    })
  ];
  const { workbook, filename } = generateIndividualLog({ ID: 42 }, rows);
  const sheet = workbook.getWorksheet("AOIC Log");

  assert.equal(sheet.getCell("A2").value, "Conference: NCSC Annual Justice Conference");
  assert.equal(sheet.getCell("C2").value, "Date(s): 4/10/2026 - 4/12/2026");
  assert.equal(sheet.getCell("A5").value, "Opening Plenary");
  assert.equal(sheet.getCell("B5").value.getDate(), 10);
  assert.equal(sheet.getCell("A6").value, "Breakout: Data-Driven Supervision");
  assert.equal(sheet.getCell("B6").value.getDate(), 11);
  assert.equal(sheet.getCell("A7").value, "Closing Session");
  assert.equal(sheet.getCell("B7").value.getDate(), 12);
  assert.equal(sheet.getCell("C19").formula, "SUM(C5:C18)");
  assert.equal(filename, "4-10-26_presumed_provider_form_V__Junious.xlsx");
});

test("a submission missing Conference Name on a Conference-type row falls back to the provider label with a warning", () => {
  const rows = [
    baseTallRow({
      "Training Type": "Conference",
      "Conference Name": "",
      Provider: "AOIC"
    })
  ];
  const { workbook, warnings } = generateIndividualLog({ ID: 99 }, rows);
  const sheet = workbook.getWorksheet("AOIC Log");
  assert.equal(sheet.getCell("A2").value, "Conference: AOIC Webinars");
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].warning_type, "MISSING_CONFERENCE");
});

test("more than 14 sessions on one submission is a hard refusal, not continuation-form chunking", () => {
  const rows = Array.from({ length: MAX_SESSIONS_PER_SUBMISSION + 1 }, (_, i) =>
    baseTallRow({ "Session Title": `Session ${i + 1}` })
  );
  assert.throws(
    () => generateIndividualLog(victorSubmission(), rows),
    (err) => {
      assert.match(err.message, /15 sessions/);
      assert.match(err.message, /14-session/);
      return true;
    }
  );
});

test("exactly 14 sessions is accepted (the boundary is inclusive)", () => {
  const rows = Array.from({ length: MAX_SESSIONS_PER_SUBMISSION }, (_, i) =>
    baseTallRow({ "Session Title": `Session ${i + 1}` })
  );
  assert.doesNotThrow(() => generateIndividualLog(victorSubmission(), rows));
});

test("a session title beginning with '=' lands in the xlsx as inert, escaped text", () => {
  const rows = [baseTallRow({ "Session Title": "=cmd|'/c calc'!A1" })];
  const { workbook } = generateIndividualLog(victorSubmission(), rows);
  const sheet = workbook.getWorksheet("AOIC Log");
  const cellValue = sheet.getCell("A5").value;
  assert.equal(typeof cellValue, "string");
  assert.equal(cellValue[0], "'");
  assert.equal(cellValue, "'=cmd|'/c calc'!A1");
});

test("session titles beginning with +, -, @, tab, or CR are all escaped", () => {
  for (const trigger of ["+SUM(A1)", "-1+1", "@SUM(A1)", "\tinjected", "\rinjected"]) {
    const rows = [baseTallRow({ "Session Title": trigger })];
    const { workbook } = generateIndividualLog(victorSubmission(), rows);
    const cellValue = workbook.getWorksheet("AOIC Log").getCell("A5").value;
    assert.equal(cellValue[0], "'", `expected ${JSON.stringify(trigger)} to be escaped`);
  }
});

test("generateIndividualLog refuses a submission with zero sessions", () => {
  assert.throws(() => generateIndividualLog(victorSubmission(), []), /no sessions/);
});
