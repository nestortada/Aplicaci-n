from __future__ import annotations

from datetime import datetime, time
from typing import Any


REQUIRED_COLUMNS: dict[str, str] = {
    "ciclo_lectivo": "Ciclo Lectivo",
    "nombre_curso": "Nombre del curso",
    "componente": "Componente",
    "dia": "Día",
    "hora_inicio": "Hora Inicio",
    "hora_final": "Hora Final",
    "instalacion_id": "ID Instalación",
    "instalacion_descripcion": "ID Instalación descripción",
    "id_profesor": "Id profesor",
    "numero_documento_docente": "Numero documento docente",
    "nombre_profesor": "Nombre profesor",
    "departamento": "Departamento",
    "descripcion_materia": "Descripción Materia",
    "id_seccion_combinada": "ID Sección Combinada",
}

HOUR_FIELDS = {"hora_inicio", "hora_final"}


def normalize_header_name(value: Any) -> str:
    text = "" if value is None else str(value)
    return " ".join(text.replace("\ufeff", "").strip().split()).casefold()


def clean_cell(value: Any, field_name: str) -> str:
    if value is None:
        return ""
    if isinstance(value, datetime):
        if field_name in HOUR_FIELDS:
            return value.time().isoformat(timespec="seconds")
        return value.isoformat(sep=" ")
    if isinstance(value, time):
        return value.isoformat(timespec="seconds")
    if isinstance(value, int):
        return str(value).strip()
    if isinstance(value, float):
        if field_name in HOUR_FIELDS and 0 <= value < 1:
            total_seconds = round(value * 24 * 60 * 60)
            hours = (total_seconds // 3600) % 24
            minutes = (total_seconds % 3600) // 60
            seconds = total_seconds % 60
            return f"{hours:02d}:{minutes:02d}:{seconds:02d}"
        if value.is_integer():
            return str(int(value))
    return str(value).strip()


def build_column_index(headers: list[Any]) -> tuple[dict[str, int], list[str], list[str]]:
    normalized_to_index: dict[str, int] = {}
    detected_columns: list[str] = []

    for index, header in enumerate(headers):
        text = "" if header is None else str(header).strip()
        if text:
            detected_columns.append(text)
            normalized_to_index.setdefault(normalize_header_name(text), index)

    missing = [
        external_name
        for external_name in REQUIRED_COLUMNS.values()
        if normalize_header_name(external_name) not in normalized_to_index
    ]

    required_index = {
        internal_name: normalized_to_index[normalize_header_name(external_name)]
        for internal_name, external_name in REQUIRED_COLUMNS.items()
        if normalize_header_name(external_name) in normalized_to_index
    }
    return required_index, detected_columns, missing


def normalize_row(values: list[Any] | tuple[Any, ...], column_index: dict[str, int], source_row: int) -> dict[str, str | int]:
    row: dict[str, str | int] = {"source_row": source_row}
    for internal_name, index in column_index.items():
        value = values[index] if index < len(values) else None
        row[internal_name] = clean_cell(value, internal_name)
    return row


def is_empty_data_row(row: dict[str, str | int]) -> bool:
    return all(not str(row.get(field, "")).strip() for field in REQUIRED_COLUMNS)
