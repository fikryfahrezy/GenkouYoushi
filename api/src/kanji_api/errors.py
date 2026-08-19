class KanjiAPIError(Exception):
    """Base class for expected service-layer failures."""


class KanjiNotFoundError(KanjiAPIError):
    pass


class UpstreamServiceError(KanjiAPIError):
    pass


class UpstreamDataError(KanjiAPIError):
    pass


class InvalidImageError(KanjiAPIError):
    pass


class ImageTooLargeError(KanjiAPIError):
    pass


class OCRProviderUnavailableError(KanjiAPIError):
    pass


class OCRProviderError(KanjiAPIError):
    pass


class OCRTimeoutError(KanjiAPIError):
    pass


class RateLimitExceededError(KanjiAPIError):
    pass
