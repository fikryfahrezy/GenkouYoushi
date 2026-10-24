import type { JSX } from "solid-js";
import "../licenses.css";

function Credit(props: { id: string; title: string; children: JSX.Element }) {
  return (
    <section aria-labelledby={props.id}>
      <h2 id={props.id}>{props.title}</h2>
      {props.children}
    </section>
  );
}

export default function Licenses() {
  return (
    <main>
      <a href="/">← Genkou Youshi home</a>
      <h1>Credits &amp; licenses</h1>
      <p>
        Genkou Youshi is built with open-source software. We thank the authors
        and contributors who make it possible.
      </p>
      <Credit id="stroke-credit" title="Stroke diagrams">
        <p>
          Stroke diagrams adapted from{" "}
          <a href="https://kanjivg.tagaini.net/">KanjiVG</a>, copyright Ulrich
          Apel, licensed under{" "}
          <a href="https://creativecommons.org/licenses/by-sa/3.0/">
            CC BY-SA 3.0
          </a>
          . Modified to show progressive strokes and optionally omit stroke
          numbers. The adapted diagrams retain CC BY-SA 3.0.
        </p>
        <a href="/licenses/KanjiVG-CC-BY-SA-3.0.txt">
          Read the full KanjiVG license
        </a>
      </Credit>
      <Credit id="recognition-credit" title="Handwriting recognition">
        <p>
          Character recognition powered by machine learning from Dariyooo
          (DaAppLab).
        </p>
        <p>
          We use{" "}
          <a href="https://github.com/dariyooo/DaKanji-Single-Kanji-Recognition/releases/tag/v2.0">
            DaKanji Single Kanji Recognition v2.0
          </a>
          , licensed under MIT. Copyright (c) 2021 CaptainDario.
        </p>
        <a href="/models/dakanji/LICENSE.txt">Read the full DaKanji license</a>
      </Credit>
      <Credit id="software-notices" title="Software notices">
        <p>
          The full notices include license texts, copyright notices, and
          versions for the packages bundled into the browser app, plus ONNX
          Runtime's upstream third-party notices for its WASM runtime.
        </p>
        <p>
          <a href="/licenses/THIRD_PARTY_NOTICES.txt">
            Read all third-party notices
          </a>
        </p>
        <p>
          <a href="/app/">Open the writing pad →</a>
        </p>
      </Credit>
    </main>
  );
}
