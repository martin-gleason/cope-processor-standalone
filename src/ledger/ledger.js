// Ledger module — schema v2.0, dedupe / sent-to-AOIC tracking.
// No Python analog; behavior defined directly by docs/specs/cope-processor-spec.md §8.
// Pure functions only — JSON parsing/file I/O happens in the UI layer.

export const LEDGER_SCHEMA_VERSION = "2.0";

export function makeLedgerEntry({
  submissionId,
  formYear,
  firstName,
  lastName,
  label,
  provider,
  dates,
  totalHours,
  filename,
  generatedAt,
  generatedBy
}) {
  return {
    key: `${formYear}#${submissionId}`,
    submission_id: submissionId,
    first_name: firstName,
    last_name: lastName,
    label,
    provider,
    dates,
    total_hours: totalHours,
    filename,
    generated_at: generatedAt,
    generated_by: generatedBy,
    sent_to_aoic: false,
    sent_at: null
  };
}

// Spec §8 rule 2: absent from ledger = New; present with sent_to_aoic false = Generated;
// true = Sent. `ledgerEntries` is the entries array (or a Map/object keyed by `key`).
export function getSubmissionStatus(ledgerEntries, key) {
  const entry = findEntry(ledgerEntries, key);
  if (!entry) return "new";
  return entry.sent_to_aoic ? "sent" : "generated";
}

function findEntry(ledgerEntries, key) {
  if (Array.isArray(ledgerEntries)) {
    return ledgerEntries.find((e) => e.key === key);
  }
  if (ledgerEntries instanceof Map) {
    return ledgerEntries.get(key);
  }
  if (ledgerEntries && typeof ledgerEntries === "object") {
    return ledgerEntries[key];
  }
  return undefined;
}

// Spec §8 rule 4: union entries by key across multiple ledger files. For each key,
// the entry with the latest updated/generated_at timestamp wins — EXCEPT
// sent_to_aoic: true always beats false regardless of timestamp. All inputs must
// share the same form_year; a mismatch is a hard error since merging across form
// years would silently corrupt the key namespace (spec §8 rule 1).
export function mergeLedgers(ledgerFileObjects) {
  if (!Array.isArray(ledgerFileObjects) || ledgerFileObjects.length === 0) {
    throw new Error("mergeLedgers requires at least one ledger object");
  }

  const formYear = ledgerFileObjects[0].form_year;
  for (const ledger of ledgerFileObjects) {
    if (ledger.form_year !== formYear) {
      throw new Error(
        `mergeLedgers: form_year mismatch ("${ledger.form_year}" vs "${formYear}") — cannot merge ledgers from different form years`
      );
    }
  }

  const merged = new Map();
  let latestUpdated = null;
  let latestUpdatedBy = null;

  for (const ledger of ledgerFileObjects) {
    if (ledger.updated && (latestUpdated === null || ledger.updated > latestUpdated)) {
      latestUpdated = ledger.updated;
      latestUpdatedBy = ledger.updated_by ?? latestUpdatedBy;
    }

    for (const entry of ledger.entries ?? []) {
      const existing = merged.get(entry.key);
      if (!existing) {
        merged.set(entry.key, entry);
        continue;
      }
      merged.set(entry.key, pickWinningEntry(existing, entry));
    }
  }

  return {
    schema_version: LEDGER_SCHEMA_VERSION,
    form_year: formYear,
    updated: latestUpdated,
    updated_by: latestUpdatedBy,
    entries: Array.from(merged.values())
  };
}

function pickWinningEntry(a, b) {
  if (a.sent_to_aoic && !b.sent_to_aoic) return a;
  if (b.sent_to_aoic && !a.sent_to_aoic) return b;

  const aTime = entryTimestamp(a);
  const bTime = entryTimestamp(b);
  return bTime >= aTime ? b : a;
}

function entryTimestamp(entry) {
  return entry.sent_at || entry.generated_at || "";
}

// Spec §8 rule 3: marking Sent sets sent_to_aoic/sent_at on the entry and refreshes
// the ledger's top-level updated/updated_by. Returns a new ledger object; does not
// mutate the input.
export function markSent(ledger, key, sentAt, updatedBy) {
  const entryIndex = ledger.entries.findIndex((e) => e.key === key);
  if (entryIndex === -1) {
    throw new Error(`markSent: no entry found for key "${key}"`);
  }

  const entries = ledger.entries.slice();
  entries[entryIndex] = {
    ...entries[entryIndex],
    sent_to_aoic: true,
    sent_at: sentAt
  };

  return {
    ...ledger,
    entries,
    updated: sentAt,
    updated_by: updatedBy
  };
}
