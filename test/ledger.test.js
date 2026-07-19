import test from "node:test";
import assert from "node:assert/strict";
import {
  LEDGER_SCHEMA_VERSION,
  makeLedgerEntry,
  getSubmissionStatus,
  mergeLedgers,
  markSent
} from "../src/ledger/ledger.js";

function victorEntry(overrides = {}) {
  return {
    ...makeLedgerEntry({
      submissionId: 17,
      formYear: "2026-2027",
      firstName: "Victor",
      lastName: "Junious",
      label: "APPA Webinars",
      provider: "APPA",
      dates: ["2026-06-09"],
      totalHours: 1.5,
      filename: "6-9-26_presumed_provider_form_V__Junious.xlsx",
      generatedAt: "2026-07-17T14:29:00-05:00",
      generatedBy: "SGH"
    }),
    ...overrides
  };
}

function ledgerOf(entries, updated = "2026-07-17T14:30:00-05:00", updatedBy = "SGH") {
  return {
    schema_version: LEDGER_SCHEMA_VERSION,
    form_year: "2026-2027",
    updated,
    updated_by: updatedBy,
    entries
  };
}

test("makeLedgerEntry produces the spec §8 key format", () => {
  const entry = makeLedgerEntry({
    submissionId: 17,
    formYear: "2026-2027",
    firstName: "Victor",
    lastName: "Junious",
    label: "APPA Webinars",
    provider: "APPA",
    dates: ["2026-06-09"],
    totalHours: 1.5,
    filename: "6-9-26_presumed_provider_form_V__Junious.xlsx",
    generatedAt: "2026-07-17T14:29:00-05:00",
    generatedBy: "SGH"
  });
  assert.equal(entry.key, "2026-2027#17");
  assert.equal(entry.sent_to_aoic, false);
  assert.equal(entry.sent_at, null);
});

test("makeLedgerEntry key format protects against ID reuse across form years", () => {
  const a = makeLedgerEntry({ submissionId: 17, formYear: "2026-2027", generatedAt: "x", generatedBy: "x" });
  const b = makeLedgerEntry({ submissionId: 17, formYear: "2027-2028", generatedAt: "x", generatedBy: "x" });
  assert.notEqual(a.key, b.key);
  assert.equal(a.key, "2026-2027#17");
  assert.equal(b.key, "2027-2028#17");
});

test("getSubmissionStatus: absent from ledger is New", () => {
  const ledger = ledgerOf([]);
  assert.equal(getSubmissionStatus(ledger.entries, "2026-2027#17"), "new");
});

test("getSubmissionStatus: present with sent_to_aoic false is Generated", () => {
  const ledger = ledgerOf([victorEntry()]);
  assert.equal(getSubmissionStatus(ledger.entries, "2026-2027#17"), "generated");
});

test("getSubmissionStatus: present with sent_to_aoic true is Sent", () => {
  const ledger = ledgerOf([victorEntry({ sent_to_aoic: true, sent_at: "2026-07-18T09:00:00-05:00" })]);
  assert.equal(getSubmissionStatus(ledger.entries, "2026-2027#17"), "sent");
});

test("getSubmissionStatus works against a plain object keyed by entry key, not just an array", () => {
  const entry = victorEntry();
  const byKey = { [entry.key]: entry };
  assert.equal(getSubmissionStatus(byKey, "2026-2027#17"), "generated");
  assert.equal(getSubmissionStatus(byKey, "2026-2027#999"), "new");
});

test("getSubmissionStatus works against a Map keyed by entry key", () => {
  const entry = victorEntry();
  const map = new Map([[entry.key, entry]]);
  assert.equal(getSubmissionStatus(map, "2026-2027#17"), "generated");
});

test("mergeLedgers: union-by-key across two ledger files, latest updated/generated_at wins", () => {
  const older = victorEntry({ generated_at: "2026-07-17T10:00:00-05:00", total_hours: 1.5 });
  const newer = victorEntry({ generated_at: "2026-07-17T14:29:00-05:00", total_hours: 2.0 });

  const merged = mergeLedgers([ledgerOf([older]), ledgerOf([newer])]);
  assert.equal(merged.entries.length, 1);
  assert.equal(merged.entries[0].total_hours, 2.0);
});

test("mergeLedgers: entries present in only one file are kept", () => {
  const a = victorEntry();
  const b = { ...victorEntry({ submission_id: 5 }), key: "2026-2027#5" };
  const merged = mergeLedgers([ledgerOf([a]), ledgerOf([b])]);
  assert.equal(merged.entries.length, 2);
  const keys = merged.entries.map((e) => e.key).sort();
  assert.deepEqual(keys, ["2026-2027#17", "2026-2027#5"]);
});

test("mergeLedgers: sent_to_aoic true always beats false, even with an older timestamp", () => {
  const sentButOlder = victorEntry({
    sent_to_aoic: true,
    sent_at: "2026-07-17T10:00:00-05:00",
    generated_at: "2026-07-17T09:00:00-05:00"
  });
  const unsentButNewer = victorEntry({
    sent_to_aoic: false,
    generated_at: "2026-07-18T23:00:00-05:00"
  });

  const mergedOrderA = mergeLedgers([ledgerOf([sentButOlder]), ledgerOf([unsentButNewer])]);
  assert.equal(mergedOrderA.entries[0].sent_to_aoic, true);

  // Order of input files must not matter.
  const mergedOrderB = mergeLedgers([ledgerOf([unsentButNewer]), ledgerOf([sentButOlder])]);
  assert.equal(mergedOrderB.entries[0].sent_to_aoic, true);
});

test("mergeLedgers: three-way merge — sent survives even when merged last", () => {
  const generated = victorEntry({ generated_at: "2026-07-17T09:00:00-05:00" });
  const sent = victorEntry({
    sent_to_aoic: true,
    sent_at: "2026-07-17T09:05:00-05:00",
    generated_at: "2026-07-17T09:00:00-05:00"
  });
  const regeneratedLater = victorEntry({
    sent_to_aoic: false,
    generated_at: "2026-08-01T09:00:00-05:00"
  });

  const merged = mergeLedgers([ledgerOf([generated]), ledgerOf([sent]), ledgerOf([regeneratedLater])]);
  assert.equal(merged.entries.length, 1);
  assert.equal(merged.entries[0].sent_to_aoic, true);
});

test("mergeLedgers: divergent ledgers merge to the union count from spec acceptance criterion 5", () => {
  const one = victorEntry();
  const two = { ...victorEntry({ submission_id: 18 }), key: "2026-2027#18" };
  const three = { ...victorEntry({ submission_id: 19, sent_to_aoic: true, sent_at: "2026-07-18T00:00:00-05:00" }), key: "2026-2027#19" };

  const ledgerA = ledgerOf([one, two]);
  const ledgerB = ledgerOf([three, { ...two, sent_to_aoic: true, sent_at: "2026-07-18T01:00:00-05:00" }]);

  const merged = mergeLedgers([ledgerA, ledgerB]);
  assert.equal(merged.entries.length, 3);
  const byKey = Object.fromEntries(merged.entries.map((e) => [e.key, e]));
  assert.equal(byKey["2026-2027#18"].sent_to_aoic, true, "sent status must survive the merge");
  assert.equal(byKey["2026-2027#19"].sent_to_aoic, true);
});

test("mergeLedgers: rejects merging ledgers from different form years", () => {
  const a = ledgerOf([victorEntry()], "2026-07-17T10:00:00-05:00", "SGH");
  const b = { ...ledgerOf([]), form_year: "2027-2028" };
  assert.throws(() => mergeLedgers([a, b]), /form_year mismatch/);
});

test("mergeLedgers: schema_version on the merged result is always the current schema", () => {
  const merged = mergeLedgers([ledgerOf([victorEntry()])]);
  assert.equal(merged.schema_version, LEDGER_SCHEMA_VERSION);
});

test("mergeLedgers: requires at least one ledger", () => {
  assert.throws(() => mergeLedgers([]), /at least one ledger/);
});

test("markSent sets sent_to_aoic/sent_at on the target entry and stamps the ledger header", () => {
  const ledger = ledgerOf([victorEntry()]);
  const updated = markSent(ledger, "2026-2027#17", "2026-07-18T09:00:00-05:00", "TA");

  assert.equal(updated.entries[0].sent_to_aoic, true);
  assert.equal(updated.entries[0].sent_at, "2026-07-18T09:00:00-05:00");
  assert.equal(updated.updated, "2026-07-18T09:00:00-05:00");
  assert.equal(updated.updated_by, "TA");
});

test("markSent does not mutate the input ledger", () => {
  const original = ledgerOf([victorEntry()]);
  const before = JSON.parse(JSON.stringify(original));
  markSent(original, "2026-2027#17", "2026-07-18T09:00:00-05:00", "TA");
  assert.deepEqual(original, before);
});

test("markSent throws for an unknown key", () => {
  const ledger = ledgerOf([victorEntry()]);
  assert.throws(() => markSent(ledger, "2026-2027#404", "2026-07-18T09:00:00-05:00", "TA"), /no entry found/);
});
