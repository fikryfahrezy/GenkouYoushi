from base64 import b64decode
from binascii import Error as Base64Error
from csv import DictReader
from dataclasses import dataclass
from io import StringIO
from json import dumps, loads
from shutil import which
from subprocess import TimeoutExpired, run
from typing import Any, Protocol
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from ..config import Settings
from ..errors import (
    ImageTooLargeError,
    InvalidImageError,
    OCRProviderError,
    OCRProviderUnavailableError,
    OCRTimeoutError,
)
from ..schemas import OCRCandidate, OCRProviderName


@dataclass(frozen=True, slots=True)
class OCRImage:
    bytes: bytes
    base64: str
    mime_type: str


class OCRProvider(Protocol):
    def recognize(self, image: OCRImage) -> list[OCRCandidate]: ...


class OCRService:
    def __init__(
        self,
        providers: dict[OCRProviderName, OCRProvider],
        maximum_image_bytes: int,
    ) -> None:
        self._providers = providers
        self._maximum_image_bytes = maximum_image_bytes

    def recognize(
        self,
        image_base64: str,
        mime_type: str,
        provider_name: OCRProviderName | None = None,
    ) -> list[OCRCandidate]:
        try:
            image_bytes = b64decode(image_base64, validate=True)
        except (Base64Error, ValueError) as error:
            raise InvalidImageError("The image is not valid base64 data.") from error
        if len(image_bytes) > self._maximum_image_bytes:
            maximum_mb = self._maximum_image_bytes / (1024 * 1024)
            raise ImageTooLargeError(f"The image must be smaller than {maximum_mb:g} MB.")

        selected_provider = provider_name or "tesseract"
        provider = self._providers[selected_provider]
        return provider.recognize(
            OCRImage(bytes=image_bytes, base64=image_base64, mime_type=mime_type)
        )


class TesseractProvider:
    def __init__(self, settings: Settings) -> None:
        self._command = settings.tesseract_command
        self._language = settings.tesseract_language
        self._page_segmentation_mode = settings.tesseract_page_segmentation_mode
        self._timeout_seconds = settings.ocr_timeout_seconds

    def recognize(self, image: OCRImage) -> list[OCRCandidate]:
        if which(self._command) is None:
            raise OCRProviderUnavailableError(
                "The local OCR engine is not installed. Install Tesseract and its Japanese language data."
            )
        try:
            result = run(
                [
                    self._command,
                    "stdin",
                    "stdout",
                    "-l",
                    self._language,
                    "--psm",
                    self._page_segmentation_mode,
                    "tsv",
                ],
                input=image.bytes,
                capture_output=True,
                check=False,
                timeout=self._timeout_seconds,
            )
        except TimeoutExpired as error:
            raise OCRTimeoutError("The local OCR engine timed out.") from error

        if result.returncode != 0:
            message = result.stderr.decode("utf-8", errors="replace").strip()
            raise OCRProviderError(message or "The local OCR engine failed.")
        return candidates_from_tesseract_tsv(
            result.stdout.decode("utf-8", errors="replace")
        )


class GoogleVisionProvider:
    _endpoint = "https://vision.googleapis.com/v1/images:annotate"

    def __init__(self, settings: Settings) -> None:
        self._api_key = settings.google_vision_api_key
        self._timeout_seconds = settings.ocr_timeout_seconds

    def recognize(self, image: OCRImage) -> list[OCRCandidate]:
        if not self._api_key:
            raise OCRProviderUnavailableError(
                "GOOGLE_VISION_API_KEY is required for Google OCR requests."
            )
        body = dumps(
            {
                "requests": [
                    {
                        "image": {"content": image.base64},
                        "features": [
                            {"type": "DOCUMENT_TEXT_DETECTION", "maxResults": 10}
                        ],
                    }
                ]
            }
        ).encode("utf-8")
        request = Request(
            url=self._endpoint,
            data=body,
            headers={
                "Content-Type": "application/json",
                "X-Goog-Api-Key": self._api_key,
            },
            method="POST",
        )
        try:
            with urlopen(request, timeout=self._timeout_seconds) as response:
                result = loads(response.read().decode("utf-8"))
        except HTTPError as error:
            raise OCRProviderError("The OCR provider rejected the request.") from error
        except URLError as error:
            raise OCRProviderUnavailableError(
                "The OCR provider is currently unavailable."
            ) from error
        except (UnicodeDecodeError, ValueError) as error:
            raise OCRProviderError("The OCR provider returned invalid data.") from error

        provider_response = result.get("responses", [{}])[0]
        if provider_error := provider_response.get("error"):
            raise OCRProviderError(
                provider_error.get("message", "The OCR provider returned an error.")
            )
        return candidates_from_google_response(provider_response)


def candidates_from_tesseract_tsv(value: str) -> list[OCRCandidate]:
    candidates: dict[str, float] = {}
    for row in DictReader(StringIO(value), delimiter="\t"):
        try:
            confidence = min(max(float(row.get("conf", "50")), 0), 100) / 100
        except ValueError:
            confidence = 0.5
        _add_candidates(candidates, row.get("text", ""), confidence)
    return _sorted_candidates(candidates)


def candidates_from_google_response(response: dict[str, Any]) -> list[OCRCandidate]:
    candidates: dict[str, float] = {}
    for page in response.get("fullTextAnnotation", {}).get("pages", []):
        for block in page.get("blocks", []):
            for paragraph in block.get("paragraphs", []):
                for word in paragraph.get("words", []):
                    for symbol in word.get("symbols", []):
                        confidence = float(
                            symbol.get("confidence", word.get("confidence", 0.5))
                        )
                        _add_candidates(candidates, symbol.get("text", ""), confidence)

    if not candidates:
        annotations = response.get("textAnnotations", [])
        detected_text = annotations[0].get("description", "") if annotations else ""
        _add_candidates(candidates, detected_text, 0.5)
    return _sorted_candidates(candidates)


def _add_candidates(
    candidates: dict[str, float], value: str, confidence: float
) -> None:
    # OCR providers return transcriptions, not alternative predictions. Only a
    # one-character token can be represented honestly as a candidate here.
    characters = [character for character in value.strip() if is_kanji(character)]
    if len(characters) != 1 or len(value.strip()) != 1:
        return
    character = characters[0]
    candidates[character] = max(candidates.get(character, 0), confidence)


def _sorted_candidates(candidates: dict[str, float]) -> list[OCRCandidate]:
    return [
        OCRCandidate(character=character, confidence=confidence)
        for character, confidence in sorted(
            candidates.items(), key=lambda candidate: candidate[1], reverse=True
        )[:5]
    ]


def is_kanji(character: str) -> bool:
    if not character:
        return False
    scalar = ord(character[0])
    return (
        0x3400 <= scalar <= 0x4DBF
        or 0x4E00 <= scalar <= 0x9FFF
        or 0xF900 <= scalar <= 0xFAFF
    )
