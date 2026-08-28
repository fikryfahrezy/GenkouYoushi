import { createID } from "./id";
import type { InkPoint, InkStroke, ManuscriptGrid, PracticePrompt, WritingTool } from "./models";
import { svgDataUrl } from "./svg";

interface PaperCanvasOptions {
  viewport: HTMLElement;
  surface: HTMLElement;
  backgroundCanvas: HTMLCanvasElement;
  inkCanvas: HTMLCanvasElement;
  guideLayer: HTMLElement;
  onChange: (strokes: InkStroke[]) => void;
}

interface PaperState {
  grid: ManuscriptGrid;
  prompt: PracticePrompt;
  showsGuides: boolean;
  strokes: InkStroke[];
  tool: WritingTool;
  width: number;
}

interface TouchLocation {
  x: number;
  y: number;
}

const GRID_INSET = 34;
const HEADER_HEIGHT = 14;
const HEADER_SPACING = 8;
const COLUMN_GAP_RATIO = 0.18;
const MAX_CANVAS_DIMENSION = 8192;
const MAX_CANVAS_PIXELS = 24_000_000;
const ZOOM_RENDER_DELAY = 120;
const ERASER_WIDTH_MULTIPLIER = 2.8;

export class PaperCanvas {
  private readonly viewport: HTMLElement;
  private readonly surface: HTMLElement;
  private readonly backgroundCanvas: HTMLCanvasElement;
  private readonly inkCanvas: HTMLCanvasElement;
  private readonly guideLayer: HTMLElement;
  private readonly inkContext: CanvasRenderingContext2D;
  private readonly onChange: (strokes: InkStroke[]) => void;
  private readonly resizeObserver: ResizeObserver;
  private state: PaperState;
  private activeStroke: InkStroke | undefined;
  private activeStrokePointer: number | undefined;
  private activeStrokeWasTouch = false;
  private eraserChanged = false;
  private lastEraserPoint: InkPoint | undefined;
  private strokesBeforeErase: InkStroke[] | undefined;
  private touches = new Map<number, TouchLocation>();
  private gestureStart:
    | { distance: number; center: TouchLocation; scale: number; offsetX: number; offsetY: number }
    | undefined;
  private panStart:
    | { pointerId: number; x: number; y: number; offsetX: number; offsetY: number }
    | undefined;
  private pointerInside = false;
  private spacePressed = false;
  private scale = 1;
  private renderedScale = 1;
  private offsetX = 0;
  private offsetY = 0;
  private cssWidth = 1;
  private cssHeight = 1;
  private basePixelRatio = 1;
  private pixelRatio = 1;
  private zoomRenderTimer: ReturnType<typeof setTimeout> | undefined;
  private pendingTouchZoomCommit = false;

  constructor(options: PaperCanvasOptions) {
    this.viewport = options.viewport;
    this.surface = options.surface;
    this.backgroundCanvas = options.backgroundCanvas;
    this.inkCanvas = options.inkCanvas;
    this.guideLayer = options.guideLayer;
    this.onChange = options.onChange;
    const context = this.inkCanvas.getContext("2d");
    if (!context) throw new Error("Canvas drawing is unavailable in this browser.");
    this.inkContext = context;
    this.state = {
      grid: { columns: 20, rows: 20 },
      prompt: { character: "永", strokeOrderSvgs: [] },
      showsGuides: true,
      strokes: [],
      tool: "brush",
      width: 3.8,
    };

    this.inkCanvas.addEventListener("pointerdown", this.handlePointerDown);
    this.inkCanvas.addEventListener("pointermove", this.handlePointerMove);
    this.inkCanvas.addEventListener("pointerup", this.handlePointerUp);
    this.inkCanvas.addEventListener("pointercancel", this.handlePointerUp);
    this.inkCanvas.addEventListener("pointerenter", this.handlePointerEnter);
    this.inkCanvas.addEventListener("pointerleave", this.handlePointerLeave);
    this.inkCanvas.addEventListener("contextmenu", (event) => event.preventDefault());
    this.viewport.addEventListener("wheel", this.handleWheel, { passive: false });
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("blur", this.handleWindowBlur);

    this.resizeObserver = new ResizeObserver(() => this.layout());
    this.resizeObserver.observe(this.viewport);
    this.layout();
  }

  update(next: Partial<PaperState>): void {
    const gridChanged = next.grid !== undefined && (
      next.grid.columns !== this.state.grid.columns || next.grid.rows !== this.state.grid.rows
    );
    const paperChanged = gridChanged || next.prompt !== undefined || next.showsGuides !== undefined;
    const strokesChanged = next.strokes !== undefined;
    this.state = {
      ...this.state,
      ...next,
      ...(next.strokes ? { strokes: structuredClone(next.strokes) } : {}),
    };

    if (gridChanged) {
      this.resetViewport();
      this.layout();
    }
    if (paperChanged) {
      this.drawPaper();
      this.renderGuides();
    }
    if (strokesChanged) this.redrawInk();
  }

  resetViewport(): void {
    this.touches.clear();
    this.gestureStart = undefined;
    this.pendingTouchZoomCommit = false;
    this.surface.classList.remove("is-zooming");
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.commitZoom();
  }

  destroy(): void {
    if (this.zoomRenderTimer !== undefined) clearTimeout(this.zoomRenderTimer);
    this.surface.classList.remove("is-zooming");
    this.resizeObserver.disconnect();
    this.inkCanvas.removeEventListener("pointerdown", this.handlePointerDown);
    this.inkCanvas.removeEventListener("pointermove", this.handlePointerMove);
    this.inkCanvas.removeEventListener("pointerup", this.handlePointerUp);
    this.inkCanvas.removeEventListener("pointercancel", this.handlePointerUp);
    this.inkCanvas.removeEventListener("pointerenter", this.handlePointerEnter);
    this.inkCanvas.removeEventListener("pointerleave", this.handlePointerLeave);
    this.viewport.removeEventListener("wheel", this.handleWheel);
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("blur", this.handleWindowBlur);
  }

  private layout(): void {
    const availableWidth = Math.max(this.viewport.clientWidth - 42, 220);
    const availableHeight = Math.max(this.viewport.clientHeight - 42, 280);
    const aspect = this.gridAspectRatio();
    const horizontalInset = GRID_INSET * 2;
    const verticalFixed = GRID_INSET * 2 + HEADER_HEIGHT + HEADER_SPACING;
    const heightForWidth = verticalFixed + Math.max(availableWidth - horizontalInset, 40) / aspect;

    if (heightForWidth <= availableHeight) {
      this.cssWidth = availableWidth;
      this.cssHeight = heightForWidth;
    } else {
      const gridWidth = Math.max(availableHeight - verticalFixed, 40) * aspect;
      this.cssWidth = Math.min(gridWidth + horizontalInset, availableWidth);
      this.cssHeight = availableHeight;
    }

    this.basePixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.renderedScale = this.scale;
    this.pixelRatio = this.pixelRatioForScale(this.scale);
    this.sizeSurface();
    this.sizeCanvas(this.backgroundCanvas);
    this.sizeCanvas(this.inkCanvas);
    this.drawPaper();
    this.renderGuides();
    this.redrawInk();
    this.clampOffset();
    this.applyTransform();
  }

  private sizeSurface(): void {
    this.surface.style.width = `${this.cssWidth * this.renderedScale}px`;
    this.surface.style.height = `${this.cssHeight * this.renderedScale}px`;
  }

  private sizeCanvas(canvas: HTMLCanvasElement): void {
    canvas.width = Math.round(this.cssWidth * this.pixelRatio);
    canvas.height = Math.round(this.cssHeight * this.pixelRatio);
    canvas.style.width = `${this.cssWidth * this.renderedScale}px`;
    canvas.style.height = `${this.cssHeight * this.renderedScale}px`;
  }

  private pixelRatioForScale(scale: number): number {
    const width = Math.max(this.cssWidth, 1);
    const height = Math.max(this.cssHeight, 1);
    const dimensionLimit = Math.min(MAX_CANVAS_DIMENSION / width, MAX_CANVAS_DIMENSION / height);
    const areaLimit = Math.sqrt(MAX_CANVAS_PIXELS / (width * height));
    return Math.max(1, Math.min(this.basePixelRatio * scale, dimensionLimit, areaLimit));
  }

  private commitZoom(): void {
    const nextPixelRatio = this.pixelRatioForScale(this.scale);
    const scaleChanged = Math.abs(this.scale - this.renderedScale) >= 0.001;
    const pixelRatioChanged = Math.abs(nextPixelRatio - this.pixelRatio) >= 0.01;
    if (!scaleChanged && !pixelRatioChanged) {
      this.applyTransform();
      return;
    }

    this.renderedScale = this.scale;
    this.pixelRatio = nextPixelRatio;
    this.sizeSurface();
    this.sizeCanvas(this.backgroundCanvas);
    this.sizeCanvas(this.inkCanvas);
    this.drawPaper();
    this.renderGuides();
    this.redrawInk();
    this.applyTransform();
  }

  private scheduleZoomRerasterization(): void {
    if (this.zoomRenderTimer !== undefined) clearTimeout(this.zoomRenderTimer);
    this.zoomRenderTimer = setTimeout(() => {
      this.zoomRenderTimer = undefined;
      this.commitZoom();
    }, ZOOM_RENDER_DELAY);
  }

  private drawPaper(): void {
    const context = this.backgroundCanvas.getContext("2d");
    if (!context) return;
    context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    context.clearRect(0, 0, this.cssWidth, this.cssHeight);

    const gradient = context.createLinearGradient(0, 0, this.cssWidth, this.cssHeight);
    gradient.addColorStop(0, "#fbf7e8");
    gradient.addColorStop(1, "#f8f2df");
    context.fillStyle = gradient;
    context.fillRect(0, 0, this.cssWidth, this.cssHeight);

    context.strokeStyle = "rgba(31, 28, 23, 0.018)";
    context.lineWidth = 0.5;
    for (let y = 0, index = 0; y < this.cssHeight; y += 11, index += 1) {
      context.beginPath();
      context.moveTo(0, y + (index % 3));
      context.lineTo(this.cssWidth, y + 1.5 + (index % 3));
      context.stroke();
    }

    const grid = this.gridRect();
    context.fillStyle = "rgba(76, 97, 78, 0.8)";
    context.font = "600 11px ui-serif, Georgia, serif";
    context.textBaseline = "middle";
    context.fillText("原 稿 用 紙", grid.x, grid.y - HEADER_SPACING - HEADER_HEIGHT / 2);
    context.font = "500 9px ui-rounded, system-ui, sans-serif";
    context.textAlign = "right";
    context.fillText(
      `${this.state.grid.columns * this.state.grid.rows} 字 ・ 縦書き`,
      grid.x + grid.width,
      grid.y - HEADER_SPACING - HEADER_HEIGHT / 2,
    );
    context.textAlign = "start";

    const layout = this.cellLayout();
    context.strokeStyle = "rgba(107, 135, 110, 0.8)";
    context.lineWidth = 0.72;
    for (let column = 0; column < this.state.grid.columns; column += 1) {
      const x = layout.x + column * (layout.cell + layout.gap);
      context.strokeRect(x, layout.y, layout.cell, layout.cell * this.state.grid.rows);
      context.beginPath();
      for (let row = 1; row < this.state.grid.rows; row += 1) {
        const y = layout.y + row * layout.cell;
        context.moveTo(x, y);
        context.lineTo(x + layout.cell, y);
      }
      context.stroke();
    }

    context.strokeStyle = "rgba(107, 135, 110, 0.25)";
    context.lineWidth = 0.38;
    context.beginPath();
    for (let column = 0; column < this.state.grid.columns; column += 1) {
      for (let row = 0; row < this.state.grid.rows; row += 1) {
        const x = layout.x + column * (layout.cell + layout.gap);
        const y = layout.y + row * layout.cell;
        const inset = layout.cell * 0.08;
        context.moveTo(x + layout.cell / 2, y + inset);
        context.lineTo(x + layout.cell / 2, y + layout.cell - inset);
        context.moveTo(x + inset, y + layout.cell / 2);
        context.lineTo(x + layout.cell - inset, y + layout.cell / 2);
      }
    }
    context.stroke();
  }

  private renderGuides(): void {
    this.guideLayer.replaceChildren();
    if (!this.state.showsGuides) return;
    const layout = this.cellLayout();
    const scale = this.renderedScale;

    if (this.state.prompt.strokeOrderSvgs.length === 0) {
      const opacities = [0.3, 0.21, 0.13];
      for (let row = 0; row < opacities.length; row += 1) {
        const guide = document.createElement("span");
        guide.className = "text-guide";
        guide.textContent = this.state.prompt.character;
        guide.style.left = `${(layout.x + (this.state.grid.columns - 1) * (layout.cell + layout.gap)) * scale}px`;
        guide.style.top = `${(layout.y + row * layout.cell) * scale}px`;
        guide.style.width = `${layout.cell * scale}px`;
        guide.style.height = `${layout.cell * scale}px`;
        guide.style.fontSize = `${layout.cell * 0.68 * scale}px`;
        guide.style.opacity = String(opacities[row]);
        this.guideLayer.append(guide);
      }
      return;
    }

    const visible = this.state.prompt.strokeOrderSvgs
      .slice()
      .reverse()
      .slice(0, this.state.grid.columns * this.state.grid.rows);
    visible.forEach((svg, index) => {
      const columnOffset = Math.floor(index / this.state.grid.rows);
      const column = Math.max(this.state.grid.columns - 1 - columnOffset, 0);
      const row = index % this.state.grid.rows;
      const inset = layout.cell * 0.08;
      const image = document.createElement("img");
      image.className = "stroke-guide";
      image.alt = "";
      image.draggable = false;
      image.style.left = `${(layout.x + column * (layout.cell + layout.gap) + inset) * scale}px`;
      image.style.top = `${(layout.y + row * layout.cell + inset) * scale}px`;
      image.style.width = `${(layout.cell - inset * 2) * scale}px`;
      image.style.height = `${(layout.cell - inset * 2) * scale}px`;
      image.addEventListener("error", () => {
        const fallback = document.createElement("span");
        fallback.className = "text-guide";
        fallback.textContent = this.state.prompt.character;
        fallback.style.left = image.style.left;
        fallback.style.top = image.style.top;
        fallback.style.width = image.style.width;
        fallback.style.height = image.style.height;
        fallback.style.fontSize = `${layout.cell * 0.58 * scale}px`;
        fallback.style.opacity = "0.2";
        image.replaceWith(fallback);
      }, { once: true });
      this.guideLayer.append(image);
      try {
        image.src = svgDataUrl(svg);
      } catch {
        image.dispatchEvent(new Event("error"));
      }
    });
  }

  private redrawInk(): void {
    const context = this.inkContext;
    context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    context.clearRect(0, 0, this.cssWidth, this.cssHeight);
    for (const stroke of this.state.strokes) this.renderStroke(stroke);
  }

  private renderStroke(stroke: InkStroke): void {
    if (stroke.points.length === 0) return;
    if (stroke.points.length === 1) {
      this.renderDot(stroke, stroke.points[0]);
      return;
    }
    for (let index = 1; index < stroke.points.length; index += 1) {
      this.renderSegment(stroke, stroke.points[index - 1], stroke.points[index]);
    }
  }

  private renderSegment(stroke: InkStroke, from: InkPoint, to: InkPoint): void {
    const context = this.inkContext;
    const x1 = from.x * this.cssWidth;
    const y1 = from.y * this.cssHeight;
    const x2 = to.x * this.cssWidth;
    const y2 = to.y * this.cssHeight;
    const pressure = (this.normalizedPressure(from.pressure) + this.normalizedPressure(to.pressure)) / 2;
    context.save();
    context.lineCap = "round";
    context.lineJoin = "round";

    if (stroke.tool === "eraser") {
      context.globalCompositeOperation = "destination-out";
      context.globalAlpha = 1;
      context.strokeStyle = "#000";
      context.lineWidth = stroke.width * ERASER_WIDTH_MULTIPLIER;
      this.strokeLine(context, x1, y1, x2, y2);
    } else if (stroke.tool === "pencil") {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const length = Math.max(Math.hypot(dx, dy), 0.001);
      const nx = -dy / length;
      const ny = dx / length;
      context.globalCompositeOperation = "source-over";
      context.strokeStyle = "#575147";
      context.lineWidth = Math.max(0.55, stroke.width * (0.42 + pressure * 0.52));
      for (let layer = -1; layer <= 1; layer += 1) {
        const jitter = layer * stroke.width * 0.14;
        context.globalAlpha = 0.13 + pressure * 0.11;
        this.strokeLine(context, x1 + nx * jitter, y1 + ny * jitter, x2 + nx * jitter, y2 + ny * jitter);
      }
    } else {
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const nibFactor = 0.52 + Math.abs(Math.sin(angle + Math.PI * 0.22)) * 0.5;
      context.globalCompositeOperation = "source-over";
      context.globalAlpha = 0.94;
      context.strokeStyle = "#1f1c17";
      context.lineWidth = Math.max(0.7, stroke.width * (0.38 + pressure * 0.86) * nibFactor);
      this.strokeLine(context, x1, y1, x2, y2);
    }
    context.restore();
  }

  private renderDot(stroke: InkStroke, point: InkPoint): void {
    const context = this.inkContext;
    const pressure = this.normalizedPressure(point.pressure);
    context.save();
    context.beginPath();
    context.arc(
      point.x * this.cssWidth,
      point.y * this.cssHeight,
      Math.max(0.8, stroke.width * (0.3 + pressure * 0.45)),
      0,
      Math.PI * 2,
    );
    if (stroke.tool === "eraser") {
      context.globalCompositeOperation = "destination-out";
      context.fillStyle = "#000";
    } else {
      context.globalAlpha = stroke.tool === "pencil" ? 0.32 : 0.94;
      context.fillStyle = stroke.tool === "pencil" ? "#575147" : "#1f1c17";
    }
    context.fill();
    context.restore();
  }

  private strokeLine(
    context: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ): void {
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.stroke();
  }

  private handlePointerDown = (event: PointerEvent): void => {
    event.preventDefault();
    this.inkCanvas.setPointerCapture(event.pointerId);
    if (event.pointerType === "mouse" && (event.button === 1 || (event.button === 0 && this.spacePressed))) {
      this.panStart = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        offsetX: this.offsetX,
        offsetY: this.offsetY,
      };
      this.inkCanvas.classList.add("is-panning");
      return;
    }
    if (event.pointerType === "touch") {
      this.touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (this.touches.size >= 2) {
        this.cancelTouchStroke();
        this.pendingTouchZoomCommit = false;
        this.surface.classList.add("is-zooming");
        this.beginGesture();
        return;
      }
    }

    if (this.gestureStart) return;
    this.activeStrokePointer = event.pointerId;
    this.activeStrokeWasTouch = event.pointerType === "touch";
    if (this.state.tool === "eraser") {
      this.strokesBeforeErase = structuredClone(this.state.strokes);
      this.lastEraserPoint = this.pointFromEvent(event);
      this.eraseStrokesBetween(this.lastEraserPoint, this.lastEraserPoint);
      return;
    }
    this.activeStroke = {
      id: createID(),
      tool: this.state.tool,
      width: this.state.width,
      points: [this.pointFromEvent(event)],
    };
    this.state.strokes.push(this.activeStroke);
  };

  private handlePointerMove = (event: PointerEvent): void => {
    event.preventDefault();
    if (event.pointerId === this.panStart?.pointerId) {
      this.offsetX = this.panStart.offsetX + event.clientX - this.panStart.x;
      this.offsetY = this.panStart.offsetY + event.clientY - this.panStart.y;
      this.clampOffset();
      this.applyTransform();
      return;
    }
    if (event.pointerType === "touch" && this.touches.has(event.pointerId)) {
      this.touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (this.gestureStart && this.touches.size >= 2) {
        this.updateGesture();
        return;
      }
    }
    if (event.pointerId !== this.activeStrokePointer) return;

    const events = typeof event.getCoalescedEvents === "function" ? event.getCoalescedEvents() : [event];
    if (this.state.tool === "eraser") {
      for (const sample of events.length > 0 ? events : [event]) {
        const next = this.pointFromEvent(sample);
        const previous = this.lastEraserPoint ?? next;
        this.eraseStrokesBetween(previous, next);
        this.lastEraserPoint = next;
      }
      return;
    }
    if (!this.activeStroke) return;
    for (const sample of events.length > 0 ? events : [event]) {
      const next = this.pointFromEvent(sample);
      const previous = this.activeStroke.points.at(-1);
      if (!previous || Math.hypot(next.x - previous.x, next.y - previous.y) < 0.00015) continue;
      this.activeStroke.points.push(next);
      this.renderSegment(this.activeStroke, previous, next);
    }
  };

  private handlePointerUp = (event: PointerEvent): void => {
    event.preventDefault();
    if (event.pointerId === this.panStart?.pointerId) {
      this.panStart = undefined;
      this.inkCanvas.classList.remove("is-panning");
      return;
    }
    const wasZoomGesture = this.gestureStart !== undefined;
    if (event.pointerType === "touch") this.touches.delete(event.pointerId);
    if (event.pointerId === this.activeStrokePointer) this.finishStroke();
    if (this.touches.size < 2) {
      this.gestureStart = undefined;
      if (wasZoomGesture) this.pendingTouchZoomCommit = true;
    }
    if (this.touches.size === 0 && this.pendingTouchZoomCommit) {
      this.pendingTouchZoomCommit = false;
      this.surface.classList.remove("is-zooming");
      this.commitZoom();
    }
  };

  private finishStroke(): void {
    if (this.eraserChanged) {
      this.onChange(structuredClone(this.state.strokes));
    } else if (this.activeStroke && this.activeStroke.tool !== "eraser" && this.activeStroke.points.length > 0) {
      this.onChange(structuredClone(this.state.strokes));
    }
    this.activeStroke = undefined;
    this.activeStrokePointer = undefined;
    this.activeStrokeWasTouch = false;
    this.eraserChanged = false;
    this.lastEraserPoint = undefined;
    this.strokesBeforeErase = undefined;
  }

  private cancelTouchStroke(): void {
    if (!this.activeStrokeWasTouch || this.activeStrokePointer === undefined) return;
    if (this.strokesBeforeErase) {
      this.state.strokes = this.strokesBeforeErase;
    } else if (this.activeStroke) {
      this.state.strokes = this.state.strokes.filter((stroke) => stroke.id !== this.activeStroke?.id);
    }
    this.activeStroke = undefined;
    this.activeStrokePointer = undefined;
    this.activeStrokeWasTouch = false;
    this.eraserChanged = false;
    this.lastEraserPoint = undefined;
    this.strokesBeforeErase = undefined;
    this.redrawInk();
  }

  private eraseStrokesBetween(from: InkPoint, to: InkPoint): void {
    const eraserRadius = this.state.width * ERASER_WIDTH_MULTIPLIER / 2;
    const beforeCount = this.state.strokes.length;
    this.state.strokes = this.state.strokes.filter((stroke) => (
      stroke.tool === "eraser" || !this.strokeIntersectsEraser(stroke, from, to, eraserRadius)
    ));
    if (this.state.strokes.length !== beforeCount) {
      this.eraserChanged = true;
      this.redrawInk();
    }
  }

  private strokeIntersectsEraser(
    stroke: InkStroke,
    eraserFrom: InkPoint,
    eraserTo: InkPoint,
    eraserRadius: number,
  ): boolean {
    if (stroke.points.length === 0) return false;
    const from = this.canvasPoint(eraserFrom);
    const to = this.canvasPoint(eraserTo);
    const hitDistance = eraserRadius + stroke.width;
    if (stroke.points.length === 1) {
      return this.pointToSegmentDistance(this.canvasPoint(stroke.points[0]), from, to) <= hitDistance;
    }
    for (let index = 1; index < stroke.points.length; index += 1) {
      const strokeFrom = this.canvasPoint(stroke.points[index - 1]);
      const strokeTo = this.canvasPoint(stroke.points[index]);
      if (this.segmentDistance(from, to, strokeFrom, strokeTo) <= hitDistance) return true;
    }
    return false;
  }

  private canvasPoint(point: InkPoint): TouchLocation {
    return { x: point.x * this.cssWidth, y: point.y * this.cssHeight };
  }

  private segmentDistance(a: TouchLocation, b: TouchLocation, c: TouchLocation, d: TouchLocation): number {
    if (a.x === b.x && a.y === b.y) return this.pointToSegmentDistance(a, c, d);
    if (c.x === d.x && c.y === d.y) return this.pointToSegmentDistance(c, a, b);
    if (this.segmentsIntersect(a, b, c, d)) return 0;
    return Math.min(
      this.pointToSegmentDistance(a, c, d),
      this.pointToSegmentDistance(b, c, d),
      this.pointToSegmentDistance(c, a, b),
      this.pointToSegmentDistance(d, a, b),
    );
  }

  private pointToSegmentDistance(point: TouchLocation, from: TouchLocation, to: TouchLocation): number {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (dx === 0 && dy === 0) return Math.hypot(point.x - from.x, point.y - from.y);
    const projection = Math.min(Math.max(
      ((point.x - from.x) * dx + (point.y - from.y) * dy) / (dx * dx + dy * dy),
      0,
    ), 1);
    return Math.hypot(point.x - (from.x + projection * dx), point.y - (from.y + projection * dy));
  }

  private segmentsIntersect(a: TouchLocation, b: TouchLocation, c: TouchLocation, d: TouchLocation): boolean {
    const cross = (p: TouchLocation, q: TouchLocation, r: TouchLocation) =>
      (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    const orientation = (value: number) => Math.abs(value) < 0.000001 ? 0 : Math.sign(value);
    const onSegment = (point: TouchLocation, from: TouchLocation, to: TouchLocation) =>
      point.x >= Math.min(from.x, to.x) && point.x <= Math.max(from.x, to.x) &&
      point.y >= Math.min(from.y, to.y) && point.y <= Math.max(from.y, to.y);
    const abC = orientation(cross(a, b, c));
    const abD = orientation(cross(a, b, d));
    const cdA = orientation(cross(c, d, a));
    const cdB = orientation(cross(c, d, b));
    if (abC !== abD && cdA !== cdB) return true;
    return (abC === 0 && onSegment(c, a, b)) ||
      (abD === 0 && onSegment(d, a, b)) ||
      (cdA === 0 && onSegment(a, c, d)) ||
      (cdB === 0 && onSegment(b, c, d));
  }

  private pointFromEvent(event: PointerEvent): InkPoint {
    const rect = this.inkCanvas.getBoundingClientRect();
    return {
      x: Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1),
      y: Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1),
      pressure: event.pressure,
      tiltX: event.tiltX,
      tiltY: event.tiltY,
      time: event.timeStamp,
    };
  }

  private normalizedPressure(value: number): number {
    return value > 0 && value <= 1 ? value : 0.5;
  }

  private beginGesture(): void {
    const [first, second] = [...this.touches.values()];
    this.gestureStart = {
      distance: Math.max(Math.hypot(second.x - first.x, second.y - first.y), 1),
      center: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
      scale: this.scale,
      offsetX: this.offsetX,
      offsetY: this.offsetY,
    };
  }

  private updateGesture(): void {
    if (!this.gestureStart) return;
    const [first, second] = [...this.touches.values()];
    const distance = Math.max(Math.hypot(second.x - first.x, second.y - first.y), 1);
    const center = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
    this.scale = Math.min(Math.max(this.gestureStart.scale * distance / this.gestureStart.distance, 1), 3);
    this.offsetX = this.gestureStart.offsetX + center.x - this.gestureStart.center.x;
    this.offsetY = this.gestureStart.offsetY + center.y - this.gestureStart.center.y;
    this.clampOffset();
    this.applyTransform();
  }

  private handleWheel = (event: WheelEvent): void => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      this.scale = Math.min(Math.max(this.scale * Math.exp(-event.deltaY * 0.004), 1), 3);
      this.clampOffset();
      this.applyTransform();
      this.scheduleZoomRerasterization();
      return;
    }
    if (this.scale <= 1) return;
    event.preventDefault();
    const horizontalDelta = event.shiftKey && Math.abs(event.deltaX) < Math.abs(event.deltaY)
      ? event.deltaY
      : event.deltaX;
    this.offsetX -= horizontalDelta;
    if (!event.shiftKey) this.offsetY -= event.deltaY;
    this.clampOffset();
    this.applyTransform();
  };

  private handlePointerEnter = (): void => {
    this.pointerInside = true;
  };

  private handlePointerLeave = (): void => {
    this.pointerInside = false;
    if (!this.panStart) this.setSpacePressed(false);
  };

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.code !== "Space" || !this.pointerInside || this.isTextEntry(event.target)) return;
    event.preventDefault();
    this.setSpacePressed(true);
  };

  private handleKeyUp = (event: KeyboardEvent): void => {
    if (event.code === "Space") this.setSpacePressed(false);
  };

  private handleWindowBlur = (): void => {
    this.panStart = undefined;
    this.touches.clear();
    this.gestureStart = undefined;
    this.pendingTouchZoomCommit = false;
    this.surface.classList.remove("is-zooming");
    this.setSpacePressed(false);
    this.inkCanvas.classList.remove("is-panning");
  };

  private setSpacePressed(pressed: boolean): void {
    this.spacePressed = pressed;
    this.inkCanvas.classList.toggle("is-pan-ready", pressed);
  }

  private isTextEntry(target: EventTarget | null): boolean {
    return target instanceof HTMLInputElement
      || target instanceof HTMLTextAreaElement
      || (target instanceof HTMLElement && target.isContentEditable);
  }

  private applyTransform(): void {
    const previewScale = this.scale / this.renderedScale;
    this.surface.style.transform = `translate3d(${this.offsetX}px, ${this.offsetY}px, 0) scale(${previewScale})`;
  }

  private clampOffset(): void {
    const horizontalLimit = Math.max((this.cssWidth * this.scale - this.viewport.clientWidth) / 2, 0);
    const verticalLimit = Math.max((this.cssHeight * this.scale - this.viewport.clientHeight) / 2, 0);
    this.offsetX = Math.min(Math.max(this.offsetX, -horizontalLimit), horizontalLimit);
    this.offsetY = Math.min(Math.max(this.offsetY, -verticalLimit), verticalLimit);
  }

  private gridAspectRatio(): number {
    return (
      this.state.grid.columns + Math.max(this.state.grid.columns - 1, 0) * COLUMN_GAP_RATIO
    ) / this.state.grid.rows;
  }

  private gridRect(): { x: number; y: number; width: number; height: number } {
    const width = Math.max(this.cssWidth - GRID_INSET * 2, 0);
    return {
      x: GRID_INSET,
      y: GRID_INSET + HEADER_HEIGHT + HEADER_SPACING,
      width,
      height: width / this.gridAspectRatio(),
    };
  }

  private cellLayout(): { x: number; y: number; cell: number; gap: number } {
    const rect = this.gridRect();
    const widthUnits = this.state.grid.columns + Math.max(this.state.grid.columns - 1, 0) * COLUMN_GAP_RATIO;
    const cell = Math.min(rect.width / widthUnits, rect.height / this.state.grid.rows);
    const gap = cell * COLUMN_GAP_RATIO;
    const gridWidth = this.state.grid.columns * cell + Math.max(this.state.grid.columns - 1, 0) * gap;
    const gridHeight = this.state.grid.rows * cell;
    return {
      x: rect.x + (rect.width - gridWidth) / 2,
      y: rect.y + (rect.height - gridHeight) / 2,
      cell,
      gap,
    };
  }
}
