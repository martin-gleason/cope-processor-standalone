import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseHours } from "../src/parser/hoursParser.js";
import { pyRound2 } from "../src/shared/pyUtils.js";
import { WARNING_TYPES } from "../src/shared/constants.js";

describe("parseHours — numeric", () => {
  test("integer number passes through, no warnings", () => {
    const [value, warnings] = parseHours(5, 1, "Credit Hours Per Session");
    assert.equal(value, 5);
    assert.deepEqual(warnings, []);
  });

  test("float number is rounded to 2 places via pyRound2", () => {
    const [value, warnings] = parseHours(1.005, 1, "Credit Hours Per Session");
    assert.equal(value, pyRound2(1.005));
    assert.deepEqual(warnings, []);
  });

  test("clean numeric string parses with no warnings", () => {
    const [value, warnings] = parseHours("3", 1, "Credit Hours Per Session");
    assert.equal(value, 3);
    assert.deepEqual(warnings, []);
  });

  test("numeric string with decimal", () => {
    const [value, warnings] = parseHours("2.5", 1, "Credit Hours Per Session");
    assert.equal(value, 2.5);
    assert.deepEqual(warnings, []);
  });

  test("numeric string is trimmed before matching", () => {
    const [value, warnings] = parseHours("  4.5  ", 1, "Credit Hours Per Session");
    assert.equal(value, 4.5);
    assert.deepEqual(warnings, []);
  });
});

describe("parseHours — hours suffix", () => {
  test("'N hours'", () => {
    const [value, warnings] = parseHours("2 hours", 1, "f");
    assert.equal(value, 2);
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].warning_type, WARNING_TYPES.HOURS_SUFFIX);
  });

  test("'N hour' (singular)", () => {
    const [value, warnings] = parseHours("2 hour", 1, "f");
    assert.equal(value, 2);
    assert.equal(warnings[0].warning_type, WARNING_TYPES.HOURS_SUFFIX);
  });

  test("'N hrs'", () => {
    const [value, warnings] = parseHours("3 hrs", 1, "f");
    assert.equal(value, 3);
    assert.equal(warnings[0].warning_type, WARNING_TYPES.HOURS_SUFFIX);
  });

  test("'N hr' (singular abbreviation)", () => {
    const [value, warnings] = parseHours("1 hr", 1, "f");
    assert.equal(value, 1);
    assert.equal(warnings[0].warning_type, WARNING_TYPES.HOURS_SUFFIX);
  });
});

describe("parseHours — minutes", () => {
  test("'N minutes' converts to hours", () => {
    const [value, warnings] = parseHours("90 minutes", 1, "f");
    assert.equal(value, 1.5);
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].warning_type, WARNING_TYPES.MINUTES_CONVERTED);
  });

  test("'N mins'", () => {
    const [value, warnings] = parseHours("45 mins", 1, "f");
    assert.equal(value, 0.75);
    assert.equal(warnings[0].warning_type, WARNING_TYPES.MINUTES_CONVERTED);
  });

  test("'N min'", () => {
    const [value, warnings] = parseHours("30 min", 1, "f");
    assert.equal(value, 0.5);
    assert.equal(warnings[0].warning_type, WARNING_TYPES.MINUTES_CONVERTED);
  });
});

describe("parseHours — combined, forward order (hours then minutes)", () => {
  test("'1 hour 30 minutes'", () => {
    const [value, warnings] = parseHours("1 hour 30 minutes", 1, "f");
    assert.equal(value, 1.5);
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].warning_type, WARNING_TYPES.COMBINED_PARSED);
  });

  test("'2 hrs 15 mins'", () => {
    const [value, warnings] = parseHours("2 hrs 15 mins", 1, "f");
    assert.equal(value, 2.25);
    assert.equal(warnings[0].warning_type, WARNING_TYPES.COMBINED_PARSED);
  });

  test("'1 hour and 30 minutes' — optional 'and' is consumed", () => {
    const [value, warnings] = parseHours("1 hour and 30 minutes", 1, "f");
    assert.equal(value, 1.5);
    assert.equal(warnings[0].warning_type, WARNING_TYPES.COMBINED_PARSED);
  });
});

describe("parseHours — combined, reverse order (minutes then hours)", () => {
  test("'30 minutes 1 hour'", () => {
    const [value, warnings] = parseHours("30 minutes 1 hour", 1, "f");
    assert.equal(value, 1.5);
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].warning_type, WARNING_TYPES.COMBINED_PARSED);
  });

  test("'45 min and 2 hrs'", () => {
    const [value, warnings] = parseHours("45 min and 2 hrs", 1, "f");
    assert.equal(value, 2.75);
    assert.equal(warnings[0].warning_type, WARNING_TYPES.COMBINED_PARSED);
  });
});

describe("parseHours — out of range is flagged, never clamped", () => {
  test("negative numeric value is kept as-is and flagged", () => {
    const [value, warnings] = parseHours(-1, 1, "f");
    assert.equal(value, -1);
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].warning_type, WARNING_TYPES.OUT_OF_RANGE);
  });

  test("negative numeric string is kept as-is and flagged", () => {
    const [value, warnings] = parseHours("-1", 1, "f");
    assert.equal(value, -1);
    assert.equal(warnings[0].warning_type, WARNING_TYPES.OUT_OF_RANGE);
  });

  test("value over 24 is kept as-is and flagged", () => {
    const [value, warnings] = parseHours("300", 1, "f");
    assert.equal(value, 300);
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].warning_type, WARNING_TYPES.OUT_OF_RANGE);
  });

  test("hours-suffix parse over 24 emits both HOURS_SUFFIX and OUT_OF_RANGE", () => {
    const [value, warnings] = parseHours("30 hours", 1, "f");
    assert.equal(value, 30);
    assert.equal(warnings.length, 2);
    assert.equal(warnings[0].warning_type, WARNING_TYPES.HOURS_SUFFIX);
    assert.equal(warnings[1].warning_type, WARNING_TYPES.OUT_OF_RANGE);
  });
});

describe("parseHours — in-range values are not flagged", () => {
  test("in-range numeric has no warnings at all", () => {
    const [value, warnings] = parseHours(10, 1, "f");
    assert.equal(value, 10);
    assert.deepEqual(warnings, []);
  });

  test("in-range 'N hours' only carries the HOURS_SUFFIX warning", () => {
    const [value, warnings] = parseHours("5 hours", 1, "f");
    assert.equal(value, 5);
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].warning_type, WARNING_TYPES.HOURS_SUFFIX);
  });

  test("boundary value 24 is not flagged", () => {
    const [value, warnings] = parseHours(24, 1, "f");
    assert.equal(value, 24);
    assert.deepEqual(warnings, []);
  });

  test("boundary value 0 is not flagged (not negative)", () => {
    const [value, warnings] = parseHours(0, 1, "f");
    assert.equal(value, 0);
    assert.deepEqual(warnings, []);
  });
});

describe("parseHours — word numbers", () => {
  test("'three'", () => {
    const [value, warnings] = parseHours("three", 1, "f");
    assert.equal(value, 3);
    assert.equal(warnings[0].warning_type, WARNING_TYPES.WORD_TO_NUMBER);
  });

  test("'ten'", () => {
    const [value, warnings] = parseHours("ten", 1, "f");
    assert.equal(value, 10);
    assert.equal(warnings[0].warning_type, WARNING_TYPES.WORD_TO_NUMBER);
  });

  test("'half'", () => {
    const [value, warnings] = parseHours("half", 1, "f");
    assert.equal(value, 0.5);
    assert.equal(warnings[0].warning_type, WARNING_TYPES.WORD_TO_NUMBER);
  });

  test("'a half'", () => {
    const [value, warnings] = parseHours("a half", 1, "f");
    assert.equal(value, 0.5);
    assert.equal(warnings[0].warning_type, WARNING_TYPES.WORD_TO_NUMBER);
  });

  test("'an hour'", () => {
    const [value, warnings] = parseHours("an hour", 1, "f");
    assert.equal(value, 1);
    assert.equal(warnings[0].warning_type, WARNING_TYPES.WORD_TO_NUMBER);
  });

  test("'a quarter'", () => {
    const [value, warnings] = parseHours("a quarter", 1, "f");
    assert.equal(value, 0.25);
    assert.equal(warnings[0].warning_type, WARNING_TYPES.WORD_TO_NUMBER);
  });

  test("word lookup is case-insensitive", () => {
    const [value, warnings] = parseHours("Three", 1, "f");
    assert.equal(value, 3);
    assert.equal(warnings[0].warning_type, WARNING_TYPES.WORD_TO_NUMBER);
  });
});

describe("parseHours — fraction words", () => {
  test("'half hour'", () => {
    const [value, warnings] = parseHours("half hour", 1, "f");
    assert.equal(value, 0.5);
    assert.equal(warnings[0].warning_type, WARNING_TYPES.FRACTION_WORD);
  });

  test("'quarter hour'", () => {
    const [value, warnings] = parseHours("quarter hour", 1, "f");
    assert.equal(value, 0.25);
    assert.equal(warnings[0].warning_type, WARNING_TYPES.FRACTION_WORD);
  });

  test("'a half hour' (phrase embedded in longer text)", () => {
    const [value, warnings] = parseHours("a half hour", 1, "f");
    assert.equal(value, 0.5);
    assert.equal(warnings[0].warning_type, WARNING_TYPES.FRACTION_WORD);
  });
});

describe("parseHours — word + 'hours' pattern", () => {
  test("'two hours'", () => {
    const [value, warnings] = parseHours("two hours", 1, "f");
    assert.equal(value, 2);
    assert.equal(warnings[0].warning_type, WARNING_TYPES.WORD_TO_NUMBER);
  });

  test("'five hrs'", () => {
    const [value, warnings] = parseHours("five hrs", 1, "f");
    assert.equal(value, 5);
    assert.equal(warnings[0].warning_type, WARNING_TYPES.WORD_TO_NUMBER);
  });
});

describe("parseHours — edge cases", () => {
  test("null -> 0.0 with PARSE_ERROR", () => {
    const [value, warnings] = parseHours(null, 1, "f");
    assert.equal(value, 0.0);
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].warning_type, WARNING_TYPES.PARSE_ERROR);
    assert.equal(warnings[0].raw_value, "");
  });

  test("undefined -> 0.0 with PARSE_ERROR", () => {
    const [value, warnings] = parseHours(undefined, 1, "f");
    assert.equal(value, 0.0);
    assert.equal(warnings[0].warning_type, WARNING_TYPES.PARSE_ERROR);
  });

  test("empty string -> 0.0 with PARSE_ERROR", () => {
    const [value, warnings] = parseHours("", 1, "f");
    assert.equal(value, 0.0);
    assert.equal(warnings[0].warning_type, WARNING_TYPES.PARSE_ERROR);
  });

  test("whitespace-only string -> 0.0 with PARSE_ERROR", () => {
    const [value, warnings] = parseHours("   ", 1, "f");
    assert.equal(value, 0.0);
    assert.equal(warnings[0].warning_type, WARNING_TYPES.PARSE_ERROR);
  });

  test("unparseable text -> 0.0 with PARSE_ERROR, raw_value preserved", () => {
    const [value, warnings] = parseHours("banana", 1, "f");
    assert.equal(value, 0.0);
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].warning_type, WARNING_TYPES.PARSE_ERROR);
    assert.equal(warnings[0].raw_value, "banana");
  });
});

describe("parseHours — warning metadata shape", () => {
  test("warning carries submission_id, field, raw_value, parsed_value, warning_type", () => {
    const [value, warnings] = parseHours("2 hours", 42, "Credit Hours Per Session");
    assert.equal(warnings.length, 1);
    assert.deepEqual(warnings[0], {
      submission_id: 42,
      field: "Credit Hours Per Session",
      raw_value: "2 hours",
      parsed_value: value,
      warning_type: WARNING_TYPES.HOURS_SUFFIX
    });
  });
});
