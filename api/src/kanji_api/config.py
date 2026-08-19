from dataclasses import dataclass
from os import environ


@dataclass(frozen=True, slots=True)
class Settings:
    cors_origins: tuple[str, ...]
    http_timeout_seconds: float
    kanjivg_index_url: str
    kanjivg_files_url: str
    kanjivg_index_cache_seconds: float
    ocr_max_image_bytes: int
    ocr_rate_limit_per_hour: int
    ocr_timeout_seconds: float
    tesseract_command: str
    tesseract_language: str
    tesseract_page_segmentation_mode: str
    google_vision_api_key: str | None

    @classmethod
    def from_environment(cls) -> "Settings":
        origins = tuple(
            origin.strip()
            for origin in environ.get("CORS_ORIGINS", "*").split(",")
            if origin.strip()
        )
        return cls(
            cors_origins=origins or ("*",),
            http_timeout_seconds=float(environ.get("HTTP_TIMEOUT_SECONDS", "20")),
            kanjivg_index_url=environ.get(
                "KANJIVG_INDEX_URL",
                "https://raw.githubusercontent.com/KanjiVG/kanjivg/refs/heads/master/kvg-index.json",
            ),
            kanjivg_files_url=environ.get(
                "KANJIVG_FILES_URL",
                "https://raw.githubusercontent.com/KanjiVG/kanjivg/refs/heads/master/kanji/",
            ),
            kanjivg_index_cache_seconds=float(
                environ.get("KANJIVG_INDEX_CACHE_SECONDS", "86400")
            ),
            ocr_max_image_bytes=int(environ.get("OCR_MAX_IMAGE_BYTES", str(5 * 1024 * 1024))),
            ocr_rate_limit_per_hour=int(environ.get("OCR_RATE_LIMIT_PER_HOUR", "20")),
            ocr_timeout_seconds=float(environ.get("OCR_TIMEOUT_SECONDS", "20")),
            tesseract_command=environ.get("OCR_TESSERACT_COMMAND", "tesseract"),
            tesseract_language=environ.get("OCR_TESSERACT_LANGUAGE", "jpn"),
            tesseract_page_segmentation_mode=environ.get("OCR_TESSERACT_PSM", "10"),
            google_vision_api_key=environ.get("GOOGLE_VISION_API_KEY") or None,
        )
