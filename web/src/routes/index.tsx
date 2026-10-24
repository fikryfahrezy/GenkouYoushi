import { For, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import "../landing.css";
import LandingReplica from "../landing-replica";
import {
  EI_STROKES,
  STORY_CHAPTERS,
  STORY_UNITS,
  WRITTEN,
  cameraAt,
  clamp,
  replicaAt,
  sameState,
  span,
  type Rect,
  type StoryTarget,
} from "../landing-story";

type Question = {
  question: string;
  answer: string;
};

const STAGE: Rect = { x: 0, y: 0, width: 1280, height: 800 };
const FINALE = 12.3;
const INK_STROKES = WRITTEN.length * EI_STROKES.length;

const QUESTIONS: Question[] = [
  {
    question: "Do I need to create an account?",
    answer:
      "No. Open the app and start practicing immediately. Your sheets are stored locally in your current browser.",
  },
  {
    question: "Can I use it on a tablet or phone?",
    answer:
      "Yes. The workspace is responsive and installable from supported browsers. A tablet and stylus offer the most natural writing experience.",
  },
  {
    question: "Where is my practice saved?",
    answer:
      "Your sheets stay in your browser’s local storage. Clearing site data removes them, so export important work as a PDF backup.",
  },
  {
    question: "Can I print my sheets?",
    answer:
      "Yes. Use Export PDF, then save or print through your device’s standard print dialog.",
  },
];

function lerpRect(a: Rect, b: Rect, t: number): Rect {
  const mix = (p: number, q: number) => p + (q - p) * t;
  return {
    x: mix(a.x, b.x),
    y: mix(a.y, b.y),
    width: mix(a.width, b.width),
    height: mix(a.height, b.height),
  };
}

// The part of the screen the camera frames, which shifts as the story moves
// from the hero, into the captioned walkthrough, and out to the finale.
function focusAt(u: number, width: number, height: number): Rect {
  const narrow = width < 760;
  const full = { x: 0, y: 0, width, height };
  const intro = narrow
    ? { x: 0, y: height * 0.5, width, height: height * 0.55 }
    : {
        x: width * 0.46,
        y: height * 0.1,
        width: width * 0.56,
        height: height * 0.85,
      };
  const side = narrow
    ? { x: 8, y: 64, width: width - 16, height: height * 0.56 - 64 }
    : { x: width * 0.4, y: 84, width: width * 0.53, height: height - 140 };
  const end = { x: 0, y: height * 0.5, width, height: height * 0.9 };
  let rect = lerpRect(intro, full, span(u, 0, 0.9));
  rect = lerpRect(rect, side, span(u, 1, 1.5));
  rect = lerpRect(rect, full, span(u, 11.9, 12.4));
  return lerpRect(rect, end, span(u, 12.4, 13.2));
}

function Brand() {
  return (
    <a class="brand" href="/" aria-label="Genkou Youshi home">
      <span class="brand-seal" lang="ja" aria-hidden="true">
        原
      </span>
      <span class="brand-name">
        Genkou Youshi
        <span class="brand-caption">JAPANESE HANDWRITING PRACTICE</span>
      </span>
    </a>
  );
}

function Story(props: { onReady: (jump: (at: number) => void) => void }) {
  let section!: HTMLElement;
  let stage!: HTMLDivElement;
  let rig!: HTMLDivElement;
  let ring!: HTMLDivElement;
  let cursor!: HTMLDivElement;
  let nib!: HTMLDivElement;
  let replica: HTMLDivElement | undefined;

  const [ready, setReady] = createSignal(false);
  const [units, setUnits] = createSignal(0);
  const [state, setState] = createSignal(replicaAt(0), { equals: sameState });

  const active = createMemo(() =>
    STORY_CHAPTERS.find(
      (chapter) => units() >= chapter.start && units() < chapter.end,
    ),
  );
  const heroOut = () => span(units(), 0.2, 0.75);
  const finale = () => units() >= FINALE;
  const progress = () => units() / STORY_UNITS;

  let frame = 0;
  let current = 0;
  let reduced = false;
  let visible = false;
  let observer: IntersectionObserver | undefined;

  function offsetIn(element: HTMLElement, root: HTMLElement) {
    let x = 0;
    let y = 0;
    let node: HTMLElement | null = element;
    while (node && node !== root) {
      x += node.offsetLeft;
      y += node.offsetTop;
      node = node.offsetParent as HTMLElement | null;
    }
    return { x, y };
  }

  function measure(target: StoryTarget): Rect {
    const element = replica?.querySelector<HTMLElement>(
      `[data-target="${target}"]`,
    );
    if (!replica || !element) return STAGE;
    const { x, y } = offsetIn(element, replica);
    return { x, y, width: element.offsetWidth, height: element.offsetHeight };
  }

  function place(element: HTMLElement, target: StoryTarget | null, pad = 0) {
    if (!target) {
      element.style.opacity = "0";
      return;
    }
    const rect = measure(target);
    element.style.opacity = "1";
    element.style.width = `${rect.width + pad * 2}px`;
    element.style.height = `${rect.height + pad * 2}px`;
    element.style.transform = `translate(${rect.x - pad}px, ${rect.y - pad}px)`;
  }

  // Follows the tip of the stroke being written, in replica coordinates.
  function placeNib(ink: number) {
    const index = Math.floor(ink);
    const path =
      ink > 0 && ink < INK_STROKES
        ? replica?.querySelector<SVGPathElement>(
            `[data-ink="${Math.floor(index / EI_STROKES.length)}-${index % EI_STROKES.length}"]`,
          )
        : null;
    const cell = path?.ownerSVGElement?.parentElement;
    const matrix = path?.getCTM();
    if (!replica || !path || !cell || !matrix) {
      nib.style.opacity = "0";
      return;
    }
    const tip = path
      .getPointAtLength((ink - index) * path.getTotalLength())
      .matrixTransform(matrix);
    // The strokes sit inside the cell's 8% inset; the cell's own slight
    // rotation is small enough to leave out here.
    const { x, y } = offsetIn(cell, replica);
    const inset = cell.offsetWidth * 0.08;
    nib.style.opacity = "1";
    nib.style.transform = `translate(${x + inset + tip.x}px, ${y + inset + tip.y}px)`;
  }

  function scrollTarget(): number {
    const top = section.getBoundingClientRect().top;
    return clamp(-top / window.innerHeight, 0, STORY_UNITS);
  }

  function render() {
    const target = scrollTarget();
    current = reduced ? target : current + (target - current) * 0.12;
    if (Math.abs(target - current) < 0.0005) current = target;
    const u = current;
    if (Math.abs(units() - u) > 0.004) setUnits(u);

    const next = replicaAt(u);
    setState(next);

    // A hidden or unsized stage has nothing to frame yet.
    if (!stage.clientWidth || !stage.clientHeight) {
      frame = visible ? requestAnimationFrame(render) : 0;
      return;
    }
    const focus = focusAt(u, stage.clientWidth, stage.clientHeight);
    const camera = cameraAt(u, measure, STAGE, focus, reduced);
    rig.style.transform =
      `translate3d(${focus.x + focus.width / 2}px, ${focus.y + focus.height / 2}px, 0)` +
      ` rotateX(${camera.rotateX}deg) rotateY(${camera.rotateY}deg)` +
      ` skewY(${camera.skew}deg) scale(${camera.scale})` +
      ` translate(${-camera.x}px, ${-camera.y}px)`;
    rig.style.setProperty("--inverse", String(1 / camera.scale));
    rig.style.opacity = String(1 - span(u, 12.6, 13.3) * 0.55);
    place(ring, next.highlight, 8);
    place(cursor, next.cursor);
    cursor.classList.toggle("pressing", next.pressing);
    placeNib(next.ink);

    frame = visible ? requestAnimationFrame(render) : 0;
  }

  function start() {
    if (!frame) frame = requestAnimationFrame(render);
  }

  function jump(at: number) {
    const top = section.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({
      top: top + at * window.innerHeight,
      behavior: reduced ? "auto" : "smooth",
    });
  }

  onMount(() => {
    reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    current = scrollTarget();
    observer = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      if (visible) start();
    });
    observer.observe(section);
    visible = true;
    render();
    setReady(true);
    props.onReady(jump);
  });

  onCleanup(() => {
    observer?.disconnect();
    if (frame) cancelAnimationFrame(frame);
  });

  return (
    <section
      ref={section}
      class="story"
      classList={{ ready: ready() }}
      style={{ "--units": STORY_UNITS }}
      aria-labelledby="hero-title"
    >
      <div ref={stage} class="stage">
        <div class="grain" aria-hidden="true" />
        <For each={STORY_CHAPTERS}>
          {(chapter) => (
            <span
              class="ghost-kanji"
              classList={{ active: active()?.id === chapter.id }}
              lang="ja"
              aria-hidden="true"
            >
              {chapter.kanji}
            </span>
          )}
        </For>

        <div ref={rig} class="rig">
          <LandingReplica
            ref={(element) => (replica = element)}
            state={state()}
          />
          <div class="spotlight" aria-hidden="true">
            <div ref={ring} class="ring" />
          </div>
          <div ref={cursor} class="cursor" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="26" height="26">
              <path
                d="M4 2l16 9.5-7 1.6 4.2 7.4-3 1.6-4.2-7.5L5 19z"
                fill="#1f1c17"
                stroke="#fbf7e8"
                stroke-width="1.5"
                stroke-linejoin="round"
              />
            </svg>
          </div>
          <div ref={nib} class="nib" aria-hidden="true">
            <svg viewBox="0 0 40 40" width="40" height="40">
              <path
                d="M2 38l3-9L30 4l6 6L11 35z"
                fill="#2e454f"
                stroke="#fbf7e8"
                stroke-width="1.5"
                stroke-linejoin="round"
              />
              <path d="M2 38l3-9 6 6z" fill="#1f1c17" />
            </svg>
          </div>
        </div>
        <div
          class="veil"
          style={{
            opacity: span(units(), 1, 1.4) * (1 - span(units(), 11.9, 12.3)),
          }}
          aria-hidden="true"
        />

        <div
          class="hero"
          style={{
            opacity: 1 - heroOut(),
            transform: `translateY(${heroOut() * -60}px)`,
            visibility: heroOut() >= 1 ? "hidden" : "visible",
          }}
        >
          <p class="eyebrow">
            <span lang="ja">原稿用紙</span> / A QUIETER PLACE TO PRACTICE
          </p>
          <h1 id="hero-title">
            <span class="line">
              <span>Write Japanese,</span>
            </span>
            <span class="line">
              <em>one square</em>
            </span>
            <span class="line">
              <em>at a time.</em>
            </span>
          </h1>
          <p class="hero-lede">
            A focused handwriting workspace on traditional manuscript paper,
            with stroke-order guides, natural ink, and sheets that stay on your
            device.
          </p>
          <div class="hero-actions">
            <a class="primary-button" href="/app/">
              Start practicing
              <span aria-hidden="true">→</span>
            </a>
            <button type="button" class="text-action" onClick={() => jump(1.5)}>
              Watch it work
              <span aria-hidden="true">↓</span>
            </button>
          </div>
          <ul class="hero-notes" aria-label="Product highlights">
            <li>No account needed</li>
            <li>Free to use</li>
            <li>Works in your browser</li>
          </ul>
        </div>
        <p
          class="scroll-cue"
          style={{ opacity: 1 - span(units(), 0, 0.3) }}
          aria-hidden="true"
        >
          SCROLL
          <i />
        </p>

        <div class="captions">
          <For each={STORY_CHAPTERS}>
            {(chapter) => (
              <article
                class="caption"
                classList={{ active: active()?.id === chapter.id }}
                aria-labelledby={`chapter-${chapter.id}`}
              >
                <p class="eyebrow">
                  <span lang="ja" aria-hidden="true">
                    {chapter.kanji}
                  </span>
                  {chapter.eyebrow}
                </p>
                <h2 id={`chapter-${chapter.id}`} aria-label={chapter.title}>
                  <For each={chapter.title.split(" ")}>
                    {(word, index) => (
                      <span
                        class="word"
                        style={{ "--i": index() }}
                        aria-hidden="true"
                      >
                        <span>{word}</span>
                      </span>
                    )}
                  </For>
                </h2>
                <p class="caption-body">{chapter.body}</p>
              </article>
            )}
          </For>
        </div>

        <nav
          class="chapters"
          classList={{ shown: Boolean(active()) }}
          aria-label="Walkthrough chapters"
        >
          <span class="chapters-track" aria-hidden="true">
            <span style={{ transform: `scaleY(${progress()})` }} />
          </span>
          <For each={STORY_CHAPTERS}>
            {(chapter) => (
              <button
                type="button"
                classList={{ active: active()?.id === chapter.id }}
                aria-current={active()?.id === chapter.id ? "step" : undefined}
                aria-label={chapter.title}
                onClick={() => jump(chapter.start + 0.45)}
              >
                <span lang="ja" aria-hidden="true">
                  {chapter.kanji}
                </span>
              </button>
            )}
          </For>
        </nav>
        <span class="mobile-progress" aria-hidden="true">
          <span style={{ transform: `scaleX(${progress()})` }} />
        </span>

        <div class="finale" classList={{ active: finale() }}>
          <p class="eyebrow">YOUR NEXT PAGE IS BLANK</p>
          <h2>
            <span class="line">
              <span>Ready when</span>
            </span>
            <span class="line">
              <em>you are.</em>
            </span>
          </h2>
          <a
            class="primary-button"
            href="/app/"
            tabindex={finale() ? undefined : -1}
          >
            Open a fresh sheet
            <span aria-hidden="true">→</span>
          </a>
          <p>Pick a character. Fill one square, then the next.</p>
        </div>
      </div>
    </section>
  );
}

export default function Landing() {
  let jump: (at: number) => void = () => {};
  return (
    <>
      <a class="skip-link" href="#main">
        Skip to content
      </a>
      <header class="site-header">
        <Brand />
        <nav class="site-nav" aria-label="Main navigation">
          <button type="button" onClick={() => jump(1.5)}>
            How it works
          </button>
          <a href="#faq">FAQ</a>
        </nav>
        <a class="header-open" href="/app/">
          Open the app
          <span aria-hidden="true">↗</span>
        </a>
      </header>
      <main id="main">
        <Story onReady={(next) => (jump = next)} />
        <section class="faq container" id="faq" aria-labelledby="faq-title">
          <div>
            <p class="eyebrow">GOOD TO KNOW</p>
            <h2 id="faq-title">
              Questions,
              <br />
              <em>answered.</em>
            </h2>
          </div>
          <div class="faq-list">
            <For each={QUESTIONS}>
              {(item) => (
                <details>
                  <summary>
                    {item.question}
                    <span aria-hidden="true">+</span>
                  </summary>
                  <p>{item.answer}</p>
                </details>
              )}
            </For>
            <a class="primary-button" href="/app/">
              Start practicing
              <span aria-hidden="true">→</span>
            </a>
          </div>
        </section>
      </main>
      <footer class="site-footer container">
        <span lang="ja">原稿用紙 · GENKOU YOUSHI</span>
        <span>JAPANESE, ONE SQUARE AT A TIME.</span>
        <nav aria-label="Footer navigation">
          <a href="/licenses/">CREDITS &amp; LICENSES ↗</a>
          <a href="/app/">OPEN APP ↗</a>
        </nav>
      </footer>
    </>
  );
}
