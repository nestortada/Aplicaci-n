from __future__ import annotations

from typing import Any


def deduplicate_combined_sections(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen_keys: set[tuple[str, str, str, str, str, str]] = set()
    result: list[dict[str, Any]] = []

    for row in rows:
        combined_section = _clean(row.get("id_seccion_combinada"))
        if not combined_section:
            result.append(row)
            continue

        key = (
            combined_section,
            _clean(row.get("dia")),
            _clean(row.get("hora_inicio")),
            _clean(row.get("hora_final")),
            _clean(row.get("instalacion_id")),
            _clean(row.get("ciclo_lectivo")),
        )
        if key in seen_keys:
            continue

        seen_keys.add(key)
        result.append(row)

    return result


def _clean(value: Any) -> str:
    return "" if value is None else str(value).strip()
