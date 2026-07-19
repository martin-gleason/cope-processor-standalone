export function pyGet(obj, key, defaultValue) {
  return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : defaultValue;
}

// formsReader.js reads with raw:true/cellDates:false, so real Excel date
// cells arrive as day-serial numbers (days since 1899-12-30, with Excel's
// spurious 1900-leap-year day baked into the epoch offset), not JS Dates.
// Anything that compares or displays a date read off a submission row must
// go through this, or numeric serials silently misparse as 1970-epoch
// milliseconds.
export function toJsDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(Math.round((value - 25569) * 86400000));
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

// Python's round() uses round-half-to-even ("banker's rounding") on the
// value's *true binary representation* — not on the decimal literal a
// person typed. That's why round(2.675, 2) is 2.67 in Python, not 2.68:
// 2.675 isn't exactly representable, and the nearest double is actually
// 2.67499999999999982... which is not a tie at all. A naive
// multiply-by-100-and-check-against-0.5-with-an-epsilon approach gets this
// case wrong, because the float noise from the *decimal-that-wasn't-exact*
// case (~1e-14) is indistinguishable from a real epsilon tolerance unless
// you go back to the exact decimal expansion. So: use toFixed(20), which
// V8 computes exactly, to read off the true digits beyond the 2nd decimal
// place, and do the round-half-to-even decision on those digits directly
// (as a BigInt, to avoid reintroducing float error at the final step).
export function pyRound2(value) {
  if (!Number.isFinite(value)) return value;
  if (value === 0) return 0;

  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  const [intPart, fracPart] = abs.toFixed(20).split(".");
  const keep = fracPart.slice(0, 2);
  const remainder = fracPart.slice(2);

  let base = BigInt(intPart + keep);
  const roundDigit = remainder[0] || "0";
  const restIsZero = /^0*$/.test(remainder.slice(1));

  if (roundDigit > "5" || (roundDigit === "5" && !restIsZero)) {
    base += 1n;
  } else if (roundDigit === "5" && restIsZero && base % 2n !== 0n) {
    base += 1n;
  }

  return (sign * Number(base)) / 100;
}
