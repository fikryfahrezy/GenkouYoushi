import unittest

from kanji_api.errors import RateLimitExceededError
from kanji_api.rate_limit import SlidingWindowRateLimiter


class RateLimiterTests(unittest.TestCase):
    def test_limits_and_expires_requests(self) -> None:
        now = [100.0]
        limiter = SlidingWindowRateLimiter(
            maximum_requests=2,
            window_seconds=60,
            clock=lambda: now[0],
        )

        limiter.check("client")
        limiter.check("client")
        with self.assertRaises(RateLimitExceededError):
            limiter.check("client")

        now[0] = 161.0
        limiter.check("client")


if __name__ == "__main__":
    unittest.main()
