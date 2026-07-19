import { useRef, useState } from "preact/hooks";

export function Landing({ onFiles, error }) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  function openPicker() {
    inputRef.current?.click();
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openPicker();
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer?.files?.length) onFiles(e.dataTransfer.files);
  }

  return (
    <div class="ocs-landing ocs-view-enter">
      <h1>Training Log Generator</h1>
      <p class="ocs-intro">
        Turn the Presumptive Provider form export into AOIC log files, in a couple of clicks. Nothing
        is uploaded — everything happens right here on this computer.
      </p>
      <div
        class="ocs-dropzone"
        role="button"
        tabindex="0"
        aria-label="Drag the form responses file here, or press Enter to browse for a file"
        data-dragover={dragOver}
        onClick={openPicker}
        onKeyDown={handleKeyDown}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <div class="ocs-dropzone-icon" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 3v12m0-12 5 5m-5-5-5 5" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        <h2>Drag the form responses file here</h2>
        <p class="ocs-sub">Add the ledger file too, if you have one. Accepts .xlsx and .json.</p>
        <button
          type="button"
          class="ocs-btn ocs-btn-primary"
          onClick={(e) => {
            e.stopPropagation();
            openPicker();
          }}
        >
          Browse files…
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".xlsx,.json"
          class="ocs-visually-hidden"
          onChange={(e) => {
            if (e.target.files?.length) onFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <p class="ocs-reassure">Files never leave this computer. Nothing is uploaded.</p>
      </div>
      {error && <div class="ocs-error-banner">{error}</div>}
    </div>
  );
}
