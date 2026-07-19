import { pyRound2 } from "../shared/pyUtils.js";
import { WARNING_TYPES, WORD_MAP, makeWarning } from "../shared/constants.js";

const RE_NUMERIC = /^-?\d+\.?\d*$/;
const RE_HOURS = /(\d+\.?\d*)\s*(?:hours?|hrs?)/i;
const RE_MINUTES = /(\d+\.?\d*)\s*(?:minutes?|mins?)/i;
const RE_COMBINED = /(\d+\.?\d*)\s*(?:hours?|hrs?)\s*(?:and\s*)?(\d+\.?\d*)\s*(?:minutes?|mins?)/i;
const RE_WORD_HOURS = /(\w+)\s+(?:hours?|hrs?)/i;

// A single training session beyond this many hours is almost certainly a data
// entry error (e.g. minutes typed in the hours field, or a stray digit). We do
// not clamp — the value is kept so a human can judge — but we flag it so it
// cannot silently inflate an official AOIC SUM. Negative values are always out
// of range.
const MAX_REASONABLE_SESSION_HOURS = 24.0;

export function parseHours(rawValue, submissionId = 0, fieldName = "") {
  const warnings = [];

  function finalize(value) {
    if (value < 0 || value > MAX_REASONABLE_SESSION_HOURS) {
      warnings.push(
        makeWarning(submissionId, fieldName, String(rawValue), value, WARNING_TYPES.OUT_OF_RANGE)
      );
    }
    return [value, warnings];
  }

  // 1. None/undefined -> 0.0 + PARSE_ERROR (no range check)
  if (rawValue === null || rawValue === undefined) {
    warnings.push(makeWarning(submissionId, fieldName, "", 0.0, WARNING_TYPES.PARSE_ERROR));
    return [0.0, warnings];
  }

  // 2. Already numeric -> finalize
  if (typeof rawValue === "number") {
    return finalize(pyRound2(rawValue));
  }

  const text = String(rawValue).trim();
  if (!text) {
    warnings.push(makeWarning(submissionId, fieldName, "", 0.0, WARNING_TYPES.PARSE_ERROR));
    return [0.0, warnings];
  }

  // 3. Clean numeric string -> finalize
  if (RE_NUMERIC.test(text)) {
    return finalize(pyRound2(parseFloat(text)));
  }

  // 4. Combined hours + minutes, forward order: "1 hour 30 minutes"
  let m = text.match(RE_COMBINED);
  if (m) {
    const result = pyRound2(parseFloat(m[1]) + parseFloat(m[2]) / 60);
    warnings.push(makeWarning(submissionId, fieldName, text, result, WARNING_TYPES.COMBINED_PARSED));
    return finalize(result);
  }

  // 4b. Reverse order: "30 minutes and 1 hour". If both an hours and a
  // minutes token are present anywhere, combine them regardless of order.
  const mh = text.match(RE_HOURS);
  const mm = text.match(RE_MINUTES);
  if (mh && mm) {
    const result = pyRound2(parseFloat(mh[1]) + parseFloat(mm[1]) / 60);
    warnings.push(makeWarning(submissionId, fieldName, text, result, WARNING_TYPES.COMBINED_PARSED));
    return finalize(result);
  }

  // 5. Number + "hour(s)" (only if not also a minutes match)
  if (mh && !mm) {
    const result = pyRound2(parseFloat(mh[1]));
    warnings.push(makeWarning(submissionId, fieldName, text, result, WARNING_TYPES.HOURS_SUFFIX));
    return finalize(result);
  }

  // 6. Number + "minute(s)" (only if not also an hours match)
  if (mm && !mh) {
    const result = pyRound2(parseFloat(mm[1]) / 60);
    warnings.push(makeWarning(submissionId, fieldName, text, result, WARNING_TYPES.MINUTES_CONVERTED));
    return finalize(result);
  }

  // 7. Direct word lookup (no range check — word map is bounded 0-10)
  const normalized = text.toLowerCase().trim();
  if (Object.prototype.hasOwnProperty.call(WORD_MAP, normalized)) {
    const result = WORD_MAP[normalized];
    warnings.push(makeWarning(submissionId, fieldName, text, result, WARNING_TYPES.WORD_TO_NUMBER));
    return [result, warnings];
  }

  // 8. Fraction words with "hour" (no range check)
  const fractionPhrases = [["half hour", 0.5], ["quarter hour", 0.25]];
  for (const [phrase, value] of fractionPhrases) {
    if (normalized.includes(phrase)) {
      warnings.push(makeWarning(submissionId, fieldName, text, value, WARNING_TYPES.FRACTION_WORD));
      return [value, warnings];
    }
  }

  // 9. Word + "hours" pattern (no range check)
  const wm = text.match(RE_WORD_HOURS);
  if (wm) {
    const word = wm[1].toLowerCase();
    if (Object.prototype.hasOwnProperty.call(WORD_MAP, word)) {
      const result = WORD_MAP[word];
      warnings.push(makeWarning(submissionId, fieldName, text, result, WARNING_TYPES.WORD_TO_NUMBER));
      return [result, warnings];
    }
  }

  // 10. Fallback — unparseable (no range check)
  warnings.push(makeWarning(submissionId, fieldName, text, 0.0, WARNING_TYPES.PARSE_ERROR));
  return [0.0, warnings];
}
