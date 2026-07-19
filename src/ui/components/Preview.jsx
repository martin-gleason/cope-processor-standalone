import { Fragment } from "preact";
import { useMemo } from "preact/hooks";
import { warningLevel } from "../pipeline.js";

const STATUS_LABELS = {
  new: "New",
  generated: "Already Generated",
  sent: "Already Generated"
};

function StatusPill({ sub }) {
  if (sub.status === "new") {
    return (
      <span class="ocs-pill ocs-pill-neutral">
        <span aria-hidden="true">●</span> New
      </span>
    );
  }
  const on = sub.ledgerEntry?.generated_at ? new Date(sub.ledgerEntry.generated_at) : null;
  const dateStr = on ? `${on.getMonth() + 1}/${on.getDate()}/${on.getFullYear()}` : "";
  return (
    <span class="ocs-pill ocs-pill-good">
      <span aria-hidden="true">✓</span> Already Generated{dateStr ? ` (on ${dateStr})` : ""}
    </span>
  );
}

export function Preview({
  subs,
  filterPerson,
  filterStatus,
  onFilterPerson,
  onFilterStatus,
  selected,
  onToggleSelect,
  onToggleSelectAll,
  expanded,
  onToggleExpanded,
  onGenerateSelected,
  onExportTracker,
  generating
}) {
  const people = useMemo(() => {
    const set = new Map();
    for (const s of subs) set.set(s.id, `${s.firstName} ${s.lastName}`.trim());
    return Array.from(set.entries());
  }, [subs]);

  const filtered = useMemo(() => {
    return subs.filter((s) => {
      if (filterPerson !== "all" && String(s.id) !== filterPerson) return false;
      if (filterStatus === "new" && s.status !== "new") return false;
      if (filterStatus === "generated" && s.status === "new") return false;
      return true;
    });
  }, [subs, filterPerson, filterStatus]);

  const selectableIds = filtered.filter((s) => s.status === "new").map((s) => s.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const totalSelectedForGenerate = subs.filter((s) => s.status === "new" && selected.has(s.id)).length;

  return (
    <div class="ocs-view-enter">
      <div class="ocs-view-header">
        <h2>Preview submissions</h2>
        <span class="ocs-view-sub">Newest first · {filtered.length} shown</span>
      </div>

      <div class="ocs-filters">
        <div class="ocs-field">
          <label for="ocs-filter-person">Person</label>
          <select id="ocs-filter-person" value={filterPerson} onChange={(e) => onFilterPerson(e.target.value)}>
            <option value="all">All people</option>
            {people.map(([id, name]) => (
              <option key={id} value={String(id)}>
                {name || `Submission ${id}`}
              </option>
            ))}
          </select>
        </div>
        <div class="ocs-field">
          <label for="ocs-filter-status">Status</label>
          <select id="ocs-filter-status" value={filterStatus} onChange={(e) => onFilterStatus(e.target.value)}>
            <option value="all">All</option>
            <option value="new">New only</option>
            <option value="generated">Already generated</option>
          </select>
        </div>
        <button type="button" class="ocs-btn ocs-btn-outline" onClick={onExportTracker}>
          Export Tracker
        </button>
        <button
          type="button"
          class="ocs-btn ocs-btn-primary"
          disabled={totalSelectedForGenerate === 0 || generating}
          onClick={onGenerateSelected}
        >
          {generating ? "Generating…" : `Generate selected (${totalSelectedForGenerate})`}
        </button>
      </div>

      <div class="ocs-table-card">
        {filtered.length === 0 ? (
          <p class="ocs-empty">No submissions match these filters.</p>
        ) : (
          <table class="ocs-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    aria-label="Select all new submissions"
                    checked={allSelected}
                    disabled={selectableIds.length === 0}
                    onChange={() => onToggleSelectAll(selectableIds, !allSelected)}
                  />
                </th>
                <th>Person</th>
                <th>Conference / Label</th>
                <th>Date(s)</th>
                <th>Sessions</th>
                <th>Hours</th>
                <th>Status</th>
                <th>Warnings</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((sub) => {
                const isExpanded = expanded.has(sub.id);
                const hasError = sub.warnings.some((w) => warningLevel(w.warning_type) === "error");
                return (
                  <Fragment key={sub.id}>
                    <tr class={selected.has(sub.id) ? "ocs-row-selected" : ""}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Select submission for ${sub.firstName} ${sub.lastName}`}
                          checked={selected.has(sub.id)}
                          disabled={sub.status !== "new"}
                          onChange={() => onToggleSelect(sub.id)}
                        />
                      </td>
                      <td class="ocs-col-person">
                        {sub.firstName} {sub.lastName}
                      </td>
                      <td class="ocs-col-label">{sub.label}</td>
                      <td class="ocs-col-dates">{sub.dates || "—"}</td>
                      <td class="ocs-col-sessions">{sub.sessions.length}</td>
                      <td class="ocs-col-hours">{sub.totalHours.toFixed(1)}</td>
                      <td>
                        <StatusPill sub={sub} />
                      </td>
                      <td>
                        {sub.warnings.length > 0 ? (
                          <button
                            type="button"
                            class={`ocs-warn-chip${hasError ? " ocs-warn-chip-bad" : ""}`}
                            aria-expanded={isExpanded}
                            onClick={() => onToggleExpanded(sub.id)}
                          >
                            ⚠ {sub.warnings.length} warning{sub.warnings.length === 1 ? "" : "s"} {isExpanded ? "▴" : "▾"}
                          </button>
                        ) : (
                          <span class="ocs-warn-dash" aria-label="No warnings">—</span>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr class="ocs-warn-detail">
                        <td colSpan="8">
                          {sub.warnings.map((w, i) => {
                            const level = warningLevel(w.warning_type);
                            return (
                              <p key={i} class={`ocs-warn-item ocs-warn-${level}`}>
                                <span class="ocs-warn-tag">{level === "error" ? "Error:" : "Warning:"}</span>{" "}
                                {w.warning_type} — {w.field}
                                {w.raw_value ? ` ("${w.raw_value}")` : ""}
                                {w.parsed_value !== undefined && w.parsed_value !== "" ? ` → ${w.parsed_value}` : ""}
                              </p>
                            );
                          })}
                          <ul class="ocs-session-list">
                            {sub.sessions.map((s, i) => (
                              <li key={i}>
                                {s["Session Title"]} — {String(s["Date of Training"] ?? "no date")} · {Number(s["Credit Hours"]).toFixed(1)} hr
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
