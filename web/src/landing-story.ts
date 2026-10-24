// Scroll timeline for the landing page walkthrough. Positions are in story
// units, where one unit is one viewport height of scrolling.

export const STORY_UNITS = 14;

export type StoryTarget =
  | "overview"
  | "paper"
  | "paperhead"
  | "session"
  | "kanji"
  | "photo"
  | "dialog"
  | "crop"
  | "crophandle"
  | "scan"
  | "candidates"
  | "candidate"
  | "guidecol"
  | "guidecard"
  | "strokesummary"
  | "strokelist"
  | "tools"
  | "weight"
  | "weightthumb"
  | "pencil"
  | "writing"
  | "librarybtn"
  | "library"
  | "doccard"
  | "newsheet"
  | "picker"
  | "standard"
  | "practicebtn"
  | "export";

export type StoryChapter = {
  id: string;
  start: number;
  end: number;
  kanji: string;
  eyebrow: string;
  title: string;
  body: string;
};

export const STORY_CHAPTERS: StoryChapter[] = [
  {
    id: "paper",
    start: 1.1,
    end: 2.6,
    kanji: "紙",
    eyebrow: "01 / THE PAPER",
    title: "A sheet with a measured rhythm.",
    body: "Genkō yōshi gives every character its own square, written top to bottom and right to left. Start with a standard 20 × 20 sheet or a compact 10 × 20 grid.",
  },
  {
    id: "find",
    start: 2.6,
    end: 5,
    kanji: "字",
    eyebrow: "02 / FIND A CHARACTER",
    title: "Type it, or show it a photo.",
    body: "Enter any kanji to load its reference. Not sure what it is? Frame it in a photo and choose from the closest matches.",
  },
  {
    id: "trace",
    start: 5,
    end: 6.6,
    kanji: "導",
    eyebrow: "03 / TRACE",
    title: "Guides that fade as you learn.",
    body: "The first column fills with progressive stroke-order guides, from the full kanji down to its first stroke. Open the diagram whenever you need it.",
  },
  {
    id: "write",
    start: 6.6,
    end: 8.7,
    kanji: "筆",
    eyebrow: "04 / WRITE",
    title: "Ink that behaves like ink.",
    body: "Write with a pen or a pencil, tune the line weight, and erase what doesn’t land. Undo and redo are always one tap away.",
  },
  {
    id: "keep",
    start: 8.7,
    end: 10.4,
    kanji: "冊",
    eyebrow: "05 / KEEP",
    title: "A library that stays with you.",
    body: "Every sheet saves itself in this browser. No account, no sync, no streak to protect. Open a fresh page whenever you like.",
  },
  {
    id: "print",
    start: 10.4,
    end: 12.1,
    kanji: "印",
    eyebrow: "06 / PRINT",
    title: "Take it off the screen.",
    body: "Export a clean PDF of the sheet to print, share, or keep as a record of the work you put in.",
  },
];

type CameraKey = {
  at: number;
  target: StoryTarget;
  // Fraction of the focus area the target should fill.
  fill: number;
  rotateX: number;
  rotateY: number;
  skew: number;
  // Multiplies the overview scale; only used for the "overview" target.
  zoom?: number;
};

const CAMERA_KEYS: CameraKey[] = [
  {
    at: 0,
    target: "overview",
    fill: 1,
    rotateX: 22,
    rotateY: -32,
    skew: 3,
    zoom: 1.12,
  },
  { at: 0.9, target: "overview", fill: 1, rotateX: 0, rotateY: 0, skew: 0 },
  { at: 1.5, target: "paper", fill: 0.92, rotateX: 0, rotateY: -6, skew: 0 },
  {
    at: 2.05,
    target: "paperhead",
    fill: 0.86,
    rotateX: 6,
    rotateY: -10,
    skew: -1,
  },
  { at: 2.45, target: "session", fill: 0.6, rotateX: 0, rotateY: 10, skew: 0 },
  { at: 2.95, target: "kanji", fill: 0.8, rotateX: -2, rotateY: 8, skew: 1 },
  { at: 3.45, target: "dialog", fill: 0.92, rotateX: 0, rotateY: -4, skew: 0 },
  { at: 3.9, target: "dialog", fill: 0.9, rotateX: 2, rotateY: 3, skew: 0 },
  {
    at: 4.2,
    target: "candidates",
    fill: 0.86,
    rotateX: 4,
    rotateY: 6,
    skew: 1,
  },
  { at: 4.65, target: "kanji", fill: 0.82, rotateX: -3, rotateY: 6, skew: 0 },
  {
    at: 5.4,
    target: "guidecol",
    fill: 0.9,
    rotateX: 4,
    rotateY: -10,
    skew: -1.5,
  },
  { at: 5.95, target: "guidecard", fill: 0.8, rotateX: 0, rotateY: 8, skew: 0 },
  {
    at: 6.4,
    target: "strokelist",
    fill: 0.8,
    rotateX: -4,
    rotateY: 6,
    skew: 1,
  },
  { at: 6.95, target: "tools", fill: 0.9, rotateX: 0, rotateY: -6, skew: 0 },
  {
    at: 7.5,
    target: "writing",
    fill: 0.86,
    rotateX: 5,
    rotateY: -12,
    skew: -1.5,
  },
  { at: 8.1, target: "writing", fill: 0.92, rotateX: 0, rotateY: -4, skew: 0 },
  { at: 8.5, target: "writing", fill: 0.88, rotateX: -3, rotateY: 6, skew: 1 },
  { at: 9.1, target: "library", fill: 1, rotateX: 6, rotateY: 14, skew: 1 },
  { at: 9.5, target: "doccard", fill: 0.7, rotateX: 4, rotateY: -6, skew: -1 },
  {
    at: 10.05,
    target: "standard",
    fill: 0.5,
    rotateX: -4,
    rotateY: 6,
    skew: 1,
  },
  { at: 10.6, target: "overview", fill: 1, rotateX: 0, rotateY: -4, skew: 0 },
  { at: 11, target: "export", fill: 0.5, rotateX: 0, rotateY: -8, skew: 0 },
  {
    at: 11.5,
    target: "paper",
    fill: 0.94,
    rotateX: 8,
    rotateY: -14,
    skew: -1,
  },
  { at: 11.9, target: "paper", fill: 0.94, rotateX: 0, rotateY: 0, skew: 0 },
  { at: 12.4, target: "overview", fill: 1, rotateX: 0, rotateY: 0, skew: 0 },
  {
    at: 13.2,
    target: "overview",
    fill: 1,
    rotateX: 52,
    rotateY: 0,
    skew: 0,
    zoom: 0.62,
  },
];

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Camera = {
  x: number;
  y: number;
  scale: number;
  rotateX: number;
  rotateY: number;
  skew: number;
};

function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

// Progress of `units` through [start, end], clamped to 0..1.
export function span(units: number, start: number, end: number): number {
  return clamp((units - start) / (end - start));
}

function frame(
  key: CameraKey,
  measure: (target: StoryTarget) => Rect,
  stage: Rect,
  focus: Rect,
): Camera {
  const fit = Math.min(focus.width / stage.width, focus.height / stage.height);
  if (key.target === "overview") {
    return {
      x: stage.width / 2,
      y: stage.height / 2,
      scale: fit * 0.94 * (key.zoom ?? 1),
      rotateX: key.rotateX,
      rotateY: key.rotateY,
      skew: key.skew,
    };
  }
  const rect = measure(key.target);
  const scale = Math.min(
    (focus.width * key.fill) / rect.width,
    (focus.height * key.fill) / rect.height,
    fit * 4,
  );
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
    scale: Math.max(scale, fit),
    rotateX: key.rotateX,
    rotateY: key.rotateY,
    skew: key.skew,
  };
}

function flat(camera: Camera): Camera {
  return { ...camera, rotateX: 0, rotateY: 0, skew: 0 };
}

export function cameraAt(
  units: number,
  measure: (target: StoryTarget) => Rect,
  stage: Rect,
  focus: Rect,
  still = false,
): Camera {
  const next = CAMERA_KEYS.findIndex((key) => key.at > units);
  const last = CAMERA_KEYS.length - 1;
  const from = CAMERA_KEYS[next === -1 ? last : Math.max(next - 1, 0)];
  const to = CAMERA_KEYS[next === -1 ? last : next];
  const a = frame(from, measure, stage, focus);
  if (from === to) return still ? flat(a) : a;
  const b = frame(to, measure, stage, focus);
  // Snap between keys when motion is reduced instead of travelling.
  const t = still
    ? Math.round(span(units, from.at, to.at))
    : ease(span(units, from.at, to.at));
  const mix = (p: number, q: number) => p + (q - p) * t;
  // Interpolate scale geometrically so zooms feel even.
  const camera = {
    x: mix(a.x, b.x),
    y: mix(a.y, b.y),
    scale: a.scale * (b.scale / a.scale) ** t,
    rotateX: mix(a.rotateX, b.rotateX),
    rotateY: mix(a.rotateY, b.rotateY),
    skew: mix(a.skew, b.skew),
  };
  return still ? flat(camera) : camera;
}

// KanjiVG strokes for 永 (U+6C38), © Ulrich Apel, CC BY-SA 3.0.
export const EI_STROKES = [
  "M45.5,13.25c5.12,2.4,8.62,5.75,10.75,9",
  "M31.75,37.25c1.88,0.75,4.12,1,6.07,0.55c3.62-0.83,9.41-2.51,13.04-3.35c3-0.7,5.16,0.8,5.16,4.05c0,14.5-0.26,45.45-0.26,50c0,12-7.02,2.84-8.52,1.7",
  "M14.25,58.68c1.75,0.45,3.46,0.3,5-0.02c2.5-0.53,12.84-3.54,15.34-4.49c2.5-0.95,4.65,0.77,3.75,2.85C33.5,68.25,25.75,79.75,16,86.37",
  "M81.22,36.52c-0.1,1.11-0.78,2.03-1.52,2.7c-4.83,4.38-13.96,9.73-21.46,11.92",
  "M58,52.74c9.88,9.52,20.02,18.85,29.07,24.84c2.01,1.33,4.05,2.66,6.43,3.56",
];

export enum InkTool {
  Pen = "pen",
  Pencil = "pencil",
}

export type WrittenCharacter = {
  column: number;
  row: number;
  tool: InkTool;
  // Small per-character variation so the handwriting does not look stamped.
  rotate: number;
  scale: number;
};

// Columns count from the left of the 20-column sheet; the guide column is the
// rightmost one, so practice starts in the column beside it.
export const WRITTEN: WrittenCharacter[] = [
  { column: 18, row: 0, tool: InkTool.Pen, rotate: -2, scale: 0.96 },
  { column: 18, row: 1, tool: InkTool.Pen, rotate: 1.5, scale: 0.92 },
  { column: 18, row: 2, tool: InkTool.Pen, rotate: -1, scale: 0.98 },
  { column: 18, row: 3, tool: InkTool.Pen, rotate: 2.5, scale: 0.94 },
  { column: 17, row: 0, tool: InkTool.Pencil, rotate: 1, scale: 0.95 },
  { column: 17, row: 1, tool: InkTool.Pencil, rotate: -2.5, scale: 0.9 },
];

export const CANDIDATES = [
  { character: "永", confidence: 94 },
  { character: "氷", confidence: 3 },
  { character: "水", confidence: 2 },
  { character: "泳", confidence: 1 },
];

// Each entry holds its value until the story reaches `until`.
type Steps<T> = [until: number, value: T][];

function stepAt<T>(steps: Steps<T>, units: number, fallback: T): T {
  return steps.find(([until]) => units < until)?.[1] ?? fallback;
}

const HIGHLIGHTS: Steps<StoryTarget | null> = [
  [1.3, null],
  [1.85, "paper"],
  [2.25, "paperhead"],
  [2.7, "session"],
  [3.15, "photo"],
  [3.4, null],
  [3.7, "crop"],
  [3.95, "scan"],
  [4.35, "candidate"],
  [4.5, null],
  [4.95, "kanji"],
  [5.15, null],
  [5.85, "guidecol"],
  [6.1, null],
  [6.6, "strokelist"],
  [7.25, "weight"],
  [8.15, "writing"],
  [8.3, "pencil"],
  [8.7, "writing"],
  [8.9, "librarybtn"],
  [9.3, null],
  [9.8, "doccard"],
  [10.4, "picker"],
  [10.75, null],
  [11.15, "export"],
];

const CURSORS: Steps<StoryTarget | null> = [
  [2.8, null],
  [3.2, "photo"],
  [3.35, null],
  [3.65, "crophandle"],
  [3.95, "scan"],
  [4.1, null],
  [4.4, "candidate"],
  [5.85, null],
  [6.2, "strokesummary"],
  [6.85, null],
  [7.25, "weightthumb"],
  [8.1, null],
  [8.3, "pencil"],
  [8.6, null],
  [8.9, "librarybtn"],
  [9.55, null],
  [9.9, "newsheet"],
  [10.35, "standard"],
  [10.65, "practicebtn"],
  [11.2, "export"],
];

const STATUSES: Steps<string> = [
  [4.4, "Ready"],
  [4.6, "Reference updated"],
  [7.35, "Saved"],
  [8.6, "Editing"],
  [8.8, "Saving"],
  [11, "Saved"],
  [11.95, "Preparing export"],
];

const PRESSES = [3.1, 3.8, 4.3, 6.05, 7.02, 8.2, 8.8, 9.75, 10.5, 11];

export enum ScanState {
  Idle = "idle",
  Scanning = "scanning",
  Results = "results",
}

export type ReplicaState = {
  library: boolean;
  photoOpen: boolean;
  crop: number;
  scan: ScanState;
  kanji: string;
  // Strokes drawn in the reference preview, as a fractional count.
  preview: number;
  guides: number;
  strokeOrderOpen: boolean;
  weight: number;
  tool: InkTool;
  // Strokes written on the sheet, as a fractional count across WRITTEN.
  ink: number;
  status: string;
  pickerOpen: boolean;
  printing: boolean;
  highlight: StoryTarget | null;
  cursor: StoryTarget | null;
  pressing: boolean;
};

export function replicaAt(u: number): ReplicaState {
  const pen = WRITTEN.filter((character) => character.tool === InkTool.Pen);
  const penStrokes = pen.length * EI_STROKES.length;
  const pencilStrokes = (WRITTEN.length - pen.length) * EI_STROKES.length;
  const ink =
    penStrokes * span(u, 7.35, 8.1) + pencilStrokes * span(u, 8.25, 8.6);
  return {
    library: u >= 8.8 && u < 10.5,
    photoOpen: u >= 3.15 && u < 4.35,
    crop: span(u, 3.4, 3.65),
    scan:
      u < 3.82
        ? ScanState.Idle
        : u < 4
          ? ScanState.Scanning
          : ScanState.Results,
    kanji: u >= 4.35 ? "永" : "",
    preview: Math.round(span(u, 4.4, 4.85) * EI_STROKES.length * 50) / 50,
    guides: Math.round(span(u, 5.15, 5.6) * EI_STROKES.length),
    strokeOrderOpen: u >= 6.05,
    weight: Math.round((3.8 + span(u, 7.02, 7.2) * 1.2) * 10) / 10,
    tool: u >= 8.2 ? InkTool.Pencil : InkTool.Pen,
    ink: Math.round(ink * 100) / 100,
    status: stepAt(STATUSES, u, "Saved"),
    pickerOpen: u >= 9.75 && u < 10.5,
    printing: u >= 11.05 && u < 11.95,
    highlight: stepAt(HIGHLIGHTS, u, null),
    cursor: stepAt(CURSORS, u, null),
    pressing:
      PRESSES.some((at) => Math.abs(u - at) < 0.06) || (u > 7.02 && u < 7.2),
  };
}

export function sameState(a: ReplicaState, b: ReplicaState): boolean {
  return (Object.keys(a) as (keyof ReplicaState)[]).every(
    (key) => a[key] === b[key],
  );
}
