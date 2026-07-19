import { useEffect } from "preact/hooks";

export function HelpDrawer({ open, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div class="ocs-drawer-backdrop" onClick={onClose} />
      <div class="ocs-drawer" role="dialog" aria-modal="true" aria-labelledby="ocs-help-title">
        <div class="ocs-drawer-header">
          <h2 id="ocs-help-title">Help</h2>
          <button type="button" class="ocs-drawer-close" onClick={onClose} aria-label="Close help">
            ×
          </button>
        </div>
        <div class="ocs-drawer-body">
          <h3>What this tool does</h3>
          <p>
            Turns the Presumptive Provider form export into AOIC log files, one per submission, and keeps a
            ledger of what's been generated and sent so nothing gets duplicated.
          </p>

          <h3>Sync procedure</h3>
          <ol>
            <li>The ledger lives in one shared folder — the same Teams/shared-drive spot as this tool.</li>
            <li>Before you run the tool: get the current ledger file from the shared folder.</li>
            <li>Drag both the form export and that ledger file onto the tool together.</li>
            <li>After you run the tool: save the downloaded ledger back to the shared folder, replacing the old one.</li>
            <li>
              If you forgot and now there are two ledger files: drag both into the tool. It merges them
              automatically — save that merged file back to the shared folder.
            </li>
            <li>Your initials are stamped on everything you generate, so a run can always be traced back to you.</li>
          </ol>

          <h3>Manual path — if the tool is unavailable</h3>
          <p>
            Open the Forms export in Excel, copy each submission's sessions by hand into the blank AOIC
            template, and note what you did in the ledger JSON with a text editor (a key of
            <code> {"{form_year}#{submission_id}"}</code>, marked <code>sent_to_aoic: false</code> until it
            actually goes out).
          </p>

          <details class="ocs-dev-details">
            <summary>Developer handoff notes</summary>
            <ul>
              <li>Tokens from <code>ocs-theme.css</code> verbatim, no hardcoded hex; local accent/font delta in <code>theme-override.css</code>.</li>
              <li>Dark mode: <code>html[data-ocs-mode]</code>, defaults to OS preference, persisted to <code>localStorage['ocs-mode']</code>.</li>
              <li>Text size: <code>documentElement.style.fontSize</code> at 100/115/130%, persisted to <code>localStorage['ocs-fontscale']</code>.</li>
              <li>Locked (do not redesign): AOIC xlsx layout, filename convention, ledger schema, processing rules — see the spec.</li>
              <li>No network, no login, no accounts. Initials are the only identity input.</li>
            </ul>
          </details>
        </div>
      </div>
    </>
  );
}
