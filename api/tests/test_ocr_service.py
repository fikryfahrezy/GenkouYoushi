import unittest
from base64 import b64encode

from kanji_api.errors import ImageTooLargeError, InvalidImageError
from kanji_api.services.ocr import (
    OCRImage,
    OCRService,
    candidates_from_tesseract_tsv,
)
from kanji_api.schemas import OCRCandidate


class StubProvider:
    def __init__(self, character: str) -> None:
        self.character = character
        self.images: list[OCRImage] = []

    def recognize(self, image: OCRImage) -> list[OCRCandidate]:
        self.images.append(image)
        return [OCRCandidate(character=self.character, confidence=0.9)]


class OCRServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.local = StubProvider("永")
        self.google = StubProvider("字")
        self.service = OCRService(
            providers={"tesseract": self.local, "google": self.google},
            maximum_image_bytes=8,
        )

    def test_defaults_to_tesseract(self) -> None:
        result = self.service.recognize(b64encode(b"image").decode(), "image/jpeg")

        self.assertEqual(result[0].character, "永")
        self.assertEqual(self.local.images[0].bytes, b"image")
        self.assertEqual(self.google.images, [])

    def test_uses_explicit_provider(self) -> None:
        result = self.service.recognize(
            b64encode(b"image").decode(), "image/jpeg", "google"
        )

        self.assertEqual(result[0].character, "字")
        self.assertEqual(len(self.google.images), 1)

    def test_rejects_invalid_base64(self) -> None:
        with self.assertRaises(InvalidImageError):
            self.service.recognize("not base64", "image/jpeg")

    def test_rejects_large_images(self) -> None:
        with self.assertRaises(ImageTooLargeError):
            self.service.recognize(b64encode(b"too large").decode(), "image/jpeg")

    def test_does_not_turn_transcribed_text_into_fake_candidates(self) -> None:
        tsv = (
            "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n"
            "5\t1\t1\t1\t1\t1\t0\t0\t10\t10\t72\t文字\n"
            "5\t1\t1\t1\t1\t2\t0\t0\t10\t10\t95\t永\n"
        )

        result = candidates_from_tesseract_tsv(tsv)

        self.assertEqual([candidate.character for candidate in result], ["永"])
        self.assertEqual(result[0].confidence, 0.95)


if __name__ == "__main__":
    unittest.main()
