from __future__ import annotations

import os
import sys
from pathlib import Path


DEFAULT_ENV_FILE = ".env"
DEFAULT_DEV_DATABASE_PATH = Path("data/reportes.sqlite3")
DEFAULT_VERCEL_DATABASE_PATH = Path("/tmp/reportes.sqlite3")
DEFAULT_ALLOWED_ORIGINS = ",".join(
    [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://frontend-certisabana.vercel.app",
    ]
)
DEFAULT_APP_NAME = "SabanaCertificado"


def is_frozen_app() -> bool:
    return bool(getattr(sys, "frozen", False))


def is_vercel_environment() -> bool:
    return os.getenv("VERCEL") == "1"


def get_database_path() -> Path:
    if is_vercel_environment():
        raw_path = os.getenv("DATABASE_PATH")
        return Path(raw_path) if raw_path else DEFAULT_VERCEL_DATABASE_PATH

    load_key_value_env_file()
    raw_path = os.getenv("DATABASE_PATH")
    if raw_path:
        return Path(raw_path)
    if is_frozen_app():
        return _default_windows_data_dir() / "reportes.sqlite3"
    return DEFAULT_DEV_DATABASE_PATH


def get_frontend_dist_path() -> Path:
    load_key_value_env_file()
    raw_path = os.getenv("FRONTEND_DIST_PATH")
    if raw_path:
        return Path(raw_path)
    return _resource_path("frontend", "dist")


def get_server_host() -> str:
    load_key_value_env_file()
    return os.getenv("HOST", "127.0.0.1")


def get_server_port() -> int:
    load_key_value_env_file()
    raw_port = os.getenv("PORT", "8765" if is_frozen_app() else "8000")
    try:
        return int(raw_port)
    except ValueError:
        return 8765 if is_frozen_app() else 8000


def _default_windows_data_dir() -> Path:
    base_dir = os.getenv("LOCALAPPDATA") or os.getenv("APPDATA")
    if base_dir:
        return Path(base_dir) / DEFAULT_APP_NAME / "data"
    return Path.home() / f".{DEFAULT_APP_NAME}" / "data"


def _resource_path(*parts: str) -> Path:
    if hasattr(sys, "_MEIPASS"):
        return Path(sys._MEIPASS).joinpath(*parts)
    return Path(__file__).resolve().parents[2].joinpath(*parts)


def get_allowed_origins() -> list[str]:
    load_key_value_env_file()
    raw_origins = os.getenv("ALLOWED_ORIGINS", DEFAULT_ALLOWED_ORIGINS)
    return [origin.strip() for origin in raw_origins.split(",") if origin.strip()]


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
