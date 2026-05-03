from __future__ import annotations

import sqlite3
from collections.abc import Iterable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


ROW_COLUMNS = [
    "source_row",
    "ciclo_lectivo",
    "nombre_curso",
    "componente",
    "dia",
    "hora_inicio",
    "hora_final",
    "instalacion_id",
    "instalacion_descripcion",
    "id_profesor",
    "numero_documento_docente",
    "nombre_profesor",
    "departamento",
    "descripcion_materia",
    "id_seccion_combinada",
]


class DatasetRepository:
    def __init__(self, database_path: Path) -> None:
        self.database_path = database_path

    def init_db(self) -> None:
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS academic_rows (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    source_row INTEGER NOT NULL,
                    ciclo_lectivo TEXT NOT NULL,
                    nombre_curso TEXT NOT NULL,
                    componente TEXT NOT NULL,
                    dia TEXT NOT NULL,
                    hora_inicio TEXT NOT NULL,
                    hora_final TEXT NOT NULL,
                    instalacion_id TEXT NOT NULL DEFAULT '',
                    instalacion_descripcion TEXT NOT NULL,
                    id_profesor TEXT NOT NULL,
                    numero_documento_docente TEXT NOT NULL,
                    nombre_profesor TEXT NOT NULL,
                    departamento TEXT NOT NULL,
                    descripcion_materia TEXT NOT NULL DEFAULT '',
                    id_seccion_combinada TEXT NOT NULL
                )
                """
            )
            self._ensure_column(connection, "academic_rows", "instalacion_id", "TEXT NOT NULL DEFAULT ''")
            self._ensure_column(connection, "academic_rows", "descripcion_materia", "TEXT NOT NULL DEFAULT ''")
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS upload_metadata (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    filename TEXT NOT NULL,
                    uploaded_at TEXT NOT NULL,
                    row_count INTEGER NOT NULL
                )
                """
            )
            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_academic_rows_professor
                ON academic_rows (numero_documento_docente, id_profesor, ciclo_lectivo)
                """
            )
            connection.commit()

    def replace_rows(self, rows: Iterable[dict[str, Any]], filename: str) -> int:
        rows_list = list(rows)
        placeholders = ", ".join(["?"] * len(ROW_COLUMNS))
        columns = ", ".join(ROW_COLUMNS)
        values = [
            tuple(str(row.get(column, "")) if column != "source_row" else int(row.get(column, 0)) for column in ROW_COLUMNS)
            for row in rows_list
        ]

        with self._connect() as connection:
            connection.execute("DELETE FROM academic_rows")
            connection.execute("DELETE FROM upload_metadata")
            if values:
                connection.executemany(
                    f"INSERT INTO academic_rows ({columns}) VALUES ({placeholders})",
                    values,
                )
            connection.execute(
                """
                INSERT INTO upload_metadata (id, filename, uploaded_at, row_count)
                VALUES (1, ?, ?, ?)
                """,
                (filename, datetime.now(UTC).isoformat(), len(rows_list)),
            )
            connection.commit()
        return len(rows_list)

    def has_active_dataset(self) -> bool:
        with self._connect() as connection:
            row = connection.execute("SELECT COUNT(*) AS count FROM upload_metadata").fetchone()
            return bool(row and row["count"])

    def get_upload_metadata(self) -> dict[str, Any]:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT filename, uploaded_at, row_count
                FROM upload_metadata
                WHERE id = 1
                """
            ).fetchone()

        if not row:
            return {"activa": False, "archivo": "", "fechaCarga": "", "filasCargadas": 0}

        return {
            "activa": True,
            "archivo": row["filename"],
            "fechaCarga": row["uploaded_at"],
            "filasCargadas": row["row_count"],
        }

    def get_rows(self) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT
                    source_row,
                    ciclo_lectivo,
                    nombre_curso,
                    componente,
                    dia,
                    hora_inicio,
                    hora_final,
                    instalacion_id,
                    instalacion_descripcion,
                    id_profesor,
                    numero_documento_docente,
                    nombre_profesor,
                    departamento,
                    descripcion_materia,
                    id_seccion_combinada
                FROM academic_rows
                ORDER BY id ASC
                """
            ).fetchall()
        return [dict(row) for row in rows]

    def clear(self) -> None:
        with self._connect() as connection:
            connection.execute("DELETE FROM academic_rows")
            connection.execute("DELETE FROM upload_metadata")
            connection.commit()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.database_path)
        connection.row_factory = sqlite3.Row
        return connection

    def _ensure_column(self, connection: sqlite3.Connection, table: str, column: str, definition: str) -> None:
        columns = {row["name"] for row in connection.execute(f"PRAGMA table_info({table})").fetchall()}
        if column not in columns:
            connection.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")
