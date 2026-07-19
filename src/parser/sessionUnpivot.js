import { pyGet } from "../shared/pyUtils.js";
import { parseHours } from "./hoursParser.js";
import { PROVIDERS, TRAINING_TYPE_COL, CONFERENCE_NAME_COL, PROVIDER_COL } from "../shared/constants.js";

const HEADER_DATE_COL = "Date of Conference or Training";

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

function providerAcronym(rawDropdownValue) {
  if (isBlank(rawDropdownValue)) return "";
  const colonIndex = rawDropdownValue.indexOf(":");
  const prefix = (colonIndex === -1 ? rawDropdownValue : rawDropdownValue.slice(0, colonIndex)).trim();
  const match = PROVIDERS.find((p) => p.acronym === prefix);
  return match ? match.acronym : prefix;
}

export function unpivotSessions(rows, sessionCols) {
  const tallRows = [];
  const allWarnings = [];

  for (const row of rows) {
    const submissionId = pyGet(row, "ID", "");
    const lastName = pyGet(row, "Last Name", "");
    const firstName = pyGet(row, "First Name", "");
    const email = pyGet(row, "Email", "");
    const trainingType = pyGet(row, TRAINING_TYPE_COL, "");
    const conferenceName = pyGet(row, CONFERENCE_NAME_COL, "");
    const provider = providerAcronym(pyGet(row, PROVIDER_COL, ""));
    const submitted = pyGet(row, "Completion time", "");
    const headerDate = pyGet(row, HEADER_DATE_COL, "");

    for (const col of sessionCols) {
      const title = pyGet(row, col.titleCol, "");
      if (isBlank(title)) continue;

      // Empty-string session dates fall back to the header date, same as
      // missing ones — MS Forms leaves this blank for single trainings.
      const sessionDate = pyGet(row, col.dateCol, "");
      const date = isBlank(sessionDate) ? headerDate : sessionDate;

      const rawHours = pyGet(row, col.hoursCol, "");
      const [hours, hoursWarnings] = parseHours(rawHours, submissionId, col.hoursCol);
      allWarnings.push(...hoursWarnings);

      tallRows.push({
        "Last Name": lastName,
        "First Name": firstName,
        Email: email,
        "Training Type": trainingType,
        "Conference Name": conferenceName,
        Provider: provider,
        "Session Title": title,
        "Date of Training": date,
        "Credit Hours": hours,
        "Original Hours Input": rawHours,
        Submitted: submitted,
        "Submission ID": submissionId
      });
    }
  }

  return [tallRows, allWarnings];
}
