# Genkou Youshi API

An independent FastAPI service for kanji stroke-order data and image-based kanji recognition.

## Local development

```sh
cd api
cp .env.example .env
uv run python -m uvicorn kanji_api:app --reload
```

The example environment allows browser requests from any origin so this API can
serve independently deployed clients. To restrict it, use a comma-separated
allowlist:

```dotenv
CORS_ORIGINS=http://localhost:3000,https://client.example.com
```

Use exact HTTPS origins for a restricted deployment. CORS is a browser policy,
not authentication; it does not protect a public OCR endpoint from direct HTTP
requests.

Run the backend tests with:

```sh
uv run python -m unittest discover -s tests -v
```

## HTTP API

`GET /kanji/{character}` returns progressive, base64-encoded KanjiVG SVG frames. Set `with_number=false` to omit stroke numbers.

```json
{
  "kanji": "永",
  "stroke_orders": ["base64-encoded-svg"]
}
```

`POST /ocr/kanji` recognizes kanji from a base64-encoded image. Its request and provider options are documented under OCR providers below.

## Architecture

The HTTP layer is deliberately thin:

```text
kanji_api/
├── main.py             application factory and dependency composition
├── config.py           environment-backed settings
├── errors.py           service-layer failure types
├── rate_limit.py       thread-safe sliding-window limiter
├── schemas.py          validated HTTP request and response models
├── routers/            FastAPI request and response handling
└── services/
    ├── kanji.py        KanjiVG client, cached index, SVG transformation
    └── ocr.py          OCR orchestration and provider adapters
```

Routes obtain their services from `app.state`, making the service layer independent of FastAPI and straightforward to unit test. Expected service failures are converted to HTTP responses by centralized exception handlers in `main.py`.

The KanjiVG index is cached in memory for 24 hours by default instead of being downloaded on every lookup. Configure this with `KANJIVG_INDEX_CACHE_SECONDS`.

## OCR providers

Photo recognition is enabled by default. The client can select a provider in each `POST /ocr/kanji` JSON request. If `provider` is absent or `null`, the API falls back to local Tesseract.

Local OCR request:

```json
{
  "image": "base64-encoded-image",
  "mime_type": "image/jpeg"
}
```

The equivalent explicit request is:

```json
{
  "image": "base64-encoded-image",
  "mime_type": "image/jpeg",
  "provider": "tesseract"
}
```

Cloud OCR request:

```json
{
  "image": "base64-encoded-image",
  "mime_type": "image/jpeg",
  "provider": "google"
}
```

Callers should resize and compress images before submission. The service rejects images larger than 5 MB by default; configure this with `OCR_MAX_IMAGE_BYTES`.

### Local Tesseract

Tesseract performs OCR inside the API container when the request omits `provider` or specifies `"provider": "tesseract"`. It needs no cloud account or per-request payment and is suitable for a small CPU server. The Docker image installs Tesseract and its Japanese `jpn` language data by default.

The default page-segmentation mode is `10`, which treats the crop as one character:

```dotenv
OCR_TESSERACT_LANGUAGE=jpn
OCR_TESSERACT_PSM=10
```

Tesseract is lightweight, but its handwritten-kanji accuracy is lower than a cloud model. Consumers should treat candidates as suggestions that may require confirmation. For a photo containing a line or block of text, try PSM `7` or `6` instead.

If the API runs without Docker, install the `tesseract` executable and Japanese language data on the host. On Debian/Ubuntu:

```sh
sudo apt-get install tesseract-ocr tesseract-ocr-jpn
```

### Google Cloud Vision

Specifying `"provider": "google"` keeps API CPU and memory usage low. The service forwards the compressed image to Google Vision and returns up to five kanji candidates. Keep `GOOGLE_VISION_API_KEY` in the server environment and never expose it to API consumers.

```dotenv
GOOGLE_VISION_API_KEY=your-key
```

If every client request will explicitly select Google, build a cloud-only Docker image that omits the local Tesseract packages:

```sh
INSTALL_LOCAL_OCR=false docker compose build
```

Configure a provider-side spending quota before exposing the endpoint publicly.

## Operational limits

```dotenv
OCR_RATE_LIMIT_PER_HOUR=20
OCR_TIMEOUT_SECONDS=20
```

The included rate limiter is basic, in-memory, and per process. It resets when the API restarts and is not a substitute for an authenticated gateway or shared rate limiter on a public multi-instance deployment.
