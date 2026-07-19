// Shared AOIC formatting utilities for Excel output (ExcelJS).
// Ported from cope_processor/export/aoic_template.py — see docs/specs/cope-processor-spec.md §5-§6.

// Everything in the AOIC template is Times New Roman 12pt, not bold.
export const AOIC_FONT = { name: 'Times New Roman', size: 12, bold: false };
export const AOIC_TITLE_FONT = { name: 'Times New Roman', size: 12, bold: false };
export const AOIC_HEADER_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFB4C6E7' },
};

// Column widths matching the original template exactly.
export const AOIC_COL_A_WIDTH = 123.5;
export const AOIC_COL_B_WIDTH = 10.2;
export const AOIC_COL_C_WIDTH = 41.5;
export const AOIC_COL_D_WIDTH = 8.85;

// Date format matching the original (m/d/yyyy -> "1/26/2025").
export const AOIC_DATE_FORMAT = 'm/d/yyyy';

// SUM range: rows 5 through 18 (fixed 14-row data area in original template).
export const AOIC_SUM_FIRST_ROW = 5;
export const AOIC_SUM_LAST_ROW = 18;
export const AOIC_SUM_ROW = 19;

// Characters Excel/LibreOffice treat as the start of a formula. A user-supplied
// value beginning with one of these (e.g. a session title "=cmd|...") would be
// evaluated as a live formula when an OCS staffer opens the official xlsx.
const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r'];

export function escapeFormula(value) {
  if (typeof value === 'string' && value.length > 0 && FORMULA_TRIGGERS.includes(value[0])) {
    return "'" + value;
  }
  return value;
}

export function autoFitColumns(worksheet, minWidth = 10, maxWidth = 60) {
  worksheet.columns.forEach((column) => {
    let maxLen = 0;
    column.eachCell({ includeEmpty: false }, (cell) => {
      if (cell.value !== null && cell.value !== undefined) {
        maxLen = Math.max(maxLen, String(cell.value).length);
      }
    });
    column.width = Math.min(Math.max(maxLen + 2, minWidth), maxWidth);
  });
}

export function sanitizeSheetName(name, maxLen = 31) {
  const cleaned = name.replace(/[/\\?*[\]]/g, '');
  return cleaned.slice(0, maxLen);
}

export function sanitizeFilename(name, maxLen = 30) {
  const cleaned = name.replace(/[<>:"/\\|?*]/g, '').replaceAll(' ', '_');
  return cleaned.slice(0, maxLen);
}

export function dedupSheetName(name, existing) {
  if (!existing.has(name)) {
    return name;
  }
  let n = 2;
  while (true) {
    const suffix = `_${n}`;
    const candidate = name.slice(0, 31 - suffix.length) + suffix;
    if (!existing.has(candidate)) {
      return candidate;
    }
    n += 1;
  }
}
