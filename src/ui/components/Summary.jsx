export function Summary({ stats, initials, onInitials, onQuickGenerate, onOpenPreview, generating }) {
  const initialsValid = initials.trim().length >= 2;

  return (
    <div class="ocs-view-enter">
      <div class="ocs-view-header">
        <h2>Summary</h2>
      </div>

      <div class="ocs-stat-grid">
        <div class="ocs-stat-card">
          <div class="ocs-stat-number">{stats.total}</div>
          <div class="ocs-stat-label">submissions found</div>
        </div>
        <div class="ocs-stat-card">
          <div class="ocs-stat-number">
            <span class="ocs-dot-accent" aria-hidden="true">●</span> {stats.newCount}
          </div>
          <div class="ocs-stat-label">new (not yet generated)</div>
        </div>
        <div class="ocs-stat-card">
          <div class="ocs-stat-number">
            <span class="ocs-dot-good" aria-hidden="true">✓</span> {stats.generatedCount}
          </div>
          <div class="ocs-stat-label">already generated</div>
        </div>
        <div class="ocs-stat-card">
          <div class="ocs-stat-number">
            <span class="ocs-dot-warn" aria-hidden="true">⚠</span> {stats.warningCount}
          </div>
          <div class="ocs-stat-label">with warnings</div>
        </div>
      </div>

      <div class="ocs-initials-bar">
        <label for="ocs-initials">Your initials</label>
        <input
          id="ocs-initials"
          type="text"
          maxlength="4"
          value={initials}
          onInput={(e) => onInitials(e.target.value.toUpperCase())}
        />
        <span class="ocs-helper">Stamped on every log you generate, so runs are traceable.</span>
      </div>

      <div class="ocs-path-grid">
        <div class="ocs-path-card">
          <span class="ocs-path-badge">QUICK</span>
          <h3>Generate all new logs</h3>
          <p>Generates an AOIC log for every submission not already in the ledger, then bundles them into one download.</p>
          <button
            type="button"
            class="ocs-btn ocs-btn-primary"
            disabled={!initialsValid || stats.newCount === 0 || generating}
            onClick={onQuickGenerate}
          >
            {generating ? "Generating…" : `Generate ${stats.newCount} logs`}
          </button>
          {!initialsValid && <p class="ocs-path-warning">⚠ Enter your initials above first.</p>}
        </div>
        <div class="ocs-path-card">
          <span class="ocs-path-badge">CHOOSE</span>
          <h3>Preview &amp; choose</h3>
          <p>Review every submission, resolve warnings, and pick exactly which ones to generate.</p>
          <button type="button" class="ocs-btn ocs-btn-outline" onClick={onOpenPreview}>
            Open preview table
          </button>
        </div>
      </div>
    </div>
  );
}
