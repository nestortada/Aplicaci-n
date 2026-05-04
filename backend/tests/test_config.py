from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app.config import DEFAULT_DEV_DATABASE_PATH, DEFAULT_VERCEL_DATABASE_PATH, get_database_path, get_runtime_environment


class ConfigTest(unittest.TestCase):
    def test_vercel_uses_temporary_sqlite_path_by_default(self) -> None:
        env = {key: value for key, value in os.environ.items() if key not in {"DATABASE_PATH", "ENV_FILE"}}
        env["VERCEL"] = "1"

        with patch.dict(os.environ, env, clear=True):
            self.assertEqual(get_database_path(), DEFAULT_VERCEL_DATABASE_PATH)

    def test_vercel_does_not_read_local_env_database_path(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            env_path = Path(temp_dir) / ".env"
            env_path.write_text("DATABASE_PATH=data/reportes.sqlite3\n", encoding="utf-8")
            env = {key: value for key, value in os.environ.items() if key not in {"DATABASE_PATH"}}
            env["VERCEL"] = "1"
            env["ENV_FILE"] = str(env_path)

            with patch.dict(os.environ, env, clear=True):
                self.assertEqual(get_database_path(), DEFAULT_VERCEL_DATABASE_PATH)

    def test_database_path_env_overrides_vercel_default(self) -> None:
        env = {
            key: value
            for key, value in os.environ.items()
            if key not in {"ENV_FILE"}
        }
        env["VERCEL"] = "1"
        env["DATABASE_PATH"] = "/tmp/custom.sqlite3"

        with patch.dict(os.environ, env, clear=True):
            self.assertEqual(get_database_path(), Path("/tmp/custom.sqlite3"))

    def test_local_development_keeps_persistent_dev_sqlite_path(self) -> None:
        env = {
            key: value
            for key, value in os.environ.items()
            if key not in {"DATABASE_PATH", "ENV_FILE", "RENDER", "VERCEL"}
        }

        with patch.dict(os.environ, env, clear=True):
            self.assertEqual(get_database_path(), DEFAULT_DEV_DATABASE_PATH)

    def test_runtime_environment_marks_render_as_cloud(self) -> None:
        env = {key: value for key, value in os.environ.items() if key not in {"SABANA_RUNTIME", "VERCEL"}}
        env["RENDER"] = "true"

        with patch.dict(os.environ, env, clear=True):
            self.assertEqual(get_runtime_environment(), "cloud")

    def test_runtime_environment_accepts_desktop_override(self) -> None:
        env = {key: value for key, value in os.environ.items() if key not in {"RENDER", "VERCEL"}}
        env["SABANA_RUNTIME"] = "desktop"

        with patch.dict(os.environ, env, clear=True):
            self.assertEqual(get_runtime_environment(), "desktop")
