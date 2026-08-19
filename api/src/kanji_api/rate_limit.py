from collections import defaultdict, deque
from collections.abc import Callable
from threading import Lock
from time import monotonic

from .errors import RateLimitExceededError


class SlidingWindowRateLimiter:
    def __init__(
        self,
        maximum_requests: int,
        window_seconds: float,
        clock: Callable[[], float] = monotonic,
    ) -> None:
        if maximum_requests < 1:
            raise ValueError("maximum_requests must be positive")
        if window_seconds <= 0:
            raise ValueError("window_seconds must be positive")
        self._maximum_requests = maximum_requests
        self._window_seconds = window_seconds
        self._clock = clock
        self._requests: defaultdict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def check(self, key: str) -> None:
        now = self._clock()
        cutoff = now - self._window_seconds
        with self._lock:
            requests = self._requests[key]
            while requests and requests[0] <= cutoff:
                requests.popleft()
            if len(requests) >= self._maximum_requests:
                raise RateLimitExceededError(
                    "Photo recognition limit reached. Try again later."
                )
            requests.append(now)
