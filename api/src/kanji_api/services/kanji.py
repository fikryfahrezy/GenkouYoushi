from base64 import b64encode
from json import JSONDecodeError, loads
from re import Match, search
from threading import Lock
from time import monotonic
from typing import TypeAlias
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen
from xml.etree import ElementTree

from ..errors import KanjiNotFoundError, UpstreamDataError, UpstreamServiceError
from ..schemas import KanjiResponse

SVG_NAMESPACE = {"svg": "http://www.w3.org/2000/svg"}
KanjiIndex: TypeAlias = dict[str, list[str]]


class KanjiVGClient:
    def __init__(
        self,
        index_url: str,
        files_url: str,
        timeout_seconds: float,
        index_cache_seconds: float,
    ) -> None:
        self._index_url = index_url
        self._files_url = files_url.rstrip("/") + "/"
        self._timeout_seconds = timeout_seconds
        self._index_cache_seconds = index_cache_seconds
        self._cached_index: KanjiIndex | None = None
        self._index_loaded_at = 0.0
        self._index_lock = Lock()

    def filename_for(self, character: str) -> str:
        filenames = self._index().get(character, [])
        if not filenames:
            raise KanjiNotFoundError("Kanji not found in the KanjiVG index.")
        return filenames[-1]

    def svg(self, filename: str) -> str:
        return self._get_text(urljoin(self._files_url, filename), "KanjiVG SVG")

    def _index(self) -> KanjiIndex:
        now = monotonic()
        if (
            self._cached_index is not None
            and now - self._index_loaded_at < self._index_cache_seconds
        ):
            return self._cached_index

        with self._index_lock:
            now = monotonic()
            if (
                self._cached_index is not None
                and now - self._index_loaded_at < self._index_cache_seconds
            ):
                return self._cached_index
            raw_index = self._get_text(self._index_url, "KanjiVG index")
            try:
                payload = loads(raw_index)
            except JSONDecodeError as error:
                raise UpstreamDataError("KanjiVG returned an invalid index.") from error
            if not isinstance(payload, dict):
                raise UpstreamDataError("KanjiVG returned an invalid index shape.")
            self._cached_index = {
                character: [str(filename) for filename in filenames]
                for character, filenames in payload.items()
                if isinstance(character, str) and isinstance(filenames, list)
            }
            self._index_loaded_at = now
            return self._cached_index

    def _get_text(self, url: str, resource_name: str) -> str:
        request = Request(url=url, headers={"Accept": "application/json,image/svg+xml"})
        try:
            with urlopen(request, timeout=self._timeout_seconds) as response:
                return response.read().decode("utf-8")
        except HTTPError as error:
            raise UpstreamServiceError(
                f"{resource_name} request failed with status {error.code}."
            ) from error
        except URLError as error:
            raise UpstreamServiceError(f"Could not reach {resource_name}.") from error
        except UnicodeDecodeError as error:
            raise UpstreamDataError(f"{resource_name} was not UTF-8 text.") from error


class KanjiService:
    def __init__(self, client: KanjiVGClient) -> None:
        self._client = client

    def lookup(self, character: str, include_numbers: bool) -> KanjiResponse:
        filename = self._client.filename_for(character)
        svg = self._client.svg(filename)
        stroke_id = filename.removesuffix(".svg")
        progressive_svgs = progressive_stroke_svgs(svg, stroke_id, include_numbers)
        return KanjiResponse(
            kanji=character,
            stroke_orders=[
                b64encode(progressive.encode("utf-8")).decode("ascii")
                for progressive in progressive_svgs
            ],
        )


def progressive_stroke_svgs(
    svg: str,
    stroke_id: str,
    include_numbers: bool,
) -> list[str]:
    svg_tag = _required_match(
        r'<svg xmlns="http://www.w3.org/2000/svg".*?>', svg, "SVG tag"
    )
    path_group_tag = _required_match(
        r'<g id="kvg:StrokePaths.*?>', svg, "stroke path group"
    )
    number_group_tag = _required_match(
        r'<g id="kvg:StrokeNumbers.*?>', svg, "stroke number group"
    )

    try:
        root = ElementTree.fromstring(svg)
    except ElementTree.ParseError as error:
        raise UpstreamDataError("KanjiVG returned malformed SVG.") from error

    path_group = root.find(f".//svg:*[@id='kvg:StrokePaths_{stroke_id}']", SVG_NAMESPACE)
    number_group = root.find(f".//svg:*[@id='kvg:StrokeNumbers_{stroke_id}']", SVG_NAMESPACE)
    if path_group is None or number_group is None:
        raise UpstreamDataError("KanjiVG SVG is missing stroke groups.")

    ElementTree.register_namespace("", SVG_NAMESPACE["svg"])
    paths = path_group.findall(".//svg:path", SVG_NAMESPACE)
    numbers = number_group.findall(".//svg:text", SVG_NAMESPACE)
    if not paths:
        raise UpstreamDataError("KanjiVG SVG contains no stroke paths.")

    progressive: list[str] = []
    for index, path in enumerate(paths):
        path_markup = _serialize(paths[:index]) + f"\t{_element_markup(path)}"
        number_markup = (
            _serialize(numbers[:index]) + f"\t{_element_markup(numbers[index])}"
            if include_numbers and index < len(numbers)
            else ""
        )
        progressive.append(
            f"""{svg_tag}
{path_group_tag}
{path_markup}
</g>
{number_group_tag}
{number_markup}
</g>
</svg>
"""
        )
    return progressive


def _required_match(pattern: str, value: str, label: str, flags: int = 0) -> str:
    match: Match[str] | None = search(pattern, value, flags)
    if match is None:
        raise UpstreamDataError(f"KanjiVG SVG is missing its {label}.")
    return match.group(0)


def _element_markup(element: ElementTree.Element) -> str:
    return ElementTree.tostring(element, encoding="unicode", method="xml").strip()


def _serialize(elements: list[ElementTree.Element]) -> str:
    return "".join(f"\t{_element_markup(element)}\n" for element in elements)
