from typing import Annotated, cast

from fastapi import APIRouter, Path, Query, Request

from ..services import KanjiService
from ..schemas import KanjiResponse

router = APIRouter(prefix="/kanji", tags=["kanji"])


@router.get("/{character}", response_model=KanjiResponse)
def get_kanji(
    request: Request,
    character: Annotated[str, Path(title="The kanji to get.", min_length=1, max_length=1)],
    with_number: Annotated[
        bool, Query(description="Include stroke-order numbers.")
    ] = True,
) -> KanjiResponse:
    service = cast(KanjiService, request.app.state.kanji_service)
    return service.lookup(character, include_numbers=with_number)
