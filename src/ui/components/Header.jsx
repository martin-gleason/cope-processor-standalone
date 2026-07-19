const FONT_SCALES = [
  { value: 1, pct: "100%", glyphSize: "0.8rem", label: "Small text size" },
  { value: 1.15, pct: "115%", glyphSize: "0.98rem", label: "Medium text size" },
  { value: 1.3, pct: "130%", glyphSize: "1.16rem", label: "Large text size" }
];

const TABS = [
  { id: "summary", label: "Summary" },
  { id: "preview", label: "Preview" },
  { id: "ledger", label: "Ledger" }
];

export function Header({ loaded, view, onNavigate, fontScale, onFontScale, isDark, onToggleDark, onHelp }) {
  return (
    <header class="ocs-header">
      <div class="ocs-header-inner">
        <div class="ocs-brand">
          <div class="ocs-badge" aria-hidden="true">OCS</div>
          <div>
            <div class="ocs-brand-title">Training Log Generator</div>
            <div class="ocs-brand-sub">Office of Career Services · Cook County Juvenile Probation &amp; Court Services</div>
          </div>
        </div>
        <div class="ocs-header-controls">
          <div class="ocs-stepper" role="group" aria-label="Text size">
            {FONT_SCALES.map((s) => (
              <button
                key={s.value}
                type="button"
                aria-pressed={fontScale === s.value}
                aria-label={s.label}
                style={{ fontSize: s.glyphSize }}
                onClick={() => onFontScale(s.value)}
              >
                A
              </button>
            ))}
          </div>
          <button
            type="button"
            class="ocs-icon-btn"
            aria-pressed={isDark}
            onClick={onToggleDark}
          >
            <span aria-hidden="true">{isDark ? "☀" : "☾"}</span>
            {isDark ? "Light" : "Dark"}
          </button>
          <button type="button" class="ocs-icon-btn" onClick={onHelp} aria-haspopup="dialog">
            <span aria-hidden="true">?</span>
            Help
          </button>
        </div>
      </div>
      {loaded && (
        <nav class="ocs-nav" aria-label="Views">
          <div class="ocs-nav-inner">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                class="ocs-nav-tab"
                aria-current={view === t.id ? "page" : undefined}
                onClick={() => onNavigate(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
