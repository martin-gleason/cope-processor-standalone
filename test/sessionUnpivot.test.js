import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { unpivotSessions } from "../src/parser/sessionUnpivot.js";

const SESSION_1 = {
  titleCol: "Session Attended or Training Name",
  dateCol: "Date of training",
  hoursCol: "Credit Hours Per Session"
};

const SESSION_2 = {
  titleCol: "Session Attended or Training Name2",
  dateCol: "Date of training2",
  hoursCol: "Credit Hours Per Session2"
};

function baseRow(overrides = {}) {
  return {
    ID: 1,
    "Last Name": "Junious",
    "First Name": "Victor",
    Email: "vjunious@example.org",
    "Is this a single training, a training series, or a conference": "Single Training/Webinar",
    "Conference Name": "",
    "Please indicate who provided the training -- this is necessary to ensure the training was done by a COPE Presumptive Provider.":
      "APPA: American Probation and Parole Association",
    "Completion time": "2026-06-10",
    "Date of Conference or Training": "2026-06-09",
    "Session Attended or Training Name": "Webinar A",
    "Date of training": "2026-06-09",
    "Credit Hours Per Session": "1.5",
    ...overrides
  };
}

describe("unpivotSessions — skip if blank title", () => {
  test("a session group with a blank title is skipped entirely", () => {
    const row = baseRow({
      "Session Attended or Training Name": "",
      "Session Attended or Training Name2": "Webinar B",
      "Date of training2": "2026-06-10",
      "Credit Hours Per Session2": "1"
    });
    const [tallRows] = unpivotSessions([row], [SESSION_1, SESSION_2]);
    assert.equal(tallRows.length, 1);
    assert.equal(tallRows[0]["Session Title"], "Webinar B");
  });

  test("whitespace-only title is treated as blank and skipped", () => {
    const row = baseRow({ "Session Attended or Training Name": "   " });
    const [tallRows] = unpivotSessions([row], [SESSION_1]);
    assert.equal(tallRows.length, 0);
  });
});

describe("unpivotSessions — per-session date vs header-date fallback", () => {
  test("session with its own date keeps that date", () => {
    const row = baseRow({ "Date of training": "2026-06-09" });
    const [tallRows] = unpivotSessions([row], [SESSION_1]);
    assert.equal(tallRows[0]["Date of Training"], "2026-06-09");
  });

  test("session with a missing date column falls back to the header date", () => {
    const row = baseRow({ "Date of Conference or Training": "2026-06-01" });
    delete row["Date of training"];
    const [tallRows] = unpivotSessions([row], [SESSION_1]);
    assert.equal(tallRows[0]["Date of Training"], "2026-06-01");
  });

  test("session with an empty-string date also falls back to the header date", () => {
    const row = baseRow({
      "Date of Conference or Training": "2026-06-01",
      "Date of training": ""
    });
    const [tallRows] = unpivotSessions([row], [SESSION_1]);
    assert.equal(tallRows[0]["Date of Training"], "2026-06-01");
  });
});

describe("unpivotSessions — metadata preservation and trimming", () => {
  test("shared submission fields are copied onto every tall row", () => {
    const row = baseRow();
    const [tallRows] = unpivotSessions([row], [SESSION_1]);
    assert.deepEqual(tallRows[0], {
      "Last Name": "Junious",
      "First Name": "Victor",
      Email: "vjunious@example.org",
      "Training Type": "Single Training/Webinar",
      "Conference Name": "",
      Provider: "APPA",
      "Session Title": "Webinar A",
      "Date of Training": "2026-06-09",
      "Credit Hours": 1.5,
      "Original Hours Input": "1.5",
      Submitted: "2026-06-10",
      "Submission ID": 1
    });
  });

  test("provider acronym is extracted before the colon and trimmed", () => {
    const row = baseRow({
      "Please indicate who provided the training -- this is necessary to ensure the training was done by a COPE Presumptive Provider.":
        "  APPA  : American Probation and Parole Association"
    });
    const [tallRows] = unpivotSessions([row], [SESSION_1]);
    assert.equal(tallRows[0].Provider, "APPA");
  });

  test("unrecognized provider prefix passes through trimmed as-is", () => {
    const row = baseRow({
      "Please indicate who provided the training -- this is necessary to ensure the training was done by a COPE Presumptive Provider.":
        "  Mystery Org : Some Description"
    });
    const [tallRows] = unpivotSessions([row], [SESSION_1]);
    assert.equal(tallRows[0].Provider, "Mystery Org");
  });
});

describe("unpivotSessions — original hours input preserved verbatim", () => {
  test("raw hours text is stored unmodified alongside the parsed value", () => {
    const row = baseRow({ "Credit Hours Per Session": "1 hour 30 minutes" });
    const [tallRows] = unpivotSessions([row], [SESSION_1]);
    assert.equal(tallRows[0]["Original Hours Input"], "1 hour 30 minutes");
    assert.equal(tallRows[0]["Credit Hours"], 1.5);
  });

  test("untrimmed/messy raw input is preserved exactly, not cleaned up", () => {
    const row = baseRow({ "Credit Hours Per Session": "  two hours  " });
    const [tallRows] = unpivotSessions([row], [SESSION_1]);
    assert.equal(tallRows[0]["Original Hours Input"], "  two hours  ");
  });
});

describe("unpivotSessions — hours-parsing warnings attribute to the right submission/field", () => {
  test("an hours-parse warning carries the real submission ID and column name, not swapped", () => {
    const row = baseRow({ ID: 17, "Credit Hours Per Session": "two hours" });
    const [, warnings] = unpivotSessions([row], [SESSION_1]);
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].submission_id, 17);
    assert.equal(warnings[0].field, "Credit Hours Per Session");
  });
});
