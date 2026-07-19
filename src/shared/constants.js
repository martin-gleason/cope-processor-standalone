export const SESSION_TITLE_BASE = "Session Attended or Training Name";
export const DATE_OF_TRAINING_BASE = "Date of training";
export const CREDIT_HOURS_BASE = "Credit Hours Per Session";
export const LAST_SESSION_BASE = "Is this your last session or training";

export const TRAINING_TYPE_COL =
  "Is this a single training, a training series, or a conference";
export const CONFERENCE_LAST_DAY_COL = "When was the last day of the conference";
export const CONFERENCE_NAME_COL = "Conference Name";
export const PROVIDER_COL =
  "Please indicate who provided the training -- this is necessary to ensure the training was done by a COPE Presumptive Provider.";

// Ledger key prefix (spec §8 rule 1) — bump when the form is revised for a
// new school year so MS Forms ID reuse can't collide across form years.
export const FORM_YEAR = "2026-2027";

export const MAX_FORM_ROWS = 50000;
export const MAX_FORM_COLS = 2000;

export const AOIC_SUM_FIRST_ROW = 5;
export const AOIC_SUM_LAST_ROW = 18;
export const AOIC_SUM_ROW = 19;

export const MAX_SESSIONS_PER_SUBMISSION = 14;

export const WORD_MAP = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  half: 0.5,
  quarter: 0.25,
  "a half": 0.5,
  "an hour": 1,
  "a quarter": 0.25
};

export const WARNING_TYPES = {
  PARSE_ERROR: "PARSE_ERROR",
  WORD_TO_NUMBER: "WORD_TO_NUMBER",
  MINUTES_CONVERTED: "MINUTES_CONVERTED",
  COMBINED_PARSED: "COMBINED_PARSED",
  HOURS_SUFFIX: "HOURS_SUFFIX",
  FRACTION_WORD: "FRACTION_WORD",
  MISSING_NAME: "MISSING_NAME",
  MISSING_CONFERENCE: "MISSING_CONFERENCE",
  ZERO_HOURS: "ZERO_HOURS",
  POSSIBLE_DUPLICATE: "POSSIBLE_DUPLICATE",
  MISSING_DATE: "MISSING_DATE",
  EARLY_COMPLETION: "EARLY_COMPLETION",
  OUT_OF_RANGE: "OUT_OF_RANGE"
};

export const PROVIDERS = [
  { acronym: "APPA", fullName: "American Probation and Parole Association" },
  { acronym: "AOIC", fullName: "Administrative Offices of the Illinois Courts" },
  { acronym: "NCSC", fullName: "National Center for State Courts" },
  { acronym: "ACJI", fullName: "Alliance for Community and Justice Innovation" },
  { acronym: "IPSCA", fullName: "Illinois Probation and Court Services Association" },
  { acronym: "JDAI", fullName: "Juvenile Detention Alternative Initiative" }
];

export const HEADER_BG_COLOR = "D5E8F0";
export const HEADER_TEXT_COLOR = "1A365D";
export const ALT_ROW_COLOR = "F5F5F5";
export const WARNING_BG_COLOR = "FEF3C7";

export function makeWarning(submissionId, field, rawValue, parsedValue, warningType) {
  return {
    submission_id: submissionId,
    field,
    raw_value: rawValue,
    parsed_value: parsedValue,
    warning_type: warningType
  };
}
