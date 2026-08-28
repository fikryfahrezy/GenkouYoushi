# Genkou Youshi Web

A SolidJS and TypeScript PWA port of the iPad app. Solid owns the reactive UI while the drawing engine remains framework-independent.

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
  "candidates": [
    { "character": "永", "confidence": 0.92 }
  ]
}
```

Photo recognition runs locally in the browser first with the DaKanji single-character ONNX model. Images remain on the device when local recognition succeeds and the returned choices are genuine top-k model probabilities. If the browser cannot initialize the local WASM runtime, the PWA uses the API's Tesseract provider as a final printed-text fallback. Google Vision remains supported by the API but is not called by the PWA.

The model and label map in `public/models/dakanji` come from the official [DaKanji Single Kanji Recognition v2.0 release](https://github.com/dariyooo/DaKanji-Single-Kanji-Recognition/releases/tag/v2.0) and are distributed under its MIT license. Character recognition is powered by machine learning from Dariyooo (DaAppLab).

## Production

Build the static site with:

```sh
bun run build
```

Deploy the generated `web/dist` directory to any HTTPS static host. Set `VITE_API_BASE_URL` to a compatible service before building. The marketing landing page is served at `/`, while the installable application lives at `/app/`.

To install the PWA, first open `/app/`, then use the browser menu or Share sheet and choose **Install app** or **Add to Home Screen**. The installed PWA always launches at `/app/`; the landing page is outside its manifest and service-worker scope.

## Storage and export

Practice sheets are saved to IndexedDB in the current browser profile. Export uses the system print dialog; choose **Save as PDF** or the equivalent option on your device. Clearing the site's browser data will also remove local sheets.
