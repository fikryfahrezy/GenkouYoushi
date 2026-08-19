export type WritingTool = "brush" | "pencil" | "eraser";

export interface InkPoint {
  x: number;
  y: number;
  pressure: number;
  tiltX: number;
  tiltY: number;
  time: number;
}

export interface InkStroke {
  id: string;
  tool: WritingTool;
  width: number;
  points: InkPoint[];
}

export interface ManuscriptGrid {
  columns: number;
  rows: number;
}

export interface PracticePrompt {
  character: string;
  strokeOrderSvgs: string[];
}

export interface PracticeDocument {
  id: string;
  title: string;
  prompt: PracticePrompt;
  grid: ManuscriptGrid;
  showsGuides: boolean;
  strokes: InkStroke[];
  createdAt: string;
  updatedAt: string;
}

export interface KanjiCandidate {
  character: string;
  confidence: number;
}

export const STANDARD_GRID: ManuscriptGrid = { columns: 20, rows: 20 };
export const COMPACT_GRID: ManuscriptGrid = { columns: 10, rows: 20 };

export function createPracticeDocument(grid: ManuscriptGrid = STANDARD_GRID): PracticeDocument {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: "永 practice",
    prompt: { character: "永", strokeOrderSvgs: [] },
    grid: { ...grid },
    showsGuides: true,
    strokes: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function isKanji(value: string): boolean {
  const scalar = value.codePointAt(0);
  if (scalar === undefined) return false;
  return (
    (scalar >= 0x3400 && scalar <= 0x4dbf) ||
    (scalar >= 0x4e00 && scalar <= 0x9fff) ||
    (scalar >= 0xf900 && scalar <= 0xfaff)
  );
}

export function firstKanji(value: string): string | undefined {
  return [...value].find(isKanji);
}
