import { useEffect, useMemo, useState } from "preact/hooks";
import { Header } from "./components/Header.jsx";
import { Landing } from "./components/Landing.jsx";
import { Summary } from "./components/Summary.jsx";
import { Preview } from "./components/Preview.jsx";
import { Ledger } from "./components/Ledger.jsx";
import { HelpDrawer } from "./components/HelpDrawer.jsx";
import { Toast } from "./components/Toast.jsx";
import {
  buildSubmissions,
  generateLogs,
  exportTracker,
  markSent as markSentPipeline,
  recomputeStatuses,
  statFor,
  downloadBlob,
  ledgerToBlob,
  InvalidFormatError
} from "./pipeline.js";
import { FORM_YEAR } from "../shared/constants.js";
import { mergeLedgers } from "../ledger/ledger.js";

const FONT_SCALE_KEY = "ocs-fontscale";
const MODE_KEY = "ocs-mode";

function readStoredMode() {
  try {
    const stored = localStorage.getItem(MODE_KEY);
    return stored === "dark" || stored === "light" ? stored : "system";
  } catch {
    return "system";
  }
}

function readStoredFontScale() {
  try {
    const stored = Number(localStorage.getItem(FONT_SCALE_KEY));
    return [1, 1.15, 1.3].includes(stored) ? stored : 1;
  } catch {
    return 1;
  }
}

export function App() {
  const [view, setView] = useState("landing");
  const [mode, setMode] = useState(readStoredMode);
  const [systemPrefersDark, setSystemPrefersDark] = useState(
    () => typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches
  );
  const [fontScale, setFontScale] = useState(readStoredFontScale);
  const [helpOpen, setHelpOpen] = useState(false);
  const [initials, setInitials] = useState("");
  const [filterPerson, setFilterPerson] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selected, setSelected] = useState(() => new Set());
  const [expanded, setExpanded] = useState(() => new Set());
  const [subs, setSubs] = useState(null);
  const [tallRows, setTallRows] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [generating, setGenerating] = useState(false);

  const isDark = mode === "dark" || (mode === "system" && systemPrefersDark);

  useEffect(() => {
    if (typeof matchMedia === "undefined") return undefined;
    const mql = matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => setSystemPrefersDark(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (mode === "system") {
      document.documentElement.removeAttribute("data-ocs-mode");
    } else {
      document.documentElement.setAttribute("data-ocs-mode", mode);
    }
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch {
      /* localStorage unavailable (private browsing); mode still works this session */
    }
  }, [mode]);

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontScale * 100}%`;
    try {
      localStorage.setItem(FONT_SCALE_KEY, String(fontScale));
    } catch {
      /* localStorage unavailable; scale still applies this session */
    }
  }, [fontScale]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  const stats = useMemo(() => (subs ? statFor(subs) : { total: 0, newCount: 0, generatedCount: 0, warningCount: 0 }), [subs]);

  async function handleFiles(fileList) {
    setError("");
    const files = Array.from(fileList);
    const formsFile = files.find((f) => f.name.toLowerCase().endsWith(".xlsx"));
    const ledgerFiles = files.filter((f) => f.name.toLowerCase().endsWith(".json"));

    if (!formsFile) {
      setError("No .xlsx form export was found among the dropped files. Drag the Forms export in — the ledger file is optional.");
      return;
    }

    try {
      const ledgerObjects = await Promise.all(
        ledgerFiles.map(async (f) => JSON.parse(await f.text()))
      );
      const result = await buildSubmissions(formsFile, ledgerObjects);
      setSubs(result.subs);
      setTallRows(result.tallRows);
      setLedger(result.ledger);
      setSelected(new Set());
      setExpanded(new Set());
      setFilterPerson("all");
      setFilterStatus("all");
      setView("summary");
    } catch (e) {
      if (e instanceof InvalidFormatError) {
        setError(e.message);
      } else if (e instanceof SyntaxError) {
        setError("One of the ledger files isn't valid JSON. Check it wasn't corrupted or renamed.");
      } else {
        setError(`Something went wrong reading these files: ${e.message}`);
      }
    }
  }

  function applyGenerationResult({ zipBlob, zipFilename, updatedLedger }) {
    downloadBlob(zipBlob, zipFilename);
    downloadBlob(ledgerToBlob(updatedLedger), `AOIC_Ledger_${FORM_YEAR}.json`);
    setLedger(updatedLedger);
    setSubs((prev) => recomputeStatuses(prev, updatedLedger));
  }

  async function handleQuickGenerate() {
    if (!subs || initials.trim().length < 2) return;
    const newSubs = subs.filter((s) => s.status === "new");
    if (newSubs.length === 0) return;
    setGenerating(true);
    try {
      const result = await generateLogs(newSubs, ledger, initials.trim());
      applyGenerationResult(result);
      setView("ledger");
      setToast(`Generated ${newSubs.length} log${newSubs.length === 1 ? "" : "s"} as ${initials.trim()}.`);
    } catch (e) {
      setToast(`Generation failed: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  }

  async function handleGenerateSelected() {
    if (!subs || initials.trim().length < 2) {
      setToast("Enter your initials on the Summary tab first.");
      return;
    }
    const chosen = subs.filter((s) => s.status === "new" && selected.has(s.id));
    if (chosen.length === 0) return;
    setGenerating(true);
    try {
      const result = await generateLogs(chosen, ledger, initials.trim());
      applyGenerationResult(result);
      setSelected(new Set());
      setView("ledger");
      setToast(`Generated ${chosen.length} log${chosen.length === 1 ? "" : "s"} as ${initials.trim()}.`);
    } catch (e) {
      setToast(`Generation failed: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  }

  function handleToggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleToggleSelectAll(ids, shouldSelect) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (shouldSelect) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function handleToggleExpanded(id) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleDownloadLedger() {
    if (!ledger) return;
    downloadBlob(ledgerToBlob(ledger), `AOIC_Ledger_${FORM_YEAR}.json`);
    setToast("Ledger downloaded.");
  }

  async function handleMergeFiles(fileList) {
    try {
      const objects = await Promise.all(Array.from(fileList).map(async (f) => JSON.parse(await f.text())));
      const merged = mergeLedgers([ledger, ...objects]);
      setLedger(merged);
      if (subs) setSubs(recomputeStatuses(subs, merged));
      setToast("Ledgers merged. Download the updated file and save it back to the shared folder.");
    } catch (e) {
      setToast(`Could not merge that ledger: ${e.message}`);
    }
  }

  function handleMarkSent(key) {
    if (!ledger) return;
    const updated = markSentPipeline(ledger, key, initials.trim() || "??");
    setLedger(updated);
    if (subs) setSubs(recomputeStatuses(subs, updated));
    setToast("Marked as sent.");
  }

  async function handleExportTracker() {
    if (!tallRows || !subs) return;
    const { workbook, filename } = exportTracker(tallRows, subs);
    const buffer = await workbook.xlsx.writeBuffer();
    downloadBlob(
      new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      filename
    );
    setToast("Master Tracker exported.");
  }

  return (
    <>
      <Header
        loaded={subs !== null}
        view={view}
        onNavigate={setView}
        fontScale={fontScale}
        onFontScale={setFontScale}
        isDark={isDark}
        onToggleDark={() => setMode(isDark ? "light" : "dark")}
        onHelp={() => setHelpOpen(true)}
      />
      <main class="ocs-main">
        {view === "landing" && <Landing onFiles={handleFiles} error={error} />}
        {view === "summary" && subs && (
          <Summary
            stats={stats}
            initials={initials}
            onInitials={setInitials}
            onQuickGenerate={handleQuickGenerate}
            onOpenPreview={() => setView("preview")}
            generating={generating}
          />
        )}
        {view === "preview" && subs && (
          <Preview
            subs={subs}
            filterPerson={filterPerson}
            filterStatus={filterStatus}
            onFilterPerson={setFilterPerson}
            onFilterStatus={setFilterStatus}
            selected={selected}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
            expanded={expanded}
            onToggleExpanded={handleToggleExpanded}
            onGenerateSelected={handleGenerateSelected}
            onExportTracker={handleExportTracker}
            generating={generating}
          />
        )}
        {view === "ledger" && (
          <Ledger
            ledger={ledger}
            onDownload={handleDownloadLedger}
            onMergeFiles={handleMergeFiles}
            onMarkSent={handleMarkSent}
          />
        )}
      </main>
      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} />
      <Toast message={toast} />
    </>
  );
}
