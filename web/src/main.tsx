import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { render } from "solid-js/web";
import "./styles.css";
import { lookupKanji, prepareImageForOcr, recognizeKanji } from "./api";
import { deleteDocument, loadDocuments, saveDocument } from "./db";
import { PaperCanvas } from "./ink-canvas";
import { svgDataUrl } from "./svg";
import {
  createPracticeDocument,
  type InkStroke,
  type KanjiCandidate,
  type ManuscriptGrid,
  type PracticeDocument,
  type WritingTool,
} from "./models";

type Section = "practice" | "library";

function App() {
  const [documents, setDocuments] = createSignal<PracticeDocument[]>([]);
  const [activeDocumentId, setActiveDocumentId] = createSignal("");
  const [section, setSection] = createSignal<Section>("practice");
  const [tool, setTool] = createSignal<WritingTool>("brush");
  const [strokeWidth, setStrokeWidth] = createSignal(3.8);
  const [undoStack, setUndoStack] = createSignal<InkStroke[][]>([]);
  const [redoStack, setRedoStack] = createSignal<InkStroke[][]>([]);
  const [status, setStatus] = createSignal("Ready");
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal("");
  const [ocrCandidates, setOcrCandidates] = createSignal<KanjiCandidate[]>([]);
  const [referenceOpen, setReferenceOpen] = createSignal(false);
  const [newSheetPickerOpen, setNewSheetPickerOpen] = createSignal(false);
  const [lookingUp, setLookingUp] = createSignal(false);
  const [recognizing, setRecognizing] = createSignal(false);
  const [paperCanvas, setPaperCanvas] = createSignal<PaperCanvas>();

  let viewport!: HTMLDivElement;
  let surface!: HTMLDivElement;
  let backgroundCanvas!: HTMLCanvasElement;
  let inkCanvas!: HTMLCanvasElement;
  let guideLayer!: HTMLDivElement;
  let kanjiInput!: HTMLInputElement;
  let photoInput!: HTMLInputElement;
  let installDialog!: HTMLDialogElement;
  let saveTimer: number | undefined;

  const active = createMemo(() => documents().find((document) => document.id === activeDocumentId()));
  const activeGrid = createMemo(() => active()?.grid);
  const activePrompt = createMemo(() => active()?.prompt);
  const activeGuides = createMemo(() => active()?.showsGuides);
  const activeStrokes = createMemo(() => active()?.strokes);
  const referenceImage = createMemo(() => {
    const prompt = activePrompt();
    if (!prompt?.strokeOrderSvgs.length) return "";
    try {
      return svgDataUrl(prompt.strokeOrderSvgs.at(-1) ?? "");
    } catch {
      return "";
    }
  });

  function updateActive(update: Partial<PracticeDocument>): PracticeDocument | undefined {
    let updated: PracticeDocument | undefined;
    setDocuments((current) => current.map((document) => {
      if (document.id !== activeDocumentId()) return document;
      updated = { ...document, ...update };
      return updated;
    }));
    return updated;
  }

  function markEdited(label: string, update: Partial<PracticeDocument> = {}): void {
    updateActive({ ...update, updatedAt: new Date().toISOString() });
    setStatus(label);
    scheduleSave();
  }

  function scheduleSave(): void {
    if (saveTimer !== undefined) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => void saveActive(), 650);
  }

  async function saveActive(): Promise<void> {
    saveTimer = undefined;
    const document = active();
    if (!document) return;
    setStatus("Saving");
    setSaving(true);
    try {
      await saveDocument(structuredClone(document));
      setDocuments((current) => [...current].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)));
      setStatus("Saved");
    } catch (cause) {
      setStatus("Save failed");
      setError(cause instanceof Error ? cause.message : "The sheet could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function flushPendingSave(): Promise<void> {
    if (saveTimer === undefined) return;
    window.clearTimeout(saveTimer);
    saveTimer = undefined;
    await saveActive();
  }

  function drawingChanged(strokes: InkStroke[]): void {
    const document = active();
    if (!document) return;
    setUndoStack((current) => [...current.slice(-99), structuredClone(document.strokes)]);
    setRedoStack([]);
    markEdited("Editing", { strokes });
  }

  function undo(): void {
    const document = active();
    const stack = undoStack();
    const previous = stack.at(-1);
    if (!document || !previous) return;
    setUndoStack(stack.slice(0, -1));
    setRedoStack((current) => [...current, structuredClone(document.strokes)]);
    markEdited("Undo", { strokes: previous });
  }

  function redo(): void {
    const document = active();
    const stack = redoStack();
    const next = stack.at(-1);
    if (!document || !next) return;
    setRedoStack(stack.slice(0, -1));
    setUndoStack((current) => [...current, structuredClone(document.strokes)]);
    markEdited("Redo", { strokes: next });
  }

  function clearDrawing(): void {
    const document = active();
    if (!document?.strokes.length) return;
    setUndoStack((current) => [...current.slice(-99), structuredClone(document.strokes)]);
    setRedoStack([]);
    markEdited("Cleared", { strokes: [] });
  }

  async function performLookup(focusCanvas: boolean): Promise<void> {
    setLookingUp(true);
    setError("");
    try {
      const prompt = await lookupKanji(kanjiInput.value);
      markEdited("Reference updated", { prompt, title: `${prompt.character} practice` });
      setOcrCandidates([]);
      if (focusCanvas) inkCanvas.focus();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Kanji lookup failed.");
    } finally {
      setLookingUp(false);
    }
  }

  async function performOcr(file: File): Promise<void> {
    setRecognizing(true);
    setError("");
    setOcrCandidates([]);
    try {
      const image = await prepareImageForOcr(file);
      const candidates = await recognizeKanji(image);
      if (candidates.length === 0) throw new Error("No kanji was found. Try a tighter, clearer photo.");
      setOcrCandidates(candidates);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Photo recognition failed.");
    } finally {
      setRecognizing(false);
    }
  }

  async function createDocument(grid: ManuscriptGrid): Promise<void> {
    await flushPendingSave();
    const document = createPracticeDocument(grid);
    setDocuments((current) => [document, ...current]);
    setActiveDocumentId(document.id);
    setUndoStack([]);
    setRedoStack([]);
    await saveDocument(document);
    setNewSheetPickerOpen(false);
    setSection("practice");
    paperCanvas()?.resetViewport();
    void performLookup(false);
  }

  async function openDocument(id: string): Promise<void> {
    if (id !== activeDocumentId()) {
      await flushPendingSave();
      setActiveDocumentId(id);
      setUndoStack([]);
      setRedoStack([]);
    }
    setSection("practice");
    requestAnimationFrame(() => paperCanvas()?.resetViewport());
  }

  async function removeDocument(id: string): Promise<void> {
    const document = documents().find((candidate) => candidate.id === id);
    if (!document || !window.confirm(`Delete “${document.title}”? This cannot be undone.`)) return;
    await deleteDocument(id);
    let remaining = documents().filter((candidate) => candidate.id !== id);
    if (remaining.length === 0) {
      const replacement = createPracticeDocument();
      remaining = [replacement];
      await saveDocument(replacement);
    }
    setDocuments(remaining);
    if (id === activeDocumentId()) setActiveDocumentId(remaining[0].id);
  }

  function showSection(next: Section): void {
    setSection(next);
    if (next === "practice") requestAnimationFrame(() => paperCanvas()?.resetViewport());
  }

  function exportPdf(): void {
    const document = active();
    if (!document) return;
    paperCanvas()?.resetViewport();
    setStatus("Preparing export");
    setSaving(true);
    window.document.title = `${document.prompt.character || "practice"}-genkou-youshi`;
    requestAnimationFrame(() => {
      window.print();
      setStatus("Ready");
      setSaving(false);
    });
  }

  function formatDate(value: string): string {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  }

  onMount(() => {
    setPaperCanvas(new PaperCanvas({
      viewport,
      surface,
      backgroundCanvas,
      inkCanvas,
      guideLayer,
      onChange: drawingChanged,
    }));

    void (async () => {
      try {
        let stored = await loadDocuments();
        if (stored.length === 0) {
          const document = createPracticeDocument();
          stored = [document];
          await saveDocument(document);
        }
        setDocuments(stored);
        setActiveDocumentId(stored[0].id);
        if (stored[0].prompt.strokeOrderSvgs.length === 0) void performLookup(false);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not load the local library.");
      }
    })();
  });

  createEffect(() => {
    const canvas = paperCanvas();
    const grid = activeGrid();
    if (canvas && grid) canvas.update({ grid });
  });
  createEffect(() => {
    const canvas = paperCanvas();
    const prompt = activePrompt();
    if (canvas && prompt) canvas.update({ prompt });
  });
  createEffect(() => {
    const canvas = paperCanvas();
    const showsGuides = activeGuides();
    if (canvas && showsGuides !== undefined) canvas.update({ showsGuides });
  });
  createEffect(() => {
    const canvas = paperCanvas();
    const strokes = activeStrokes();
    if (canvas && strokes) canvas.update({ strokes });
  });
  createEffect(() => paperCanvas()?.update({ tool: tool(), width: strokeWidth() }));

  onCleanup(() => {
    if (saveTimer !== undefined) window.clearTimeout(saveTimer);
    paperCanvas()?.destroy();
  });

  return (
    <main class="app-shell">
      <nav class="navigation-rail" aria-label="Main navigation">
        <div class="seal" aria-label="Genkou Youshi">原</div>
        <button classList={{ "nav-button": true, "is-selected": section() === "practice" }} onClick={() => showSection("practice")} type="button">
          <span class="nav-icon" aria-hidden="true">✎</span><span>Practice</span>
        </button>
        <button classList={{ "nav-button": true, "is-selected": section() === "library" }} onClick={() => showSection("library")} type="button">
          <span class="nav-icon" aria-hidden="true">▤</span><span>Library</span>
        </button>
        <span class="nav-spacer" />
        <button class="nav-button install-help" onClick={() => installDialog.showModal()} type="button" aria-label="Install help">
          <span class="nav-icon" aria-hidden="true">＋</span><span>Install</span>
        </button>
      </nav>

      <section class="practice-section" hidden={section() !== "practice"}>
        <header class="workspace-header">
          <div><p class="eyebrow">GENKOU YOUSHI</p><h1>Writing practice</h1></div>
          <div class="header-actions">
            <button class="icon-button undo-button" onClick={undo} disabled={undoStack().length === 0} type="button" title="Undo" aria-label="Undo">↶</button>
            <button class="icon-button redo-button" onClick={redo} disabled={redoStack().length === 0} type="button" title="Redo" aria-label="Redo">↷</button>
            <button class="export-button" onClick={exportPdf} type="button"><span aria-hidden="true">⇧</span> Export PDF</button>
            <button class="icon-button reference-toggle" onClick={() => setReferenceOpen((open) => !open)} type="button" title="Reference" aria-label="Toggle reference panel">▥</button>
            <span classList={{ "save-status": true, "is-saving": saving() }}><i /><span>{status()}</span></span>
          </div>
        </header>

        <div classList={{ "practice-content": true, "is-reference-open": referenceOpen() }}>
          <div class="paper-workspace">
            <div ref={viewport} class="paper-viewport" aria-label="Manuscript paper drawing area">
              <div ref={surface} class="paper-surface">
                <canvas ref={backgroundCanvas} class="paper-background" aria-hidden="true" />
                <div ref={guideLayer} class="guide-layer" aria-hidden="true" />
                <canvas ref={inkCanvas} class="ink-canvas" />
              </div>
            </div>

            <div class="tool-shelf" role="toolbar" aria-label="Writing tools">
              <For each={[{ id: "brush", icon: "✒", label: "Fountain" }, { id: "pencil", icon: "✎", label: "Pencil" }, { id: "eraser", icon: "◇", label: "Eraser" }] as const}>
                {(item) => <button classList={{ "tool-button": true, "is-selected": tool() === item.id }} onClick={() => setTool(item.id)} type="button"><span>{item.icon}</span> {item.label}</button>}
              </For>
              <span class="tool-divider" />
              <label classList={{ "stroke-control": true, "is-disabled": tool() === "eraser" }}>
                <span>Line weight</span>
                <input class="stroke-width" onInput={(event) => setStrokeWidth(Number(event.currentTarget.value))} type="range" min="1" max="12" value={strokeWidth()} step="0.5" />
                <output class="stroke-width-output">{strokeWidth().toFixed(1)}</output>
              </label>
              <span class="tool-spacer" />
              <button class="clear-button" onClick={clearDrawing} type="button" aria-label="Clear drawing" title="Clear drawing">⌫</button>
            </div>
          </div>

          <aside class="reference-panel">
            <div class="drawer-heading"><strong>Reference</strong><button class="drawer-close" onClick={() => setReferenceOpen(false)} type="button" aria-label="Close reference panel">×</button></div>
            <div class="reference-card kanji-card">
              <div class="card-label"><span>KANJI</span><strong class="stroke-count">{activePrompt()?.strokeOrderSvgs.length ? `${activePrompt()!.strokeOrderSvgs.length} strokes` : "Reference"}</strong></div>
              <div class="kanji-preview">
                <Show when={referenceImage()} fallback={<span>{activePrompt()?.character ?? "永"}</span>}>
                  {(source) => <img src={source()} alt={`${activePrompt()?.character ?? "Kanji"} stroke order`} />}
                </Show>
              </div>
              <form class="kanji-form" onSubmit={(event) => { event.preventDefault(); void performLookup(true); }}>
                <input ref={kanjiInput} class="kanji-input" type="text" inputmode="text" value={activePrompt()?.character ?? "永"} maxlength="2" aria-label="Kanji" />
                <button type="submit" disabled={lookingUp()} aria-label="Look up kanji">{lookingUp() ? "…" : "→"}</button>
              </form>
              <button class="photo-button" onClick={() => photoInput.click()} disabled={recognizing()} type="button">
                <Show when={!recognizing()} fallback="Reading image…"><span aria-hidden="true">▣</span> Recognize from photo</Show>
              </button>
              <input ref={photoInput} class="photo-input" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void performOcr(file); event.currentTarget.value = ""; }} type="file" accept="image/*" hidden />
              <div class="ocr-candidates" aria-live="polite">
                <Show when={ocrCandidates().length > 0}><small>Choose a result</small></Show>
                <For each={ocrCandidates().slice(0, 5)}>{(candidate) => <button onClick={() => { kanjiInput.value = candidate.character; void performLookup(true); }} type="button" title={`${Math.round(candidate.confidence * 100)}% confidence`}>{candidate.character}</button>}</For>
              </div>
              <p class="error-message" role="alert">{error()}</p>
            </div>

            <div class="reference-card">
              <p class="card-title">PAPER GUIDES</p>
              <label class="guide-control">
                <span><strong>Tracing guides</strong><small>Full kanji to first stroke</small></span>
                <input class="guide-toggle" onChange={(event) => markEdited("Guide updated", { showsGuides: event.currentTarget.checked })} type="checkbox" checked={active()?.showsGuides ?? true} />
              </label>
            </div>

            <div class="reference-card session-card">
              <p class="card-title">SESSION</p>
              <div><span>Paper</span><strong class="paper-size">{active() ? `${active()!.grid.columns} × ${active()!.grid.rows}` : "20 × 20"}</strong></div>
              <div><span>Capacity</span><strong class="paper-capacity">{active() ? `${active()!.grid.columns * active()!.grid.rows} 字` : "400 字"}</strong></div>
            </div>
          </aside>
          <div class="drawer-scrim" onClick={() => setReferenceOpen(false)} />
        </div>
      </section>

      <section class="library-section" hidden={section() !== "library"}>
        <header class="library-header">
          <div><p class="eyebrow">LOCAL LIBRARY</p><h1>Practice sheets</h1></div>
          <button class="new-sheet-button" onClick={() => setNewSheetPickerOpen((open) => !open)} type="button">＋ New sheet</button>
        </header>
        <div class="new-sheet-picker" hidden={!newSheetPickerOpen()}>
          <div>
            <p class="card-title">CHOOSE PAPER</p>
            <button class="sheet-choice" onClick={() => void createDocument({ columns: 20, rows: 20 })} type="button"><span class="sheet-icon">▦</span><strong>Standard</strong><small>20 × 20 · 400 characters</small></button>
            <button class="sheet-choice" onClick={() => void createDocument({ columns: 10, rows: 20 })} type="button"><span class="sheet-icon compact">▦</span><strong>Compact</strong><small>10 × 20 · 200 characters</small></button>
          </div>
        </div>
        <div class="document-grid">
          <For each={documents()}>{(practiceDocument) => (
            <article class="document-card">
              <button class="document-open" onClick={() => void openDocument(practiceDocument.id)} type="button" aria-label={`Open ${practiceDocument.title}`}>
                <span class="document-character">{practiceDocument.prompt.character}</span>
                <span><strong>{practiceDocument.title}</strong><small>{practiceDocument.grid.columns * practiceDocument.grid.rows} characters · {formatDate(practiceDocument.updatedAt)}</small></span>
              </button>
              <button class="document-delete" onClick={() => void removeDocument(practiceDocument.id)} type="button" aria-label={`Delete ${practiceDocument.title}`}>⌫</button>
            </article>
          )}</For>
        </div>
      </section>

      <dialog ref={installDialog} class="install-dialog">
        <button class="dialog-close" onClick={() => installDialog.close()} type="button" aria-label="Close">×</button>
        <div class="seal dialog-seal">原</div>
        <h2>Install on your iPad</h2>
        <p>Open this site in Safari, tap the Share button, then choose <strong>Add to Home Screen</strong>.</p>
        <p class="dialog-note">Your sheets stay in this browser. Export important work as a backup.</p>
      </dialog>
    </main>
  );
}

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("App root is missing.");
render(() => <App />, root);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => void navigator.serviceWorker.register("/sw.js"));
}
