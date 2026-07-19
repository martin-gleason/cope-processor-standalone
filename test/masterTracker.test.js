import test from "node:test";
import assert from "node:assert/strict";
import { generateMasterTracker } from "../src/export/masterTracker.js";
import { HEADER_BG_COLOR, HEADER_TEXT_COLOR, ALT_ROW_COLOR, WARNING_BG_COLOR } from "../src/shared/constants.js";

function excelSerial(isoDate) {
  return (new Date(isoDate).getTime() / 86400000) + 25569;
}

function row(overrides = {}) {
  return {
    "Last Name": "Junious",
    "First Name": "Victor",
    Email: "anonymous",
    "Conference/Label": "APPA Webinars",
    "Session Title": "APPA Presumptive Provider Webinar",
    "Date of Training": excelSerial("2026-06-09T00:00:00Z"),
    "Credit Hours": 1.5,
    "Original Hours Input": 1.5,
    Submitted: "2026-06-09T10:00:00",
    Warnings: [],
    "Ledger Status": "new",
    ...overrides
  };
}

test("Excel-serial dates are converted correctly, not treated as epoch milliseconds", () => {
  const { workbook } = generateMasterTracker([row()], new Date("2026-07-19"));
  const sheet = workbook.getWorksheet("Master Tracker");
  const dateCell = sheet.getCell("F2").value;
  assert.ok(dateCell instanceof Date, "date cell should be a Date");
  assert.equal(dateCell.getUTCFullYear(), 2026);
  assert.equal(dateCell.getUTCMonth(), 5);
  assert.equal(dateCell.getUTCDate(), 9);
});

test("header row has the spec-required fill and text color", () => {
  const { workbook } = generateMasterTracker([row()], new Date("2026-07-19"));
  const sheet = workbook.getWorksheet("Master Tracker");
  const headerCell = sheet.getCell("A1");
  assert.equal(headerCell.fill.fgColor.argb, "FF" + HEADER_BG_COLOR);
  assert.equal(headerCell.font.color.argb, "FF" + HEADER_TEXT_COLOR);
});

test("alternating rows and warning cells get the spec fills", () => {
  const rows = [
    row({ "Last Name": "Aaron", Warnings: [] }),
    row({ "Last Name": "Baker", Warnings: [{ warning_type: "ZERO_HOURS" }] })
  ];
  const { workbook } = generateMasterTracker(rows, new Date("2026-07-19"));
  const sheet = workbook.getWorksheet("Master Tracker");
  // sorted by last name ascending: Aaron (row 2), Baker (row 3, alt-striped, warning)
  const warningsColLetter = "J";
  assert.equal(sheet.getCell(`${warningsColLetter}3`).fill.fgColor.argb, "FF" + WARNING_BG_COLOR);
  assert.equal(sheet.getCell(`A3`).fill.fgColor.argb, "FF" + ALT_ROW_COLOR);
});

test("Credit Hours column uses 0.00 number format", () => {
  const { workbook } = generateMasterTracker([row()], new Date("2026-07-19"));
  const sheet = workbook.getWorksheet("Master Tracker");
  assert.equal(sheet.getCell("G2").numFmt, "0.00");
});

test("filename is stamped from the passed-in run date, not the current date", () => {
  const { filename } = generateMasterTracker([row()], new Date(2026, 0, 5));
  assert.equal(filename, "OCS_Master_Tracker_20260105.xlsx");
});

test("rows with no date sort before dated rows within the same name/label group", () => {
  const rows = [
    row({ "Last Name": "Smith", "Conference/Label": "X", "Date of Training": excelSerial("2026-03-01") }),
    row({ "Last Name": "Smith", "Conference/Label": "X", "Date of Training": "" })
  ];
  const { workbook } = generateMasterTracker(rows, new Date("2026-07-19"));
  const sheet = workbook.getWorksheet("Master Tracker");
  assert.equal(sheet.getCell("F2").value, "");
  assert.ok(sheet.getCell("F3").value instanceof Date);
});
