import { useRef } from "preact/hooks";

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

export function Ledger({ ledger, onDownload, onMergeFiles, onMarkSent }) {
  const inputRef = useRef(null);
  const entries = ledger?.entries ?? [];
  const generatedCount = entries.length;
  const sentCount = entries.filter((e) => e.sent_to_aoic).length;

  return (
    <div class="ocs-view-enter">
      <div class="ocs-view-header">
        <h2>Ledger</h2>
        <span class="ocs-view-sub">
          {generatedCount} generated logs · {sentCount} sent
        </span>
      </div>
      <p>
        The ledger is the tool's memory of what has been generated and sent. Save the download back to the
        shared folder so the next person picks up where you left off.
      </p>

      <div class="ocs-ledger-actions">
        <button type="button" class="ocs-btn ocs-btn-primary" onClick={onDownload}>
          <span aria-hidden="true">⭳</span> Download updated ledger
        </button>
        <button type="button" class="ocs-btn ocs-btn-outline" onClick={() => inputRef.current?.click()}>
          <span aria-hidden="true">⤵</span> Merge another ledger…
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".json"
          multiple
          class="ocs-visually-hidden"
          onChange={(e) => {
            if (e.target.files?.length) onMergeFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <div class="ocs-table-card">
        {entries.length === 0 ? (
          <p class="ocs-empty">No logs generated yet.</p>
        ) : (
          <table class="ocs-table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Conference / Label</th>
                <th>Log file</th>
                <th>Generated</th>
                <th>Sent</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.key} class={e.sent_to_aoic ? "ocs-row-sent" : ""}>
                  <td class="ocs-col-person">
                    {e.first_name} {e.last_name}
                  </td>
                  <td class="ocs-col-label">{e.label}</td>
                  <td class="ocs-col-filename">{e.filename}</td>
                  <td>{formatDate(e.generated_at)}</td>
                  <td>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={e.sent_to_aoic}
                      class="ocs-sent-toggle"
                      disabled={e.sent_to_aoic}
                      onClick={() => onMarkSent(e.key)}
                    >
                      {e.sent_to_aoic ? `✓ Sent ${formatDate(e.sent_at)}` : "○ Mark as sent"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
