"""Ограничение числа неудачных попыток входа (защита от подбора пароля).

Хранится в памяти процесса: для одного сервера этого достаточно. Если запускать несколько
копий сервера, счётчик лучше перенести в Redis.
"""
import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException, status

from .config import settings


class LoginLimiter:
    def __init__(self) -> None:
        self._failures: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    @staticmethod
    def key(ip: str, email: str) -> str:
        return f"{ip}|{email.strip().lower()}"

    def _cleanup(self, key: str, now: float) -> deque[float]:
        window = settings.login_window_minutes * 60
        attempts = self._failures[key]
        while attempts and now - attempts[0] > window:
            attempts.popleft()
        return attempts

    def check(self, key: str) -> None:
        """Ошибка 429, если неудачных попыток слишком много."""
        now = time.monotonic()
        with self._lock:
            attempts = self._cleanup(key, now)
            if len(attempts) >= settings.login_max_attempts:
                wait = int(settings.login_window_minutes * 60 - (now - attempts[0])) // 60 + 1
                raise HTTPException(
                    status.HTTP_429_TOO_MANY_REQUESTS,
                    f"Слишком много попыток входа. Попробуйте через {wait} мин.",
                )

    def fail(self, key: str) -> None:
        with self._lock:
            self._failures[key].append(time.monotonic())

    def reset(self, key: str) -> None:
        with self._lock:
            self._failures.pop(key, None)


login_limiter = LoginLimiter()
