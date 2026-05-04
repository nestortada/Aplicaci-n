from __future__ import annotations

import re
import unicodedata
from collections.abc import Sequence
from typing import Any


PERIOD_PATTERN = re.compile(r"(?P<year>\d{4})\s*[-_]\s*(?P<term>\d+)")


FilterSelection = str | Sequence[str] | None


def clean_filter(value: str | None) -> str:
    return "" if value is None else str(value).strip()


def clean_filter_values(value: FilterSelection) -> list[str]:
    if value is None:
        return []
    raw_values = value if isinstance(value, Sequence) and not isinstance(value, str) else [value]
    return [cleaned for item in raw_values if (cleaned := clean_filter(str(item)))]


def format_filter_values(value: FilterSelection) -> str:
    values = clean_filter_values(value)
    return ", ".join(values) if values else "TODOS"


def same_text(left: str | None, right: str | None) -> bool:
    return clean_filter(left).casefold() == clean_filter(right).casefold()


def is_all_filter(value: FilterSelection) -> bool:
    values = clean_filter_values(value)
    return not values or any(item.casefold() == "todos" for item in values)


def normalize_search_text(value: str | None) -> str:
    cleaned = clean_filter(value)
    without_accents = "".join(
        character for character in unicodedata.normalize("NFKD", cleaned) if not unicodedata.combining(character)
    )
    return " ".join(without_accents.casefold().split())


def name_matches(candidate: str | None, query: str | None) -> bool:
    normalized_candidate = normalize_search_text(candidate)
    normalized_query = normalize_search_text(query)
    if not normalized_query:
        return True
    if not normalized_candidate:
        return False
    if normalized_query in normalized_candidate:
        return True

    candidate_tokens = normalized_candidate.split()
    query_tokens = normalized_query.split()
    return all(
        any(candidate_token.startswith(query_token) or query_token in candidate_token for candidate_token in candidate_tokens)
        for query_token in query_tokens
    )


def filter_by_professor(
    rows: list[dict[str, Any]],
    numero_documento_docente: str,
    id_profesor: str,
    nombre_profesor: str = "",
) -> list[dict[str, Any]]:
    document = clean_filter(numero_documento_docente)
    professor_id = clean_filter(id_profesor)
    professor_name = clean_filter(nombre_profesor)

    filtered = rows
    if document:
        filtered = [row for row in filtered if same_text(row.get("numero_documento_docente"), document)]
    if professor_id:
        filtered = [row for row in filtered if same_text(row.get("id_profesor"), professor_id)]
    if professor_name:
        filtered = [row for row in filtered if name_matches(row.get("nombre_profesor"), professor_name)]
    return filtered


def filter_by_ciclo_lectivo(rows: list[dict[str, Any]], ciclo_lectivo: str) -> list[dict[str, Any]]:
    return [row for row in rows if same_text(row.get("ciclo_lectivo"), ciclo_lectivo)]


def filter_by_cycle_selection(
    rows: list[dict[str, Any]],
    ciclo_lectivo: str,
    ciclo_lectivo_inicio: str,
    ciclo_lectivo_final: str,
) -> list[dict[str, Any]]:
    exact_cycle = clean_filter(ciclo_lectivo)
    start_cycle = clean_filter(ciclo_lectivo_inicio)
    end_cycle = clean_filter(ciclo_lectivo_final)

    if start_cycle or end_cycle:
        start_key = parse_cycle_key(start_cycle) if start_cycle else None
        end_key = parse_cycle_key(end_cycle) if end_cycle else None
        if start_key and end_key and start_key > end_key:
            start_key, end_key = end_key, start_key

        filtered_rows: list[dict[str, Any]] = []
        for row in rows:
            row_key = parse_cycle_key(row.get("ciclo_lectivo"))
            if row_key is None:
                continue
            if start_key and row_key < start_key:
                continue
            if end_key and row_key > end_key:
                continue
            filtered_rows.append(row)
        return filtered_rows

    if exact_cycle:
        return filter_by_ciclo_lectivo(rows, exact_cycle)

    return rows


def parse_cycle_key(value: str | None) -> tuple[int, int] | None:
    match = PERIOD_PATTERN.search(clean_filter(value))
    if not match:
        return None
    return int(match.group("year")), int(match.group("term"))


def apply_optional_filters(
    rows: list[dict[str, Any]],
    nombre_curso: FilterSelection,
    componente: FilterSelection,
    departamento: FilterSelection = None,
) -> list[dict[str, Any]]:
    filtered = rows
    if not is_all_filter(nombre_curso):
        course_values = {value.casefold() for value in clean_filter_values(nombre_curso)}
        filtered = [row for row in filtered if clean_filter(row.get("nombre_curso")).casefold() in course_values]
    if not is_all_filter(componente):
        component_values = {value.casefold() for value in clean_filter_values(componente)}
        filtered = [row for row in filtered if clean_filter(row.get("componente")).casefold() in component_values]
    if not is_all_filter(departamento):
        department_values = {value.casefold() for value in clean_filter_values(departamento)}
        filtered = [row for row in filtered if clean_filter(row.get("descripcion_materia")).casefold() in department_values]
    return filtered


def first_valid_professor_name(rows: list[dict[str, Any]]) -> str:
    for row in rows:
        name = clean_filter(row.get("nombre_profesor"))
        if name:
            return name
    return "PROFESOR SIN NOMBRE"
