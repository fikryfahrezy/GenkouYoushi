from enum import StrEnum

from pydantic import BaseModel, Field

class OCRProviderName(StrEnum):
    TESSERACT = "tesseract"
    GOOGLE = "google"


class KanjiResponse(BaseModel):
    kanji: str
    stroke_orders: list[str]


class OCRRequest(BaseModel):
    image: str = Field(min_length=1)
    mime_type: str = "image/jpeg"
    provider: OCRProviderName | None = None


class OCRCandidate(BaseModel):
    character: str
    confidence: float


class OCRResponse(BaseModel):
    candidates: list[OCRCandidate]
