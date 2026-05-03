from __future__ import annotations

from app.models import ReportTableRow


def build_markdown_table(rows: list[ReportTableRow]) -> str:
    lines = [
        "| Semestre | Materia | Sesiones | Departamento |",
        "| --- | --- | ---: | --- |",
    ]
    for row in rows:
        lines.append(
            f"| {_escape(row.semestre)} | {_escape(row.materia)} | {_format_number(row.sesiones)} | {_escape(row.departamento)} |"
        )
    return "\n".join(lines)


def build_message(professor_name: str, rows: list[ReportTableRow]) -> str:
    table = build_markdown_table(rows)
    return (
        "Buen Día\n\n"
        "Cordial Saludo\n\n"
        f"Apreciad@s, envío la información encontrada del profesor {professor_name}\n\n"
        f"{table}"
    )


def _escape(value: str) -> str:
    return str(value).replace("|", "\\|")


def _format_number(value: int | float) -> str:
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)
