from __future__ import annotations

from typing import Any

from app.services.filters import (
    apply_optional_filters,
    filter_by_cycle_selection,
    filter_by_professor,
    is_all_filter,
    parse_cycle_key,
)


ROMAN_TERMS = {
    1: "I",
    2: "II",
    3: "III",
    4: "IV",
}


def build_cycle_options(rows: list[dict[str, Any]]) -> list[dict[str, str]]:
    cycles = [value for value in _unique_values(rows, "ciclo_lectivo") if parse_cycle_key(value) is not None]
    cycles.sort(key=lambda value: parse_cycle_key(value) or (9999, 9999))
    return [{"valor": cycle, "etiqueta": format_cycle_label(cycle)} for cycle in cycles]


def build_course_options(
    rows: list[dict[str, Any]],
    numero_documento_docente: str,
    id_profesor: str,
    ciclo_lectivo_inicio: str,
    ciclo_lectivo_final: str,
) -> list[dict[str, str]]:
    filtered_rows = _filter_available_rows(
        rows,
        numero_documento_docente,
        id_profesor,
        ciclo_lectivo_inicio,
        ciclo_lectivo_final,
    )
    return _field_options(filtered_rows, "nombre_curso")


def build_component_options(
    rows: list[dict[str, Any]],
    numero_documento_docente: str,
    id_profesor: str,
    ciclo_lectivo_inicio: str,
    ciclo_lectivo_final: str,
    nombre_curso: str,
) -> list[dict[str, str]]:
    filtered_rows = _filter_available_rows(
        rows,
        numero_documento_docente,
        id_profesor,
        ciclo_lectivo_inicio,
        ciclo_lectivo_final,
    )
    if not is_all_filter(nombre_curso):
        filtered_rows = apply_optional_filters(filtered_rows, nombre_curso, "TODOS")
    return _field_options(filtered_rows, "componente")


def format_cycle_label(value: str) -> str:
    cycle_key = parse_cycle_key(value)
    if not cycle_key:
        return value
    year, term = cycle_key
    return f"{year}-{ROMAN_TERMS.get(term, str(term))}"


def _filter_available_rows(
    rows: list[dict[str, Any]],
    numero_documento_docente: str,
    id_profesor: str,
    ciclo_lectivo_inicio: str,
    ciclo_lectivo_final: str,
) -> list[dict[str, Any]]:
    professor_rows = filter_by_professor(rows, numero_documento_docente, id_profesor)
    return filter_by_cycle_selection(professor_rows, "", ciclo_lectivo_inicio, ciclo_lectivo_final)


def _field_options(rows: list[dict[str, Any]], field: str) -> list[dict[str, str]]:
    values = sorted(_unique_values(rows, field), key=str.casefold)
    return [{"valor": value, "etiqueta": value} for value in values]


def _unique_values(rows: list[dict[str, Any]], field: str) -> list[str]:
    seen: set[str] = set()
    values: list[str] = []
    for row in rows:
        value = str(row.get(field, "")).strip()
        key = value.casefold()
        if not value or key in seen:
            continue
        seen.add(key)
        values.append(value)
    return values
