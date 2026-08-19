import unittest

from kanji_api.errors import UpstreamDataError
from kanji_api.services.kanji import KanjiVGClient, progressive_stroke_svgs

SVG = '''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg []>
<svg xmlns="http://www.w3.org/2000/svg" width="109" height="109">
  <g id="kvg:StrokePaths_04e00">
    <path d="M10,10 L90,10"/>
    <path d="M10,20 L90,20"/>
  </g>
  <g id="kvg:StrokeNumbers_04e00">
    <text x="1" y="1">1</text>
    <text x="1" y="2">2</text>
  </g>
</svg>'''


class KanjiSVGTests(unittest.TestCase):
    def test_builds_progressive_svg_frames(self) -> None:
        frames = progressive_stroke_svgs(SVG, "04e00", include_numbers=True)

        self.assertEqual(len(frames), 2)
        self.assertEqual(frames[0].count("<path"), 1)
        self.assertEqual(frames[1].count("<path"), 2)
        self.assertIn(">2</text>", frames[1])
        self.assertTrue(frames[0].startswith("<svg"))
        self.assertNotIn("<?xml", frames[0])
        self.assertNotIn("<!DOCTYPE", frames[0])

    def test_rejects_invalid_svg_shape(self) -> None:
        with self.assertRaises(UpstreamDataError):
            progressive_stroke_svgs("<svg/>", "04e00", include_numbers=False)

    def test_caches_the_kanjivg_index(self) -> None:
        class StubClient(KanjiVGClient):
            calls = 0

            def _get_text(self, url: str, resource_name: str) -> str:
                self.calls += 1
                return '{"永": ["06c38.svg"]}'

        client = StubClient(
            index_url="https://example.test/index.json",
            files_url="https://example.test/kanji/",
            timeout_seconds=1,
            index_cache_seconds=60,
        )

        self.assertEqual(client.filename_for("永"), "06c38.svg")
        self.assertEqual(client.filename_for("永"), "06c38.svg")
        self.assertEqual(client.calls, 1)


if __name__ == "__main__":
    unittest.main()
