from __future__ import annotations

from collections import OrderedDict
from typing import Any

from app.exceptions import AppError
from app.models import ReportTableRow
from app.services.time_calculator import InvalidTimeError, calculate_duration_hours


def attach_session_hours(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    invalid_rows: list[dict[str, Any]] = []
    enriched_rows: list[dict[str, Any]] = []

    for row in rows:
        try:
            duration = calculate_duration_hours(row.get("hora_inicio"), row.get("hora_final"))
        except InvalidTimeError:
            invalid_rows.append(
                {
                    "fila": row.get("source_row"),
                    "horaInicio": row.get("hora_inicio", ""),
                    "horaFinal": row.get("hora_final", ""),
                }
            )
            continue

        enriched_row = dict(row)
        enriched_row["sesiones"] = duration
        enriched_rows.append(enriched_row)

    if invalid_rows:
        raise AppError(
            422,
            "horas_invalidas",
            "Se encontraron valores invalidos en Hora Inicio o Hora Final.",
            {"filasInvalidas": invalid_rows},
        )

    return enriched_rows


def group_report_rows(rows: list[dict[str, Any]], visualizar_componente: bool) -> list[ReportTableRow]:
    groups: OrderedDict[tuple[str, str, str, str, str], float] = OrderedDict()

    for row in rows:
        semestre = _clean(row.get("ciclo_lectivo"))
        materia = _build_course_name(row, visualizar_componente)
        fecha_inicio = _clean(row.get("fecha_inicio"))
        fecha_final = _clean(row.get("fecha_final"))
        departamento = _clean(row.get("descripcion_materia"))
        key = (semestre, materia, fecha_inicio, fecha_final, departamento)
        groups[key] = groups.get(key, 0.0) + float(row.get("sesiones", 0))

    return [
        ReportTableRow(
            semestre=semestre,
            materia=materia,
            fechaInicio=fecha_inicio,
            fechaFinal=fecha_final,
            sesiones=_compact_number(sessions),
            departamento=departamento,
        )
        for (semestre, materia, fecha_inicio, fecha_final, departamento), sessions in groups.items()
    ]


def _build_course_name(row: dict[str, Any], visualizar_componente: bool) -> str:
    course_name = _clean(row.get("nombre_curso"))
    if not visualizar_componente:
        return course_name

    component = _clean(row.get("componente"))
    return f"{course_name} - {component}" if component else course_name


def _clean(value: Any) -> str:
    return "" if value is None else str(value).strip()


def _compact_number(value: float) -> int | float:
    rounded = round(value, 10)
    if float(rounded).is_integer():
        return int(rounded)
    return rounded
