import { For, type JSX } from "solid-js";
import "../landing.css";

type Step = {
  number: string;
  title: string;
  description: string;
};

type StoryFact = {
  value: string;
  lines: [string, string];
};

type Question = {
  question: string;
  answer: string;
  open?: boolean;
};

const STEPS: Step[] = [
  {
    number: "一",
    title: "Choose your paper",
    description:
      "Start with a standard 20 × 20 sheet or a compact 10 × 20 grid.",
  },
  {
    number: "二",
    title: "Find your character",
    description:
      "Type a kanji or recognize one from a photo to load its tracing guides and stroke order.",
  },
  {
    number: "三",
    title: "Write, refine, repeat",
    description:
      "Practice with tracing guides, adjust your tools, then save or export the result.",
  },
];

const STORY_FACTS: StoryFact[] = [
  { value: "200 / 400", lines: ["characters", "per sheet"] },
  { value: "2", lines: ["writing tools", "plus an eraser"] },
  { value: "∞", lines: ["fresh sheets", "for your practice"] },
];

const QUESTIONS: Question[] = [
  {
    question: "Do I need to create an account?",
    answer:
      "No. Open the app and start practicing immediately. Your sheets are stored locally in your current browser.",
    open: true,
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

function Eyebrow(props: { light?: boolean; children: JSX.Element }) {
  return (
    <p class="eyebrow" classList={{ "eyebrow-light": props.light }}>
      <span></span>
      {props.children}
    </p>
  );
}

function Brand(props: { caption?: boolean }) {
  return (
    <a class="brand" href="/" aria-label="Genkou Youshi home">
      <span class="brand-seal" lang="ja" aria-hidden="true">
        原
      </span>
      {props.caption ? (
        <span class="brand-name">
          Genkou Youshi
          <span class="brand-caption">JAPANESE HANDWRITING PRACTICE</span>
        </span>
      ) : (
        <span>Genkou Youshi</span>
      )}
    </a>
  );
}

function FeatureMark(props: { children: string }) {
  return (
    <span class="feature-mark" lang="ja" aria-hidden="true">
      {props.children}
    </span>
  );
}

function SiteHeader() {
  return (
    <header class="site-header">
      <div class="container header-inner">
        <Brand caption />
        <nav class="site-nav" aria-label="Main navigation">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <a href="#faq">FAQ</a>
        </nav>
        <a class="button button-small button-ink" href="/app/">
          Open the app
          <span aria-hidden="true">↗</span>
        </a>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section class="hero">
      <div class="hero-mark hero-mark-one" aria-hidden="true">
        練
      </div>
      <div class="hero-mark hero-mark-two" aria-hidden="true">
        習
      </div>
      <div class="container hero-grid">
        <div class="hero-copy">
          <Eyebrow>A quieter place to practice</Eyebrow>
          <h1>
            Write Japanese
            <br />
            <em>one square at a time.</em>
          </h1>
          <p class="hero-intro">
            A focused handwriting workspace inspired by traditional manuscript
            paper—complete with stroke-order references, drawing tools, and
            sheets that stay on your device.
          </p>
          <div class="hero-actions">
            <a class="button button-primary" href="/app/">
              Start practicing
              <span aria-hidden="true">→</span>
            </a>
            <a class="text-link" href="#how-it-works">
              See how it works
              <span aria-hidden="true">↓</span>
            </a>
          </div>
          <ul class="hero-notes" aria-label="Product highlights">
            <li>No account needed</li>
            <li>Free to use</li>
            <li>Works in your browser</li>
          </ul>
        </div>

        <div
          class="hero-visual"
          aria-label="Preview of the Genkou Youshi practice workspace"
        >
          <div class="ink-orbit orbit-one" aria-hidden="true"></div>
          <div class="ink-orbit orbit-two" aria-hidden="true"></div>
          <figure class="app-window screenshot-window">
            <img
              src="/app-workspace.png"
              alt="Genkou Youshi app showing a 20 by 20 manuscript sheet, writing tools, and the kanji reference panel"
              width="1440"
              height="1000"
            />
          </figure>
        </div>
      </div>
    </section>
  );
}

function TrustStrip() {
  return (
    <section class="trust-strip" aria-label="Key product qualities">
      <div class="container trust-grid">
        <div>
          <span class="trust-number">01</span>
          <strong>Traditional structure</strong>
          <small>Authentic 200 &amp; 400 character grids</small>
        </div>
        <div>
          <span class="trust-number">02</span>
          <strong>Modern convenience</strong>
          <small>Draw, undo, save, and export</small>
        </div>
        <div>
          <span class="trust-number">03</span>
          <strong>Private by design</strong>
          <small>Practice sheets remain in your browser</small>
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section class="features section" id="features">
      <div class="container">
        <div class="section-heading centered-heading">
          <Eyebrow>Everything you need</Eyebrow>
          <h2>
            Less setup.
            <br />
            <em>More writing.</em>
          </h2>
          <p>
            Simple tools that keep your attention on the page, not the
            interface.
          </p>
        </div>
        <div class="feature-grid">
          <article class="feature-card feature-card-large feature-guides">
            <div class="feature-copy">
              <FeatureMark>導</FeatureMark>
              <h3>Guided practice</h3>
              <p>
                Choose any kanji, trace progressive guides across the page, and
                open a stroke-by-stroke diagram whenever you need it.
              </p>
            </div>
            <div class="guide-demo" aria-hidden="true">
              <For each={[1, 2, 3, 4]}>
                {(step) => (
                  <div>
                    <span>永</span>
                    <i>{step}</i>
                  </div>
                )}
              </For>
            </div>
          </article>
          <article class="feature-card feature-tools">
            <FeatureMark>筆</FeatureMark>
            <h3>Natural writing tools</h3>
            <p>
              Write with a pen or pencil, then refine with the eraser. Adjust
              line weight until every stroke feels right.
            </p>
            <div class="tool-strokes" aria-hidden="true">
              <i></i>
              <i></i>
              <i></i>
            </div>
          </article>
          <article class="feature-card feature-recognize">
            <FeatureMark>認</FeatureMark>
            <h3>Recognize from a photo</h3>
            <p>
              Not sure what a character is? Upload a photo, frame the character,
              and choose from the closest matches.
            </p>
            <div class="recognize-demo" aria-hidden="true">
              <span>本</span>
              <span>木</span>
              <span>休</span>
              <small>matches</small>
            </div>
          </article>
          <article class="feature-card feature-library">
            <div class="feature-copy">
              <FeatureMark>冊</FeatureMark>
              <h3>Your own practice library</h3>
              <p>
                Create as many sheets as you need. They save automatically in
                your browser and are ready when you return.
              </p>
            </div>
            <div class="library-demo" aria-hidden="true">
              <div>
                <b>永</b>
                <span>
                  <strong>永 practice</strong>
                  <small>400 characters</small>
                </span>
              </div>
              <div>
                <b>水</b>
                <span>
                  <strong>水 practice</strong>
                  <small>200 characters</small>
                </span>
              </div>
            </div>
          </article>
          <article class="feature-card feature-export">
            <FeatureMark>印</FeatureMark>
            <h3>Export as PDF</h3>
            <p>
              Keep a clean record, print your work, or share a finished practice
              sheet in just a few clicks.
            </p>
            <div class="pdf-stamp" aria-hidden="true">
              PDF
              <span>↗</span>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

function Steps() {
  return (
    <section class="steps section" id="how-it-works">
      <div class="container steps-layout">
        <div class="steps-intro">
          <Eyebrow light>Your practice ritual</Eyebrow>
          <h2>
            From reference
            <br />
            to rhythm.
          </h2>
          <p>
            Open a fresh sheet and begin. Genkou Youshi keeps the process
            intentionally simple.
          </p>
          <a class="button button-primary" href="/app/">
            Open a fresh sheet
            <span aria-hidden="true">→</span>
          </a>
        </div>
        <ol class="step-list">
          <For each={STEPS}>
            {(step) => (
              <li>
                <span class="step-number">{step.number}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
              </li>
            )}
          </For>
        </ol>
      </div>
    </section>
  );
}

function PaperStory() {
  return (
    <section class="paper-story section">
      <div class="container story-grid">
        <div class="story-visual" aria-hidden="true">
          <div class="story-sheet story-sheet-back"></div>
          <div class="story-sheet story-sheet-front">
            <span class="vertical-copy">書くことで、心を整える。</span>
            <strong>学</strong>
            <i class="red-mark"></i>
          </div>
        </div>
        <div class="story-copy">
          <Eyebrow>A page with purpose</Eyebrow>
          <h2>
            Made for the
            <br />
            <em>practice of writing.</em>
          </h2>
          <p>
            Genkō yōshi—literally “manuscript paper”—has long given Japanese
            writing a measured rhythm. Each square holds one character, making
            spacing and composition visible.
          </p>
          <p>
            This digital version preserves that structure while adding the tools
            a modern learner needs. No clutter. No streaks to maintain. Just a
            considered space to return to your writing.
          </p>
          <dl class="story-facts">
            <For each={STORY_FACTS}>
              {(fact) => (
                <div>
                  <dt>{fact.value}</dt>
                  <dd>
                    {fact.lines[0]}
                    <br />
                    {fact.lines[1]}
                  </dd>
                </div>
              )}
            </For>
          </dl>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section class="faq section" id="faq">
      <div class="container faq-layout">
        <div class="section-heading">
          <Eyebrow>Good to know</Eyebrow>
          <h2>
            Questions,
            <br />
            <em>answered.</em>
          </h2>
        </div>
        <div class="faq-list">
          <For each={QUESTIONS}>
            {(item) => (
              <details open={item.open}>
                <summary>
                  {item.question}
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{item.answer}</p>
              </details>
            )}
          </For>
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section class="final-cta">
      <div class="container final-content">
        <span class="final-seal" aria-hidden="true">
          原
        </span>
        <Eyebrow light>Your next page is blank</Eyebrow>
        <h2>
          Ready when
          <br />
          <em>you are.</em>
        </h2>
        <p>Pick a character. Take your time. Fill one square, then the next.</p>
        <a class="button button-paper" href="/app/">
          Start practicing
          <span aria-hidden="true">→</span>
        </a>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer class="site-footer">
      <div class="container footer-main">
        <Brand />
        <nav aria-label="Footer navigation">
          <a href="/licenses/">Credits &amp; licenses ↗</a>
          <a href="/app/">Open app ↗</a>
        </nav>
      </div>
    </footer>
  );
}

export default function Landing() {
  return (
    <>
      <a class="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main">
        <Hero />
        <TrustStrip />
        <Features />
        <Steps />
        <PaperStory />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
