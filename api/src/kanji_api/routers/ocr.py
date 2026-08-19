from typing import cast

from fastapi import APIRouter, Request

from ..rate_limit import SlidingWindowRateLimiter
from ..services import OCRService
from ..schemas import OCRRequest, OCRResponse

router = APIRouter(prefix="/ocr", tags=["ocr"])


@router.post("/kanji", response_model=OCRResponse)
def recognize_kanji(payload: OCRRequest, request: Request) -> OCRResponse:
    limiter = cast(SlidingWindowRateLimiter, request.app.state.ocr_rate_limiter)
    service = cast(OCRService, request.app.state.ocr_service)
    client_key = request.client.host if request.client else "unknown"
    limiter.check(client_key)
    return OCRResponse(
        candidates=service.recognize(
            image_base64=payload.image,
            mime_type=payload.mime_type,
            provider_name=payload.provider,
        )
    )
