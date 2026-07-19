import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { validateRow, findDuplicates, checkEarlyCompletion } from "../src/shared/validators.js";
import { WARNING_TYPES } from "../src/shared/constants.js";

function isoDate(y, m, d) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

describe("validateRow — missing first name", () => {
  test("falls back to the email prefix and mutates the row", () => {
    const row = {
      "Submission ID": 5,
      "First Name": "",
      "Last Name": "Junious",
      Email: "victor.junious@example.org",
      "Training Type": "Single Training/Webinar",
      Provider: "APPA",
      "Credit Hours": 1.5,
      "Date of Training": "2026-06-09"
    };
    const warnings = validateRow(row);

    assert.equal(row["First Name"], "victor.junious");

    const warning = warnings.find((w) => w.warning_type === WARNING_TYPES.MISSING_NAME && w.field === "First Name");
    assert.ok(warning, "expected a MISSING_NAME warning for First Name");
    assert.equal(warning.parsed_value, "victor.junious");
    assert.equal(warning.raw_value, "");
    assert.equal(warning.submission_id, 5);
  });

  test("email without an '@' leaves the name unset and the warning reflects that", () => {
    const row = {
      "Submission ID": 6,
      "First Name": "",
      "Last Name": "Junious",
      Email: "anonymous",
      "Training Type": "Single Training/Webinar",
      Provider: "APPA",
      "Credit Hours": 1,
      "Date of Training": "2026-06-09"
    };
    const warnings = validateRow(row);

    assert.equal(row["First Name"], "");
    const warning = warnings.find((w) => w.warning_type === WARNING_TYPES.MISSING_NAME && w.field === "First Name");
    assert.ok(warning);
    assert.equal(warning.parsed_value, "");
  });

  test("present first name produces no MISSING_NAME warning for First Name", () => {
    const row = {
      "Submission ID": 7,
      "First Name": "Victor",
      "Last Name": "Junious",
      Email: "victor@example.org",
      "Training Type": "Single Training/Webinar",
      Provider: "APPA",
      "Credit Hours": 1,
      "Date of Training": "2026-06-09"
    };
    const warnings = validateRow(row);
    assert.ok(!warnings.some((w) => w.warning_type === WARNING_TYPES.MISSING_NAME && w.field === "First Name"));
  });
});

describe("validateRow — missing last name", () => {
  test("blank last name produces a MISSING_NAME warning for Last Name", () => {
    const row = {
      "Submission ID": 8,
      "First Name": "Victor",
      "Last Name": "",
      Email: "victor@example.org",
      "Training Type": "Single Training/Webinar",
      Provider: "APPA",
      "Credit Hours": 1,
      "Date of Training": "2026-06-09"
    };
    const warnings = validateRow(row);
    const warning = warnings.find((w) => w.warning_type === WARNING_TYPES.MISSING_NAME && w.field === "Last Name");
    assert.ok(warning);
    assert.equal(warning.raw_value, "");
    assert.equal(warning.parsed_value, "");
  });
});

describe("validateRow — missing conference / provider label", () => {
  test("Conference-type row with blank Conference Name warns MISSING_CONFERENCE on Conference Name", () => {
    const row = {
      "Submission ID": 9,
      "First Name": "Victor",
      "Last Name": "Junious",
      Email: "victor@example.org",
      "Training Type": "Conference",
      "Conference Name": "",
      Provider: "APPA",
      "Credit Hours": 1,
      "Date of Training": "2026-06-09"
    };
    const warnings = validateRow(row);
    const warning = warnings.find((w) => w.warning_type === WARNING_TYPES.MISSING_CONFERENCE);
    assert.ok(warning);
    assert.equal(warning.field, "Conference Name");
  });

  test("non-Conference row with blank Provider warns MISSING_CONFERENCE on Provider", () => {
    const row = {
      "Submission ID": 10,
      "First Name": "Victor",
      "Last Name": "Junious",
      Email: "victor@example.org",
      "Training Type": "Single Training/Webinar",
      Provider: "",
      "Credit Hours": 1,
      "Date of Training": "2026-06-09"
    };
    const warnings = validateRow(row);
    const warning = warnings.find((w) => w.warning_type === WARNING_TYPES.MISSING_CONFERENCE);
    assert.ok(warning);
    assert.equal(warning.field, "Provider");
  });

  test("Conference-type row with a Conference Name present produces no MISSING_CONFERENCE warning", () => {
    const row = {
      "Submission ID": 11,
      "First Name": "Victor",
      "Last Name": "Junious",
      Email: "victor@example.org",
      "Training Type": "Conference",
      "Conference Name": "Annual Symposium",
      Provider: "",
      "Credit Hours": 1,
      "Date of Training": "2026-06-09"
    };
    const warnings = validateRow(row);
    assert.ok(!warnings.some((w) => w.warning_type === WARNING_TYPES.MISSING_CONFERENCE));
  });
});

describe("validateRow — zero hours", () => {
  test("zero Credit Hours produces a ZERO_HOURS warning carrying the original raw input", () => {
    const row = {
      "Submission ID": 12,
      "First Name": "Victor",
      "Last Name": "Junious",
      Email: "victor@example.org",
      "Training Type": "Single Training/Webinar",
      Provider: "APPA",
      "Credit Hours": 0,
      "Original Hours Input": "banana",
      "Date of Training": "2026-06-09"
    };
    const warnings = validateRow(row);
    const warning = warnings.find((w) => w.warning_type === WARNING_TYPES.ZERO_HOURS);
    assert.ok(warning);
    assert.equal(warning.raw_value, "banana");
    assert.equal(warning.parsed_value, 0.0);
  });

  test("nonzero Credit Hours produces no ZERO_HOURS warning", () => {
    const row = {
      "Submission ID": 13,
      "First Name": "Victor",
      "Last Name": "Junious",
      Email: "victor@example.org",
      "Training Type": "Single Training/Webinar",
      Provider: "APPA",
      "Credit Hours": 1.5,
      "Date of Training": "2026-06-09"
    };
    const warnings = validateRow(row);
    assert.ok(!warnings.some((w) => w.warning_type === WARNING_TYPES.ZERO_HOURS));
  });
});

describe("validateRow — missing date", () => {
  test("blank Date of Training produces a MISSING_DATE warning", () => {
    const row = {
      "Submission ID": 14,
      "First Name": "Victor",
      "Last Name": "Junious",
      Email: "victor@example.org",
      "Training Type": "Single Training/Webinar",
      Provider: "APPA",
      "Credit Hours": 1,
      "Date of Training": ""
    };
    const warnings = validateRow(row);
    assert.ok(warnings.some((w) => w.warning_type === WARNING_TYPES.MISSING_DATE));
  });

  test("present Date of Training produces no MISSING_DATE warning", () => {
    const row = {
      "Submission ID": 15,
      "First Name": "Victor",
      "Last Name": "Junious",
      Email: "victor@example.org",
      "Training Type": "Single Training/Webinar",
      Provider: "APPA",
      "Credit Hours": 1,
      "Date of Training": "2026-06-09"
    };
    const warnings = validateRow(row);
    assert.ok(!warnings.some((w) => w.warning_type === WARNING_TYPES.MISSING_DATE));
  });
});

describe("findDuplicates", () => {
  test("first occurrence of a person+label+session combo is not warned", () => {
    const rows = [
      {
        "Submission ID": 1,
        "First Name": "Victor",
        "Last Name": "Junious",
        "Conference Name": "",
        Provider: "APPA",
        "Session Title": "Webinar A"
      }
    ];
    const warnings = findDuplicates(rows);
    assert.deepEqual(warnings, []);
  });

  test("subsequent occurrence is flagged POSSIBLE_DUPLICATE with the correct row index", () => {
    const rows = [
      {
        "Submission ID": 1,
        "First Name": "Victor",
        "Last Name": "Junious",
        "Conference Name": "",
        Provider: "APPA",
        "Session Title": "Webinar A"
      },
      {
        "Submission ID": 2,
        "First Name": "victor",
        "Last Name": "junious",
        "Conference Name": "",
        Provider: "appa",
        "Session Title": "webinar a"
      },
      {
        "Submission ID": 3,
        "First Name": "Victor",
        "Last Name": "Junious",
        "Conference Name": "",
        Provider: "APPA",
        "Session Title": "Webinar A"
      }
    ];
    const warnings = findDuplicates(rows);
    assert.equal(warnings.length, 2);

    assert.equal(warnings[0].warning_type, WARNING_TYPES.POSSIBLE_DUPLICATE);
    assert.equal(warnings[0].submission_id, 2);
    assert.equal(warnings[0].raw_value, "webinar a");
    assert.equal(warnings[0].parsed_value, "Duplicate of row 0");

    assert.equal(warnings[1].submission_id, 3);
    assert.equal(warnings[1].parsed_value, "Duplicate of row 0");
  });

  test("Conference Name takes precedence over Provider for the dedupe key", () => {
    const rows = [
      {
        "Submission ID": 1,
        "First Name": "Victor",
        "Last Name": "Junious",
        "Conference Name": "Annual Symposium",
        Provider: "APPA",
        "Session Title": "Day 1"
      },
      {
        "Submission ID": 2,
        "First Name": "Victor",
        "Last Name": "Junious",
        "Conference Name": "Annual Symposium",
        Provider: "AOIC",
        "Session Title": "Day 1"
      }
    ];
    const warnings = findDuplicates(rows);
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].submission_id, 2);
  });
});

describe("checkEarlyCompletion — header date", () => {
  test("form completed before the header training date warns EARLY_COMPLETION with ISO dates in the message", () => {
    const completion = new Date(2026, 4, 1);
    const training = new Date(2026, 5, 9);
    const wideRow = {
      ID: 20,
      "Completion time": completion,
      "Date of Conference or Training": training
    };
    const warnings = checkEarlyCompletion(wideRow, []);
    assert.equal(warnings.length, 1);
    const warning = warnings[0];
    assert.equal(warning.warning_type, WARNING_TYPES.EARLY_COMPLETION);
    assert.equal(warning.submission_id, 20);
    assert.equal(warning.field, "Completion time");
    const expectedMsg = `Form completed on ${isoDate(2026, 5, 1)} before training date ${isoDate(
      2026,
      6,
      9
    )} (Date of Conference or Training)`;
    assert.equal(warning.parsed_value, expectedMsg);
  });

  test("form completed after the header training date produces no warning", () => {
    const completion = new Date(2026, 6, 15);
    const training = new Date(2026, 5, 9);
    const wideRow = {
      ID: 21,
      "Completion time": completion,
      "Date of Conference or Training": training
    };
    const warnings = checkEarlyCompletion(wideRow, []);
    assert.deepEqual(warnings, []);
  });
});

describe("checkEarlyCompletion — per-session date", () => {
  test("form completed before a per-session date warns EARLY_COMPLETION naming the session", () => {
    const completion = new Date(2026, 4, 1);
    const sessionDate = new Date(2026, 4, 20);
    const wideRow = {
      ID: 22,
      "Completion time": completion,
      "Date of training": sessionDate
    };
    const sessionCols = [{ title: "Webinar A", date: "Date of training" }];
    const warnings = checkEarlyCompletion(wideRow, sessionCols);
    assert.equal(warnings.length, 1);
    const expectedMsg = `Form completed on ${isoDate(2026, 5, 1)} before training date ${isoDate(
      2026,
      5,
      20
    )} (Webinar A)`;
    assert.equal(warnings[0].parsed_value, expectedMsg);
  });

  test("session column with no date key configured is skipped", () => {
    const wideRow = {
      ID: 23,
      "Completion time": new Date(2026, 4, 1)
    };
    const sessionCols = [{ title: "Webinar A", date: null }];
    const warnings = checkEarlyCompletion(wideRow, sessionCols);
    assert.deepEqual(warnings, []);
  });

  test("no Completion time on the row produces no warnings at all", () => {
    const wideRow = {
      ID: 24,
      "Date of Conference or Training": new Date(2026, 5, 9)
    };
    const warnings = checkEarlyCompletion(wideRow, []);
    assert.deepEqual(warnings, []);
  });
});
