# Genkou Youshi Web

A framework-free TypeScript PWA port of the iPad app.

## Local development

```sh
cd web
npm install
cp .env.example .env.local
npm run dev
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

Photo recognition is optional from the PWA's perspective. A failure is shown to the user without disabling drawing, local storage, lookup, or export.

## Production

Build the static site with:

```sh
npm run build
```

Deploy the generated `web/dist` directory to any HTTPS static host. Set `VITE_API_BASE_URL` to a compatible service before building.

On iPad, open the site in Safari and use **Share → Add to Home Screen**.

## Storage and export

Practice sheets are saved to IndexedDB on the current browser profile. Export uses the system print sheet; choose PDF/Save to Files on iPadOS. Clearing Safari website data will also remove local sheets.
