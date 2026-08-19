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

class GenkouApp {
  private documents: PracticeDocument[] = [];
  private activeDocumentId = "";
  private tool: WritingTool = "brush";
  private strokeWidth = 3.8;
  private paperCanvas: PaperCanvas | undefined;
  private undoStack: InkStroke[][] = [];
  private redoStack: InkStroke[][] = [];
  private saveTimer: number | undefined;
  private status = "Ready";
  private error = "";
  private ocrCandidates: KanjiCandidate[] = [];
  private isReferenceDrawerOpen = false;

  constructor(private readonly root: HTMLElement) {
    this.renderShell();
  }

  async start(): Promise<void> {
    try {
      this.documents = await loadDocuments();
    } catch (error) {
      this.error = error instanceof Error ? error.message : "Could not load the local library.";
    }

    if (this.documents.length === 0) {
      const document = createPracticeDocument();
      this.documents = [document];
      await saveDocument(document);
    }
    this.activeDocumentId = this.documents[0].id;
    this.bindEvents();
    this.createCanvas();
    this.renderAll();

    if (this.active.prompt.strokeOrderSvgs.length === 0) {
      void this.performLookup(false);
    }
  }

  private get active(): PracticeDocument {
    const document = this.documents.find((candidate) => candidate.id === this.activeDocumentId);
    if (!document) throw new Error("The active practice sheet is unavailable.");
    return document;
  }

  private renderShell(): void {
    this.root.innerHTML = `
      <main class="app-shell">
        <nav class="navigation-rail" aria-label="Main navigation">
          <div class="seal" aria-label="Genkou Youshi">原</div>
          <button class="nav-button is-selected" data-section="practice" type="button">
            <span class="nav-icon" aria-hidden="true">✎</span><span>Practice</span>
          </button>
          <button class="nav-button" data-section="library" type="button">
            <span class="nav-icon" aria-hidden="true">▤</span><span>Library</span>
          </button>
          <span class="nav-spacer"></span>
          <button class="nav-button install-help" type="button" aria-label="Install help">
            <span class="nav-icon" aria-hidden="true">＋</span><span>Install</span>
          </button>
        </nav>

        <section class="practice-section">
          <header class="workspace-header">
            <div>
              <p class="eyebrow">GENKOU YOUSHI</p>
              <h1>Writing practice</h1>
            </div>
            <div class="header-actions">
              <button class="icon-button undo-button" type="button" title="Undo" aria-label="Undo">↶</button>
              <button class="icon-button redo-button" type="button" title="Redo" aria-label="Redo">↷</button>
              <button class="export-button" type="button"><span aria-hidden="true">⇧</span> Export PDF</button>
              <button class="icon-button reference-toggle" type="button" title="Reference" aria-label="Toggle reference panel">▥</button>
              <span class="save-status"><i></i><span>Ready</span></span>
            </div>
          </header>

          <div class="practice-content">
            <div class="paper-workspace">
              <div class="paper-viewport" aria-label="Manuscript paper drawing area">
                <div class="paper-surface">
                  <canvas class="paper-background" aria-hidden="true"></canvas>
                  <div class="guide-layer" aria-hidden="true"></div>
                  <canvas class="ink-canvas"></canvas>
                </div>
                <div class="gesture-hint">Write with Pencil or one finger · Pinch with two fingers</div>
              </div>

              <div class="tool-shelf" role="toolbar" aria-label="Writing tools">
                <button class="tool-button is-selected" data-tool="brush" type="button"><span>✒</span> Fountain</button>
                <button class="tool-button" data-tool="pencil" type="button"><span>✎</span> Pencil</button>
                <button class="tool-button" data-tool="eraser" type="button"><span>◇</span> Eraser</button>
                <span class="tool-divider"></span>
                <label class="stroke-control">
                  <span>Line weight</span>
                  <input class="stroke-width" type="range" min="1" max="12" value="3.8" step="0.5" />
                  <output class="stroke-width-output">3.8</output>
                </label>
                <span class="tool-spacer"></span>
                <button class="clear-button" type="button" aria-label="Clear drawing" title="Clear drawing">⌫</button>
              </div>
            </div>

            <aside class="reference-panel">
              <div class="drawer-heading">
                <strong>Reference</strong>
                <button class="drawer-close" type="button" aria-label="Close reference panel">×</button>
              </div>
              <div class="reference-card kanji-card">
                <div class="card-label"><span>KANJI</span><strong class="stroke-count">Reference</strong></div>
                <div class="kanji-preview"><span>永</span></div>
                <form class="kanji-form">
                  <input class="kanji-input" type="text" inputmode="text" value="永" maxlength="2" aria-label="Kanji" />
                  <button type="submit" aria-label="Look up kanji">→</button>
                </form>
                <button class="photo-button" type="button"><span aria-hidden="true">▣</span> Recognize from photo</button>
                <input class="photo-input" type="file" accept="image/*" hidden />
                <div class="ocr-candidates" aria-live="polite"></div>
                <p class="error-message" role="alert"></p>
              </div>

              <div class="reference-card">
                <p class="card-title">PAPER GUIDES</p>
                <label class="guide-control">
                  <span><strong>Tracing guides</strong><small>Full kanji to first stroke</small></span>
                  <input class="guide-toggle" type="checkbox" checked />
                </label>
              </div>

              <div class="reference-card session-card">
                <p class="card-title">SESSION</p>
                <div><span>Paper</span><strong class="paper-size">20 × 20</strong></div>
                <div><span>Capacity</span><strong class="paper-capacity">400 字</strong></div>
                <div><span>Storage</span><strong>On this iPad</strong></div>
              </div>
            </aside>
            <div class="drawer-scrim"></div>
          </div>
        </section>

        <section class="library-section" hidden>
          <header class="library-header">
            <div><p class="eyebrow">LOCAL LIBRARY</p><h1>Practice sheets</h1></div>
            <button class="new-sheet-button" type="button">＋ New sheet</button>
          </header>
          <div class="new-sheet-picker" hidden>
            <div>
              <p class="card-title">CHOOSE PAPER</p>
              <button class="sheet-choice" data-columns="20" data-rows="20" type="button">
                <span class="sheet-icon">▦</span><strong>Standard</strong><small>20 × 20 · 400 characters</small>
              </button>
              <button class="sheet-choice" data-columns="10" data-rows="20" type="button">
                <span class="sheet-icon compact">▦</span><strong>Compact</strong><small>10 × 20 · 200 characters</small>
              </button>
            </div>
          </div>
          <div class="document-grid"></div>
        </section>

        <dialog class="install-dialog">
          <button class="dialog-close" type="button" aria-label="Close">×</button>
          <div class="seal dialog-seal">原</div>
          <h2>Install on your iPad</h2>
          <p>Open this site in Safari, tap the Share button, then choose <strong>Add to Home Screen</strong>.</p>
          <p class="dialog-note">Your sheets stay in this browser. Export important work as a backup.</p>
        </dialog>
      </main>
    `;
  }

  private bindEvents(): void {
    this.root.querySelectorAll<HTMLButtonElement>("[data-section]").forEach((button) => {
      button.addEventListener("click", () => this.showSection(button.dataset.section as Section));
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-tool]").forEach((button) => {
      button.addEventListener("click", () => this.selectTool(button.dataset.tool as WritingTool));
    });

    this.element<HTMLInputElement>(".stroke-width").addEventListener("input", (event) => {
      this.strokeWidth = Number((event.target as HTMLInputElement).value);
      this.element<HTMLOutputElement>(".stroke-width-output").value = this.strokeWidth.toFixed(1);
      this.updateCanvas();
    });
    this.element<HTMLButtonElement>(".undo-button").addEventListener("click", () => this.undo());
    this.element<HTMLButtonElement>(".redo-button").addEventListener("click", () => this.redo());
    this.element<HTMLButtonElement>(".clear-button").addEventListener("click", () => this.clearDrawing());
    this.element<HTMLButtonElement>(".export-button").addEventListener("click", () => this.exportPdf());
    this.element<HTMLFormElement>(".kanji-form").addEventListener("submit", (event) => {
      event.preventDefault();
      void this.performLookup(true);
    });
    this.element<HTMLInputElement>(".guide-toggle").addEventListener("change", (event) => {
      this.active.showsGuides = (event.target as HTMLInputElement).checked;
      this.markEdited("Guide updated");
      this.updateCanvas();
    });
    this.element<HTMLButtonElement>(".photo-button").addEventListener("click", () => {
      this.element<HTMLInputElement>(".photo-input").click();
    });
    this.element<HTMLInputElement>(".photo-input").addEventListener("change", (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file) void this.performOcr(file);
      (event.target as HTMLInputElement).value = "";
    });
    this.element<HTMLButtonElement>(".reference-toggle").addEventListener("click", () => this.toggleReference());
    this.element<HTMLButtonElement>(".drawer-close").addEventListener("click", () => this.closeReference());
    this.element<HTMLElement>(".drawer-scrim").addEventListener("click", () => this.closeReference());
    this.element<HTMLButtonElement>(".new-sheet-button").addEventListener("click", () => {
      const picker = this.element<HTMLElement>(".new-sheet-picker");
      picker.hidden = !picker.hidden;
    });
    this.root.querySelectorAll<HTMLButtonElement>(".sheet-choice").forEach((button) => {
      button.addEventListener("click", () => {
        const columns = Number(button.dataset.columns);
        const rows = Number(button.dataset.rows);
        void this.createDocument({ columns, rows });
      });
    });

    const dialog = this.element<HTMLDialogElement>(".install-dialog");
    this.element<HTMLButtonElement>(".install-help").addEventListener("click", () => dialog.showModal());
    this.element<HTMLButtonElement>(".dialog-close").addEventListener("click", () => dialog.close());
  }

  private createCanvas(): void {
    this.paperCanvas = new PaperCanvas({
      viewport: this.element(".paper-viewport"),
      surface: this.element(".paper-surface"),
      backgroundCanvas: this.element(".paper-background"),
      inkCanvas: this.element(".ink-canvas"),
      guideLayer: this.element(".guide-layer"),
      onChange: (strokes) => this.drawingChanged(strokes),
    });
    this.updateCanvas();
  }

  private drawingChanged(strokes: InkStroke[]): void {
    this.undoStack.push(structuredClone(this.active.strokes));
    if (this.undoStack.length > 100) this.undoStack.shift();
    this.redoStack = [];
    this.active.strokes = strokes;
    this.markEdited("Editing");
    this.updateUndoButtons();
  }

  private undo(): void {
    const previous = this.undoStack.pop();
    if (!previous) return;
    this.redoStack.push(structuredClone(this.active.strokes));
    this.active.strokes = previous;
    this.markEdited("Undo");
    this.updateCanvas();
    this.updateUndoButtons();
  }

  private redo(): void {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(structuredClone(this.active.strokes));
    this.active.strokes = next;
    this.markEdited("Redo");
    this.updateCanvas();
    this.updateUndoButtons();
  }

  private clearDrawing(): void {
    if (this.active.strokes.length === 0) return;
    this.undoStack.push(structuredClone(this.active.strokes));
    this.redoStack = [];
    this.active.strokes = [];
    this.markEdited("Cleared");
    this.updateCanvas();
    this.updateUndoButtons();
  }

  private selectTool(tool: WritingTool): void {
    this.tool = tool;
    this.root.querySelectorAll<HTMLElement>("[data-tool]").forEach((button) => {
      button.classList.toggle("is-selected", button.dataset.tool === tool);
    });
    this.element<HTMLElement>(".stroke-control").classList.toggle("is-disabled", tool === "eraser");
    this.updateCanvas();
  }

  private async performLookup(focusCanvas: boolean): Promise<void> {
    const input = this.element<HTMLInputElement>(".kanji-input");
    const button = this.element<HTMLButtonElement>(".kanji-form button");
    button.disabled = true;
    button.textContent = "…";
    this.error = "";
    this.renderError();
    try {
      const result = await lookupKanji(input.value);
      this.active.prompt = result;
      this.active.title = `${result.character} practice`;
      input.value = result.character;
      this.ocrCandidates = [];
      this.markEdited("Reference updated");
      this.renderReference();
      this.updateCanvas();
      if (focusCanvas) this.element<HTMLCanvasElement>(".ink-canvas").focus();
    } catch (error) {
      this.error = error instanceof Error ? error.message : "Kanji lookup failed.";
      this.renderError();
    } finally {
      button.disabled = false;
      button.textContent = "→";
    }
  }

  private async performOcr(file: File): Promise<void> {
    const button = this.element<HTMLButtonElement>(".photo-button");
    button.disabled = true;
    button.textContent = "Reading image…";
    this.error = "";
    this.ocrCandidates = [];
    this.renderError();
    this.renderOcrCandidates();
    try {
      const image = await prepareImageForOcr(file);
      this.ocrCandidates = await recognizeKanji(image);
      if (this.ocrCandidates.length === 0) throw new Error("No kanji was found. Try a tighter, clearer photo.");
      this.renderOcrCandidates();
    } catch (error) {
      this.error = error instanceof Error ? error.message : "Photo recognition failed.";
      this.renderError();
    } finally {
      button.disabled = false;
      button.innerHTML = '<span aria-hidden="true">▣</span> Recognize from photo';
    }
  }

  private renderOcrCandidates(): void {
    const container = this.element<HTMLElement>(".ocr-candidates");
    container.replaceChildren();
    if (this.ocrCandidates.length === 0) return;
    const label = document.createElement("small");
    label.textContent = "Choose a result";
    container.append(label);
    for (const candidate of this.ocrCandidates.slice(0, 5)) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = candidate.character;
      button.title = `${Math.round(candidate.confidence * 100)}% confidence`;
      button.addEventListener("click", () => {
        this.element<HTMLInputElement>(".kanji-input").value = candidate.character;
        void this.performLookup(true);
      });
      container.append(button);
    }
  }

  private markEdited(status: string): void {
    this.status = status;
    this.active.updatedAt = new Date().toISOString();
    this.scheduleSave();
    this.renderStatus();
  }

  private scheduleSave(): void {
    if (this.saveTimer !== undefined) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => void this.saveActive(), 650);
  }

  private async saveActive(): Promise<void> {
    this.saveTimer = undefined;
    this.status = "Saving";
    this.renderStatus(true);
    try {
      await saveDocument(structuredClone(this.active));
      this.documents.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      this.status = "Saved";
      this.renderLibrary();
    } catch (error) {
      this.status = "Save failed";
      this.error = error instanceof Error ? error.message : "The sheet could not be saved.";
      this.renderError();
    }
    this.renderStatus();
  }

  private async createDocument(grid: ManuscriptGrid): Promise<void> {
    await this.flushPendingSave();
    const document = createPracticeDocument(grid);
    this.documents.unshift(document);
    this.activeDocumentId = document.id;
    this.undoStack = [];
    this.redoStack = [];
    await saveDocument(document);
    this.element<HTMLElement>(".new-sheet-picker").hidden = true;
    this.showSection("practice");
    this.paperCanvas?.resetViewport();
    this.renderAll();
    void this.performLookup(false);
  }

  private async openDocument(id: string): Promise<void> {
    if (id === this.activeDocumentId) {
      this.showSection("practice");
      return;
    }
    await this.flushPendingSave();
    this.activeDocumentId = id;
    this.undoStack = [];
    this.redoStack = [];
    this.showSection("practice");
    this.paperCanvas?.resetViewport();
    this.renderAll();
  }

  private async flushPendingSave(): Promise<void> {
    if (this.saveTimer === undefined) return;
    window.clearTimeout(this.saveTimer);
    this.saveTimer = undefined;
    await this.saveActive();
  }

  private async removeDocument(id: string): Promise<void> {
    const document = this.documents.find((candidate) => candidate.id === id);
    if (!document || !window.confirm(`Delete “${document.title}”? This cannot be undone.`)) return;
    await deleteDocument(id);
    this.documents = this.documents.filter((candidate) => candidate.id !== id);
    if (this.documents.length === 0) {
      const replacement = createPracticeDocument();
      this.documents = [replacement];
      await saveDocument(replacement);
    }
    if (id === this.activeDocumentId) this.activeDocumentId = this.documents[0].id;
    this.renderLibrary();
    this.renderAll();
  }

  private showSection(section: Section): void {
    this.element<HTMLElement>(".practice-section").hidden = section !== "practice";
    this.element<HTMLElement>(".library-section").hidden = section !== "library";
    this.root.querySelectorAll<HTMLElement>("[data-section]").forEach((button) => {
      button.classList.toggle("is-selected", button.dataset.section === section);
    });
    if (section === "library") this.renderLibrary();
    if (section === "practice") requestAnimationFrame(() => this.paperCanvas?.resetViewport());
  }

  private toggleReference(): void {
    this.isReferenceDrawerOpen = !this.isReferenceDrawerOpen;
    this.root.querySelector(".practice-content")?.classList.toggle("is-reference-open", this.isReferenceDrawerOpen);
  }

  private closeReference(): void {
    this.isReferenceDrawerOpen = false;
    this.root.querySelector(".practice-content")?.classList.remove("is-reference-open");
  }

  private exportPdf(): void {
    this.paperCanvas?.resetViewport();
    this.status = "Preparing export";
    this.renderStatus(true);
    document.title = `${this.active.prompt.character || "practice"}-genkou-youshi`;
    requestAnimationFrame(() => {
      window.print();
      this.status = "Ready";
      this.renderStatus();
    });
  }

  private renderAll(): void {
    if (!this.activeDocumentId) return;
    this.element<HTMLInputElement>(".kanji-input").value = this.active.prompt.character;
    this.element<HTMLInputElement>(".guide-toggle").checked = this.active.showsGuides;
    this.renderReference();
    this.renderStatus();
    this.renderError();
    this.renderOcrCandidates();
    this.updateCanvas();
    this.updateUndoButtons();
    this.renderLibrary();
  }

  private renderReference(): void {
    const preview = this.element<HTMLElement>(".kanji-preview");
    preview.replaceChildren();
    if (this.active.prompt.strokeOrderSvgs.length > 0) {
      const image = document.createElement("img");
      image.alt = `${this.active.prompt.character} stroke order`;
      try {
        image.src = svgDataUrl(this.active.prompt.strokeOrderSvgs.at(-1) ?? "");
        preview.append(image);
      } catch {
        const character = document.createElement("span");
        character.textContent = this.active.prompt.character;
        preview.append(character);
      }
    } else {
      const character = document.createElement("span");
      character.textContent = this.active.prompt.character;
      preview.append(character);
    }
    const strokeCount = this.active.prompt.strokeOrderSvgs.length;
    this.element<HTMLElement>(".stroke-count").textContent = strokeCount > 0 ? `${strokeCount} strokes` : "Reference";
    this.element<HTMLElement>(".paper-size").textContent = `${this.active.grid.columns} × ${this.active.grid.rows}`;
    this.element<HTMLElement>(".paper-capacity").textContent = `${this.active.grid.columns * this.active.grid.rows} 字`;
  }

  private renderLibrary(): void {
    const grid = this.element<HTMLElement>(".document-grid");
    grid.replaceChildren();
    for (const practiceDocument of this.documents) {
      const card = document.createElement("article");
      card.className = "document-card";
      card.innerHTML = `
        <button class="document-open" type="button" aria-label="Open ${this.escape(practiceDocument.title)}">
          <span class="document-character">${this.escape(practiceDocument.prompt.character)}</span>
          <span><strong>${this.escape(practiceDocument.title)}</strong><small>${practiceDocument.grid.columns * practiceDocument.grid.rows} characters · ${this.formatDate(practiceDocument.updatedAt)}</small></span>
        </button>
        <button class="document-delete" type="button" aria-label="Delete ${this.escape(practiceDocument.title)}">⌫</button>
      `;
      card.querySelector(".document-open")?.addEventListener("click", () => void this.openDocument(practiceDocument.id));
      card.querySelector(".document-delete")?.addEventListener("click", () => void this.removeDocument(practiceDocument.id));
      grid.append(card);
    }
  }

  private renderStatus(saving = false): void {
    const status = this.element<HTMLElement>(".save-status");
    status.classList.toggle("is-saving", saving);
    status.querySelector("span")!.textContent = this.status;
  }

  private renderError(): void {
    this.element<HTMLElement>(".error-message").textContent = this.error;
  }

  private updateCanvas(): void {
    if (!this.paperCanvas || !this.activeDocumentId) return;
    this.paperCanvas.update({
      grid: this.active.grid,
      prompt: this.active.prompt,
      showsGuides: this.active.showsGuides,
      strokes: this.active.strokes,
      tool: this.tool,
      width: this.strokeWidth,
    });
  }

  private updateUndoButtons(): void {
    this.element<HTMLButtonElement>(".undo-button").disabled = this.undoStack.length === 0;
    this.element<HTMLButtonElement>(".redo-button").disabled = this.redoStack.length === 0;
  }

  private formatDate(value: string): string {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  }

  private escape(value: string): string {
    const element = document.createElement("span");
    element.textContent = value;
    return element.innerHTML;
  }

  private element<T extends Element = HTMLElement>(selector: string): T {
    const element = this.root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing interface element: ${selector}`);
    return element;
  }
}

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("App root is missing.");

const app = new GenkouApp(root);
void app.start();

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => void navigator.serviceWorker.register("/sw.js"));
}
