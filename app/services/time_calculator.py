from __future__ import annotations

import re
from datetime import datetime, time
from typing import Any


class InvalidTimeError(ValueError):
    def __init__(self, value: Any) -> None:
        super().__init__(f"Hora invalida: {value}")
        self.value = value


AM_PM_PATTERN = re.compile(
    r"^\s*(?P<hour>\d{1,2})(?::(?P<minute>\d{2}))?(?::(?P<second>\d{2}))?\s*:?\s*(?P<period>a\.?m\.?|p\.?m\.?)\s*$",
    re.IGNORECASE,
)
TIME_24H_PATTERN = re.compile(r"^\s*(?P<hour>\d{1,2}):(?P<minute>\d{2})(?::(?P<second>\d{2}))?\s*$")


def calculate_duration_hours(start_value: Any, end_value: Any) -> float:
    start_seconds = parse_time_to_seconds(start_value)
    end_seconds = parse_time_to_seconds(end_value)

    duration = end_seconds - start_seconds
    if duration < 0:
        duration += 24 * 60 * 60
    return duration / 3600


def parse_time_to_seconds(value: Any) -> int:
    if isinstance(value, datetime):
        return _time_to_seconds(value.time())
    if isinstance(value, time):
        return _time_to_seconds(value)
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return _parse_numeric_time(value)

    text = "" if value is None else str(value).strip()
    if not text:
        raise InvalidTimeError(value)

    numeric_value = _maybe_float(text)
    if numeric_value is not None and 0 <= numeric_value < 1:
        return _parse_numeric_time(numeric_value)

    am_pm_match = AM_PM_PATTERN.fullmatch(text)
    if am_pm_match:
        return _parse_am_pm_match(am_pm_match, value)

    time_24h_match = TIME_24H_PATTERN.fullmatch(text)
    if time_24h_match:
        return _parse_24h_match(time_24h_match, value)

    raise InvalidTimeError(value)


def _time_to_seconds(value: time) -> int:
    return value.hour * 3600 + value.minute * 60 + value.second


def _parse_numeric_time(value: int | float) -> int:
    if not 0 <= float(value) < 1:
        raise InvalidTimeError(value)
    return round(float(value) * 24 * 60 * 60)


def _parse_am_pm_match(match: re.Match[str], original_value: Any) -> int:
    hour = int(match.group("hour"))
    minute = int(match.group("minute") or 0)
    second = int(match.group("second") or 0)
    period = match.group("period").replace(".", "").casefold()

    if hour < 1 or hour > 12 or minute > 59 or second > 59:
        raise InvalidTimeError(original_value)

    if period == "am":
        hour = 0 if hour == 12 else hour
    else:
        hour = 12 if hour == 12 else hour + 12

    return hour * 3600 + minute * 60 + second


def _parse_24h_match(match: re.Match[str], original_value: Any) -> int:
    hour = int(match.group("hour"))
    minute = int(match.group("minute"))
    second = int(match.group("second") or 0)

    if hour > 23 or minute > 59 or second > 59:
        raise InvalidTimeError(original_value)

    return hour * 3600 + minute * 60 + second


def _maybe_float(value: str) -> float | None:
    try:
        return float(value)
    except ValueError:
        return None

