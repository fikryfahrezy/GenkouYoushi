from collections.abc import Callable

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import Settings
from .errors import (
    ImageTooLargeError,
    InvalidImageError,
    KanjiAPIError,
    KanjiNotFoundError,
    OCRProviderError,
    OCRProviderUnavailableError,
    OCRTimeoutError,
    RateLimitExceededError,
    UpstreamDataError,
    UpstreamServiceError,
)
from .rate_limit import SlidingWindowRateLimiter
from .routers import kanji_router, ocr_router
from .services import (
    GoogleVisionProvider,
    KanjiService,
    KanjiVGClient,
    OCRService,
    TesseractProvider,
)

ErrorHandler = Callable[[Request, KanjiAPIError], JSONResponse]


def create_app(settings: Settings | None = None) -> FastAPI:
    configured = settings or Settings.from_environment()
    app = FastAPI(
        title="Genkou Youshi API",
        version="0.2.0",
        docs_url="/docs",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(configured.cors_origins),
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "Accept"],
    )
    _install_services(app, configured)
    _install_error_handlers(app)
    app.include_router(kanji_router)
    app.include_router(ocr_router)
    return app


def _install_services(app: FastAPI, settings: Settings) -> None:
    kanjivg_client = KanjiVGClient(
        index_url=settings.kanjivg_index_url,
        files_url=settings.kanjivg_files_url,
        timeout_seconds=settings.http_timeout_seconds,
        index_cache_seconds=settings.kanjivg_index_cache_seconds,
    )
    app.state.kanji_service = KanjiService(kanjivg_client)
    app.state.ocr_service = OCRService(
        providers={
            "tesseract": TesseractProvider(settings),
            "google": GoogleVisionProvider(settings),
        },
        maximum_image_bytes=settings.ocr_max_image_bytes,
    )
    app.state.ocr_rate_limiter = SlidingWindowRateLimiter(
        maximum_requests=settings.ocr_rate_limit_per_hour,
        window_seconds=60 * 60,
    )


def _install_error_handlers(app: FastAPI) -> None:
    status_codes: dict[type[KanjiAPIError], int] = {
        KanjiNotFoundError: 404,
        InvalidImageError: 400,
        RateLimitExceededError: 429,
        ImageTooLargeError: 413,
        UpstreamServiceError: 502,
        UpstreamDataError: 502,
        OCRProviderError: 502,
        OCRProviderUnavailableError: 503,
        OCRTimeoutError: 504,
    }
    for error_type, status_code in status_codes.items():
        app.add_exception_handler(error_type, _error_handler(status_code))


def _error_handler(status_code: int) -> ErrorHandler:
    async def handle(_: Request, error: KanjiAPIError) -> JSONResponse:
        return JSONResponse(status_code=status_code, content={"detail": str(error)})

    return handle


app = create_app()
