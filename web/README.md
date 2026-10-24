# Genkou Youshi Web

A SolidJS and TypeScript PWA port of the iPad app, built with SolidStart. Solid owns the reactive UI while the drawing engine remains framework-independent.

## Local development

```sh
cd web
bun install
cp .env.example .env.local
bun run dev
```

Set the external service URL in `.env.local`:

```dotenv
VITE_API_BASE_URL=http://localhost:8000
```

## Code quality

Run Oxlint and Oxfmt from the `web` directory:

```sh
bun run lint
bun run lint:fix
bun run format
bun run format:check
```

The repository's Lefthook pre-commit hook formats and lints staged web files. Install it once
from the repository root after cloning:

```sh
lefthook install
```

## External API contract

The PWA is backend-agnostic. `VITE_API_BASE_URL` must point to an HTTP service that permits requests from the PWA origin and implements:

- `GET /kanji/{character}?with_number=false`
- `POST /ocr/kanji`

Kanji lookup must return:

```json
{
  "kanji": "永",
  "stroke_orders": ["base64-encoded-svg"]
}
```

OCR receives a base64 image:

```json
{
  "image": "base64-encoded-image",
  "mime_type": "image/jpeg",
  "provider": "tesseract"
}
```

The `provider` property is optional. OCR returns ranked candidates:

```json
{
  "candidates": [{ "character": "永", "confidence": 0.92 }]
}
```

Photo recognition runs locally in the browser first with the DaKanji single-character ONNX model. Images remain on the device when local recognition succeeds and the returned choices are genuine top-k model probabilities. If the browser cannot initialize the local WASM runtime, the PWA uses the API's Tesseract provider as a final printed-text fallback. Google Vision remains supported by the API but is not called by the PWA.

The model and label map in `public/models/dakanji` come from the official [DaKanji Single Kanji Recognition v2.0 release](https://github.com/dariyooo/DaKanji-Single-Kanji-Recognition/releases/tag/v2.0) and are distributed under its MIT license. Character recognition is powered by machine learning from Dariyooo (DaAppLab).

## Production

Build the static site with:

```sh
bun run build
```

Deploy the generated `web/.output/public` directory to any HTTPS static host. Set `VITE_API_BASE_URL` to a compatible service before building. The marketing landing page is served at `/`, while the installable application lives at `/app/`.

SolidStart's static preset prerenders every route at build time (see `src/routes`). The landing (`/`) and credits (`/licenses/`) pages ship as complete HTML and hydrate afterwards; `/app/` prerenders only its document shell because the workspace renders client-side.

To install the PWA, first open `/app/`, then use the browser menu or Share sheet and choose **Install app** or **Add to Home Screen**. The installed PWA always launches at `/app/`; the landing page is outside its manifest and service-worker scope.

## Apple Pencil and Scribble on iPadOS

For now, users should turn off **Settings → Apple Pencil → Scribble** for reliable rapid strokes. With Scribble enabled, iPadOS can interpret short, direction-changing Pencil contacts as handwriting and claim the interaction before Safari delivers a complete pointer-event stream to the canvas. The app cannot change this system setting.

Palm contact outside the canvas is handled separately. The practice interface disables native touch gestures, callouts, and text selection so a palm resting on either sidebar does not start a browser selection while drawing.

Relevant platform documentation and issue history:

- [Apple Pencil and Scribble — Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/apple-pencil-and-scribble)
- [Apple: suppressing Scribble near a native drawing canvas](https://developer.apple.com/documentation/uikit/uiscribbleinteractiondelegate/scribbleinteraction%28_%3Ashouldbeginat%3A%29)
- [Apple: Pointer Events and `touch-action` in iPadOS Safari](https://developer.apple.com/videos/play/wwdc2019/203/)
- [WebKit bug 217430: missing Pointer Events with Scribble enabled](https://bugs.webkit.org/show_bug.cgi?id=217430)
- [WebKit bug 246313: missing second `pointerdown`/`touchstart` in a Home Screen web app](https://bugs.webkit.org/show_bug.cgi?id=246313)
- [WebKit bug 203031: missing second `pointerdown` on iPad](https://bugs.webkit.org/show_bug.cgi?id=203031)
- [W3C Pointer Events issue 516: proposed web control over handwriting behavior](https://github.com/w3c/pointerevents/issues/516)

The linked WebKit reports describe related historical failures and may be marked fixed; they are retained here as background for this class of iPadOS event-delivery issue rather than proof of a single current regression.

## Storage and export

Practice sheets are saved to IndexedDB in the current browser profile. Export uses the system print dialog; choose **Save as PDF** or the equivalent option on your device. Clearing the site's browser data will also remove local sheets.

## Credits and licenses

The landing page and app link to `/licenses/`, which credits KanjiVG and DaKanji
and links to complete third-party license texts. The PWA caches these notices
for offline access. Sheets containing KanjiVG guides include attribution in
printed/PDF exports.

`license-notices.ts`, adapted from Kaku's notice workflow, inventories packages
actually included in the browser/worker bundles and includes their complete
license texts. Run `bun run build` to regenerate the development snapshot in
`public/licenses/THIRD_PARTY_NOTICES.txt`; the same notices are emitted in `.output/public`.
Missing package license texts fail the build. ONNX Runtime's MIT license and
complete third-party notice collection are vendored in `licenses/onnxruntime-1.22.0`.
Update those files and the version guard when upgrading ONNX Runtime. Its WASM
assets are copied directly from the installed package by the Vite build.

KanjiVG-derived diagrams are licensed under CC BY-SA 3.0 and identify modifications
for progressive stroke display and optional removal of stroke numbers. This
asset license is separate from the project's MIT code license.

The landing page uses system monospace, serif, and sans-serif font stacks,
matching Kaku and Tsuzuru without loading external font files.
