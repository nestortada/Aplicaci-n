from __future__ import annotations

import os
from pathlib import Path


DEFAULT_ENV_FILE = ".env"


def get_database_path() -> Path:
    load_key_value_env_file()
    raw_path = os.getenv("DATABASE_PATH", "data/reportes.sqlite3")
    return Path(raw_path)


def load_key_value_env_file() -> None:
    text = _read_env_file()
    if not text:
        return

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if not key or key in os.environ:
            continue
        os.environ[key] = _unquote_env_value(value.strip())


def _read_env_file() -> str:
    env_path = Path(os.getenv("ENV_FILE", DEFAULT_ENV_FILE))
    if not env_path.exists():
        return ""
    return env_path.read_text(encoding="utf-8")


def _unquote_env_value(value: str) -> str:
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        return value[1:-1]
    return value
