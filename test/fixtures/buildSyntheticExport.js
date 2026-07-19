// Synthetic MS Forms export builder — no real staff PII, per CLAUDE.md.
// Builds an in-memory workbook via ExcelJS matching the 2026-2027 schema
// (spec §4), writes it to a Buffer, and hands that Buffer to formsReader.js
// (which reads with SheetJS/xlsx) for round-trip testing.
import ExcelJS from "exceljs";
import {
  SESSION_TITLE_BASE,
  DATE_OF_TRAINING_BASE,
  CREDIT_HOURS_BASE,
  LAST_SESSION_BASE,
  TRAINING_TYPE_COL,
  CONFERENCE_NAME_COL,
  CONFERENCE_LAST_DAY_COL,
  PROVIDER_COL
} from "../../src/shared/constants.js";

export const BASE_HEADERS = [
  "ID",
  "Start time",
  "Completion time",
  "Email",
  "Name",
  "First Name",
  "Last Name",
  "Date of Conference or Training",
  TRAINING_TYPE_COL,
  CONFERENCE_NAME_COL,
  PROVIDER_COL,
  CONFERENCE_LAST_DAY_COL
];

function sessionHeaderGroup(n) {
  if (n === 1) {
    return [SESSION_TITLE_BASE, DATE_OF_TRAINING_BASE, CREDIT_HOURS_BASE, LAST_SESSION_BASE];
  }
  const group = [`${SESSION_TITLE_BASE}${n}`, `${DATE_OF_TRAINING_BASE}${n}`, `${CREDIT_HOURS_BASE}${n}`];
  // Spec §4: session 7 has no last-session flag column. Extend that same
  // omission to any session beyond 7 the form might one day add.
  if (n !== 7) group.push(`${LAST_SESSION_BASE}${n}`);
  return group;
}

export function buildHeaders(sessionGroups = 7) {
  const headers = [...BASE_HEADERS];
  for (let n = 1; n <= sessionGroups; n += 1) headers.push(...sessionHeaderGroup(n));
  return headers;
}

export function makeRow({
  id,
  startTime = new Date("2026-06-01T10:00:00"),
  completionTime = new Date("2026-06-01T10:05:00"),
  email = "anonymous",
  name = "",
  firstName = "",
  lastName = "",
  headerDate = null,
  trainingType = "Single Training/Webinar",
  conferenceName = "",
  provider = "APPA: American Probation and Parole Association",
  lastDayOfConference = "",
  sessions = []
} = {}) {
  const row = {
    ID: id,
    "Start time": startTime,
    "Completion time": completionTime,
    Email: email,
    Name: name,
    "First Name": firstName,
    "Last Name": lastName,
    "Date of Conference or Training": headerDate,
    [TRAINING_TYPE_COL]: trainingType,
    [CONFERENCE_NAME_COL]: conferenceName,
    [PROVIDER_COL]: provider,
    [CONFERENCE_LAST_DAY_COL]: lastDayOfConference
  };

  sessions.forEach((session, index) => {
    const n = index + 1;
    const titleKey = n === 1 ? SESSION_TITLE_BASE : `${SESSION_TITLE_BASE}${n}`;
    const dateKey = n === 1 ? DATE_OF_TRAINING_BASE : `${DATE_OF_TRAINING_BASE}${n}`;
    const hoursKey = n === 1 ? CREDIT_HOURS_BASE : `${CREDIT_HOURS_BASE}${n}`;
    const lastKey = n === 1 ? LAST_SESSION_BASE : `${LAST_SESSION_BASE}${n}`;
    row[titleKey] = session.title ?? "";
    row[dateKey] = session.date ?? "";
    row[hoursKey] = session.hours ?? "";
    if (session.last !== undefined) row[lastKey] = session.last;
  });

  return row;
}

// The spec §11.2 acceptance-criterion fixture: named in the spec itself
// (docs/specs/cope-processor-spec.md §11.2, §8 ledger example), so not real
// unpublished PII — see docs/plans/f1-port-and-build.md decisions log.
export function victorJuniousRow(id = 17) {
  return makeRow({
    id,
    firstName: "Victor",
    lastName: "Junious",
    headerDate: new Date("2026-06-09T00:00:00"),
    trainingType: "Single Training/Webinar",
    provider: "APPA: American Probation and Parole Association",
    sessions: [{ title: "APPA Presumptive Provider Webinar", date: "", hours: 1.5, last: "Yes" }]
  });
}

export function conferenceRow(id = 42) {
  return makeRow({
    id,
    firstName: "Pat",
    lastName: "Rivera",
    headerDate: new Date("2026-04-10T00:00:00"),
    trainingType: "Conference",
    conferenceName: "NCSC Annual Justice Conference",
    provider: "NCSC: National Center for State Courts",
    lastDayOfConference: new Date("2026-04-12T00:00:00"),
    sessions: [
      { title: "Opening Plenary", date: new Date("2026-04-10T00:00:00"), hours: 1.5, last: "No" },
      { title: "Breakout: Data-Driven Supervision", date: new Date("2026-04-11T00:00:00"), hours: 2, last: "No" },
      { title: "Closing Session", date: new Date("2026-04-12T00:00:00"), hours: 1, last: "Yes" }
    ]
  });
}

export async function buildWorkbookBuffer(rows, { sessionGroups = 7, headers = null } = {}) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sheet1");
  const hdrs = headers ?? buildHeaders(sessionGroups);
  sheet.addRow(hdrs);
  for (const row of rows) {
    sheet.addRow(hdrs.map((h) => (Object.prototype.hasOwnProperty.call(row, h) ? row[h] : null)));
  }
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

// Column-count decompression-bomb fixture: a header row alone spanning
// beyond MAX_FORM_COLS. No data rows needed — checkHeaderWidth runs before
// any row scanning.
export async function buildOversizedColumnWorkbookBuffer(columnCount) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sheet1");
  sheet.getCell(1, 1).value = "ID";
  sheet.getCell(1, columnCount).value = "Overflow";
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

// Row-count decompression-bomb fixture: a sparse sheet whose last populated
// cell sits beyond MAX_FORM_ROWS, so the sheet's dimension (and therefore
// rowsAoa.length) crosses the guard without materializing tens of thousands
// of real data rows.
export async function buildOversizedRowWorkbookBuffer(rowCount) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sheet1");
  sheet.getCell(1, 1).value = "ID";
  sheet.getCell(rowCount + 1, 1).value = 999;
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
