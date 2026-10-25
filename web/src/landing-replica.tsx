import { For, Index, Show } from "solid-js";
import {
  Download,
  Eraser,
  FileDown,
  ImageUp,
  PenTool,
  Pencil,
  Plus,
  Redo2,
  ScanLine,
  Search,
  Sheet,
  Trash2,
  Undo2,
  X,
} from "lucide-solid";
import {
  CANDIDATES,
  EI_STROKES,
  InkTool,
  WRITTEN,
  ScanState,
  clamp,
  type ReplicaState,
} from "./landing-story";

// Paper geometry, matching the app's 20 × 20 sheet at a fixed size.
export const PAPER = {
  inset: 34,
  header: 22,
  cell: 24,
  gap: 24 * 0.18,
  columns: 20,
  rows: 20,
};

const GUIDE_COLUMN = PAPER.columns - 1;

const DOCUMENTS = [
  { character: "永", title: "永 practice", meta: "400 characters · Just now" },
  { character: "水", title: "水 practice", meta: "200 characters · Yesterday" },
  { character: "書", title: "書 practice", meta: "400 characters · Oct 18" },
  { character: "山", title: "山 practice", meta: "400 characters · Oct 11" },
  { character: "心", title: "心 practice", meta: "200 characters · Oct 4" },
  { character: "字", title: "字 practice", meta: "400 characters · Sep 27" },
];

function columnX(column: number): number {
  return PAPER.inset + column * (PAPER.cell + PAPER.gap);
}

function rowY(row: number): number {
  return PAPER.inset + PAPER.header + row * PAPER.cell;
}

function cellStyle(column: number, row: number, rows = 1, columns = 1) {
  return {
    left: `${columnX(column)}px`,
    top: `${rowY(row)}px`,
    width: `${columnX(column + columns - 1) - columnX(column) + PAPER.cell}px`,
    height: `${rows * PAPER.cell}px`,
  };
}

// The sheet's grid as two static paths: column outlines with cell rules, and
// the faint quarter guides. One SVG rasterizes far faster than per-column
// gradients while the camera rescales the whole sheet.
const GRID = (() => {
  const top = rowY(0);
  const bottom = rowY(PAPER.rows);
  let rules = "";
  let guides = "";
  for (let column = 0; column < PAPER.columns; column += 1) {
    const left = columnX(column);
    const right = left + PAPER.cell;
    const middle = left + PAPER.cell / 2;
    rules += `M${left} ${top}H${right}V${bottom}H${left}Z`;
    guides += `M${middle} ${top}V${bottom}`;
    for (let row = 0; row < PAPER.rows; row += 1) {
      const y = rowY(row);
      if (row > 0) rules += `M${left} ${y}H${right}`;
      guides += `M${left} ${y + PAPER.cell / 2}H${right}`;
    }
  }
  return { rules, guides };
})();

function Grid() {
  return (
    <svg class="r-grid" aria-hidden="true">
      <path d={GRID.guides} stroke-width="0.4" />
      <path d={GRID.rules} stroke-width="0.72" />
    </svg>
  );
}

// One kanji drawn as KanjiVG strokes; `drawn` is a fractional stroke count.
function Strokes(props: {
  drawn: number;
  width: number;
  color: string;
  ink?: string;
}) {
  return (
    <svg class="r-strokes" viewBox="0 0 109 109" aria-hidden="true">
      <Index each={EI_STROKES}>
        {(path, index) => {
          const progress = () => clamp(props.drawn - index);
          return (
            <path
              d={path()}
              data-ink={props.ink ? `${props.ink}-${index}` : undefined}
              pathLength="1"
              stroke={props.color}
              stroke-width={props.width}
              stroke-dasharray="1 2"
              stroke-dashoffset={1 - progress()}
              opacity={progress() > 0 ? 1 : 0}
            />
          );
        }}
      </Index>
    </svg>
  );
}

function Paper(props: { state: ReplicaState }) {
  const strokes = EI_STROKES.length;
  return (
    <div class="r-paper" data-target="paper">
      <div class="r-paper-head" data-target="paperhead">
        <span lang="ja">原 稿 用 紙</span>
        <span lang="ja">400 字 ・ 縦書き</span>
      </div>
      <Grid />
      <Index each={Array.from({ length: strokes })}>
        {(_, row) => (
          <span
            class="r-cell r-guide"
            classList={{ shown: row < props.state.guides }}
            style={cellStyle(GUIDE_COLUMN, row)}
          >
            <Strokes drawn={strokes - row} width={3} color="#1f1c17" />
          </span>
        )}
      </Index>
      <Index each={WRITTEN}>
        {(character, index) => (
          <span
            class="r-cell r-written"
            style={{
              ...cellStyle(character().column, character().row),
              transform: `rotate(${character().rotate}deg) scale(${character().scale})`,
            }}
          >
            <Strokes
              drawn={props.state.ink - index * strokes}
              width={character().tool === InkTool.Pen ? 7.5 : 4.5}
              color={character().tool === InkTool.Pen ? "#1f1c17" : "#5d5850"}
              ink={String(index)}
            />
          </span>
        )}
      </Index>
      <span
        class="r-target"
        data-target="guidecol"
        style={cellStyle(GUIDE_COLUMN, 0, strokes)}
      />
      <span
        class="r-target"
        data-target="writing"
        style={cellStyle(GUIDE_COLUMN - 2, 0, 5, 3)}
      />
      <span class="r-pdf-stamp">
        PDF <span aria-hidden="true">↗</span>
      </span>
    </div>
  );
}

function PracticeView(props: { state: ReplicaState }) {
  const s = () => props.state;
  const strokes = EI_STROKES.length;
  const weightPercent = () => ((s().weight - 1) / 11) * 100;
  return (
    <section class="r-practice" classList={{ off: s().library }}>
      <header class="r-header r-chrome">
        <div>
          <p class="r-eyebrow">GENKOU YOUSHI</p>
          <h1>Writing practice</h1>
        </div>
        <div class="r-actions">
          <span class="r-icon" classList={{ disabled: s().ink === 0 }}>
            <Undo2 />
          </span>
          <span class="r-icon disabled">
            <Redo2 />
          </span>
          <span class="r-export" data-target="export">
            <FileDown /> Export PDF
          </span>
          <span
            class="r-status"
            classList={{
              saving: ["Saving", "Preparing export"].includes(s().status),
            }}
          >
            <i />
            {s().status}
          </span>
        </div>
      </header>

      <div class="r-content">
        <div class="r-workspace">
          <div class="r-viewport">
            <Paper state={s()} />
          </div>
          <p class="r-credit r-chrome" classList={{ shown: s().guides > 0 }}>
            Stroke diagrams adapted from <u>KanjiVG</u>, © Ulrich Apel.
            Diagrams: <u>CC BY-SA 3.0</u>.
          </p>
          <div class="r-tools r-chrome" data-target="tools">
            <span
              class="r-tool"
              classList={{ selected: s().tool === InkTool.Pen }}
            >
              <PenTool /> Pen
            </span>
            <span
              class="r-tool"
              classList={{ selected: s().tool === InkTool.Pencil }}
              data-target="pencil"
            >
              <Pencil /> Pencil
            </span>
            <span class="r-tool">
              <Eraser /> Eraser
            </span>
            <span class="r-divider" />
            <span class="r-weight" data-target="weight">
              Line weight
              <span class="r-slider">
                <span style={{ width: `${weightPercent()}%` }} />
                <i
                  data-target="weightthumb"
                  style={{ left: `${weightPercent()}%` }}
                />
              </span>
              <output>{s().weight.toFixed(1)}</output>
            </span>
            <span class="r-spacer" />
            <span class="r-clear">
              <Trash2 />
            </span>
          </div>
        </div>

        <aside class="r-reference r-chrome">
          <div class="r-card" data-target="kanji">
            <div class="r-card-label">
              <span>KANJI</span>
              <strong>{s().kanji ? `${strokes} strokes` : "Reference"}</strong>
            </div>
            <div class="r-preview">
              <Strokes drawn={s().preview} width={3.2} color="#1f1c17" />
            </div>
            <div class="r-form">
              <span class="r-input" lang="ja">
                {s().kanji}
              </span>
              <span class="r-search">
                <Search />
              </span>
            </div>
            <span class="r-photo-button" data-target="photo">
              <ImageUp /> Recognize from photo
            </span>
          </div>

          <div class="r-card" data-target="guidecard">
            <p class="r-eyebrow">PAPER GUIDES</p>
            <div class="r-guide-control">
              <span>
                <strong>Tracing guides</strong>
                <small>Full kanji to first stroke</small>
              </span>
              <i class="r-check" />
            </div>
            <div class="r-details">
              <span class="r-summary" data-target="strokesummary">
                <i classList={{ open: s().strokeOrderOpen }} />
                Stroke order ({s().kanji ? strokes : 0})
              </span>
              <ol
                class="r-stroke-list"
                classList={{ open: s().strokeOrderOpen }}
                data-target="strokelist"
              >
                <Index each={EI_STROKES}>
                  {(_, index) => (
                    <li>
                      <span>{index + 1}</span>
                      <Strokes drawn={index + 1} width={4} color="#1f1c17" />
                    </li>
                  )}
                </Index>
              </ol>
            </div>
          </div>

          <div class="r-card r-session" data-target="session">
            <p class="r-eyebrow">SESSION</p>
            <div>
              <span>Paper</span>
              <strong>20 × 20</strong>
            </div>
            <div>
              <span>Capacity</span>
              <strong>400 字</strong>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function LibraryView(props: { state: ReplicaState }) {
  return (
    <section
      class="r-library"
      classList={{ off: !props.state.library }}
      data-target="library"
    >
      <header class="r-header r-library-header">
        <div>
          <p class="r-eyebrow">LOCAL LIBRARY</p>
          <h1>Practice sheets</h1>
        </div>
        <span class="r-new-sheet" data-target="newsheet">
          <Plus /> New sheet
        </span>
      </header>
      <div class="r-picker" classList={{ open: props.state.pickerOpen }}>
        <div data-target="picker">
          <p class="r-eyebrow">CHOOSE PAPER</p>
          <span class="r-sheet-choice" data-target="standard">
            <Sheet />
            <strong>Standard</strong>
            <small>20 × 20 · 400 characters</small>
          </span>
          <span class="r-sheet-choice">
            <Sheet class="compact" />
            <strong>Compact</strong>
            <small>10 × 20 · 200 characters</small>
          </span>
        </div>
      </div>
      <div class="r-documents">
        <For each={DOCUMENTS}>
          {(document, index) => (
            <article
              class="r-document"
              data-target={index() === 0 ? "doccard" : undefined}
            >
              <span class="r-document-character" lang="ja">
                {document.character}
              </span>
              <span>
                <strong>{document.title}</strong>
                <small>{document.meta}</small>
              </span>
              <i>
                <Trash2 />
              </i>
            </article>
          )}
        </For>
      </div>
    </section>
  );
}

function PhotoDialog(props: { state: ReplicaState }) {
  const s = () => props.state;
  const crop = () => {
    const t = s().crop;
    const mix = (from: number, to: number) => from + (to - from) * t;
    return {
      left: `${mix(20, 31)}%`,
      top: `${mix(20, 27)}%`,
      width: `${mix(60, 40)}%`,
      height: `${mix(60, 44)}%`,
    };
  };
  return (
    <div class="r-backdrop" classList={{ open: s().photoOpen }}>
      <div class="r-dialog" data-target="dialog">
        <span class="r-dialog-close">
          <X />
        </span>
        <div class="r-dialog-heading">
          <span class="r-dialog-icon">
            <ScanLine />
          </span>
          <div>
            <p class="r-eyebrow">PHOTO RECOGNITION</p>
            <h2>Recognize kanji</h2>
          </div>
        </div>
        <div class="r-photo">
          <div class="r-photo-stage">
            <div class="r-photo-scrap">
              <span class="r-photo-line" />
              <span class="r-photo-line" />
              <Strokes drawn={EI_STROKES.length} width={6.5} color="#26221c" />
            </div>
            <div class="r-crop" style={crop()} data-target="crop">
              <i class="tl" />
              <i class="tr" />
              <i class="bl" />
              <i class="br" data-target="crophandle" />
            </div>
          </div>
          <Show when={s().scan === ScanState.Scanning}>
            <div class="r-scanning">
              <span class="r-spinner" />
              <strong>Scanning image…</strong>
              <small>Looking for kanji candidates</small>
            </div>
          </Show>
        </div>
        <div class="r-dialog-foot">
          <div
            class="r-dialog-actions"
            classList={{ off: s().scan === ScanState.Results }}
          >
            <span class="r-crop-help">
              Drag the box to move it. Use the corners to resize.
            </span>
            <span class="r-replace">Choose another</span>
            <span class="r-scan" data-target="scan">
              <ScanLine />
              {s().scan === ScanState.Scanning ? "Scanning…" : "Start scan"}
            </span>
          </div>
          <div
            class="r-results"
            classList={{ off: s().scan !== ScanState.Results }}
            data-target="candidates"
          >
            <p class="r-eyebrow">SCAN RESULTS</p>
            <h3>Choose the practiced kanji</h3>
            <div class="r-candidates">
              <For each={CANDIDATES}>
                {(candidate, index) => (
                  <span
                    data-target={index() === 0 ? "candidate" : undefined}
                    style={{ "--i": index() }}
                  >
                    <b lang="ja">{candidate.character}</b>
                    <small>
                      {index() === 0 ? "Best match · " : ""}
                      {candidate.confidence}%
                    </small>
                  </span>
                )}
              </For>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// A static, inert copy of the practice app that the landing page camera moves
// across. It shares the app's look but none of its behaviour.
export default function LandingReplica(props: {
  ref?: (element: HTMLDivElement) => void;
  state: ReplicaState;
}) {
  return (
    <div
      ref={props.ref}
      class="replica"
      classList={{ printing: props.state.printing }}
      aria-hidden="true"
      inert
    >
      <nav class="r-rail r-chrome">
        <span class="r-seal" lang="ja">
          原
        </span>
        <span
          class="r-nav"
          classList={{ selected: !props.state.library }}
          data-target="practicebtn"
        >
          <b lang="ja">書</b>
          Practice
        </span>
        <span
          class="r-nav"
          classList={{ selected: props.state.library }}
          data-target="librarybtn"
        >
          <b lang="ja">冊</b>
          Library
        </span>
        <span class="r-nav-spacer" />
        <span class="r-nav r-licenses">Credits &amp; licenses</span>
        <span class="r-nav">
          <Download />
          Install
        </span>
      </nav>
      <div class="r-main">
        <PracticeView state={props.state} />
        <LibraryView state={props.state} />
      </div>
      <PhotoDialog state={props.state} />
    </div>
  );
}
