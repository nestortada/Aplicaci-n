from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from app.exceptions import AppError
from app.models import ReportRequest
from app.repository import DatasetRepository
from app.services.deduplication import deduplicate_combined_sections
from app.services.filters import (
    apply_optional_filters,
    filter_by_ciclo_lectivo,
    filter_by_cycle_selection,
    filter_by_professor,
)
from app.services.message_builder import build_message
from app.services.report_service import ReportService


def make_row(**overrides: str | int) -> dict[str, str | int]:
    row: dict[str, str | int] = {
        "source_row": 2,
        "ciclo_lectivo": "PERIODO 2016-2",
        "nombre_curso": "SEMINARIO DE PRACTICA",
        "componente": "LEC",
        "dia": "Martes",
        "hora_inicio": "05:00:PM",
        "hora_final": "06:00:PM",
        "instalacion_id": "B104-CAMP",
        "instalacion_descripcion": "AULA B104",
        "id_profesor": "0000005357",
        "numero_documento_docente": "52867332",
        "nombre_profesor": "MARTINEZ HERNANDEZ LINA MARIA",
        "departamento": "1221",
        "descripcion_materia": "PROCESOS INDUSTRIALES",
        "id_seccion_combinada": "",
    }
    row.update(overrides)
    return row


class FilterServicesTest(unittest.TestCase):
    def setUp(self) -> None:
        self.rows = [
            make_row(),
            make_row(
                source_row=3,
                ciclo_lectivo="PERIODO 2017-1",
                id_profesor="0000009999",
                numero_documento_docente="999",
                nombre_curso="OTRO CURSO",
                componente="LAB",
            ),
        ]

    def test_filters_by_document(self) -> None:
        filtered = filter_by_professor(self.rows, "52867332", "")
        self.assertEqual(len(filtered), 1)
        self.assertEqual(filtered[0]["nombre_curso"], "SEMINARIO DE PRACTICA")

    def test_filters_by_professor_id(self) -> None:
        filtered = filter_by_professor(self.rows, "", "0000005357")
        self.assertEqual(len(filtered), 1)
        self.assertEqual(filtered[0]["numero_documento_docente"], "52867332")

    def test_filters_by_document_and_professor_id(self) -> None:
        filtered = filter_by_professor(self.rows, "52867332", "0000005357")
        self.assertEqual(len(filtered), 1)

    def test_filters_by_cycle_case_insensitive(self) -> None:
        filtered = filter_by_ciclo_lectivo(self.rows, "periodo 2016-2")
        self.assertEqual(len(filtered), 1)

    def test_filters_by_cycle_range(self) -> None:
        rows = [
            make_row(ciclo_lectivo="PERIODO 2016-2"),
            make_row(source_row=3, ciclo_lectivo="PERIODO 2017-1"),
            make_row(source_row=4, ciclo_lectivo="PERIODO 2018-1"),
        ]

        filtered = filter_by_cycle_selection(rows, "", "PERIODO 2017-1", "PERIODO 2018-1")

        self.assertEqual([row["ciclo_lectivo"] for row in filtered], ["PERIODO 2017-1", "PERIODO 2018-1"])

    def test_optional_course_filter(self) -> None:
        filtered = apply_optional_filters(self.rows, "seminario de practica", "TODOS")
        self.assertEqual(len(filtered), 1)

    def test_optional_component_filter(self) -> None:
        filtered = apply_optional_filters(self.rows, "TODOS", "lab")
        self.assertEqual(len(filtered), 1)
        self.assertEqual(filtered[0]["componente"], "LAB")

    def test_optional_filters_accept_multiple_values(self) -> None:
        filtered = apply_optional_filters(self.rows, ["SEMINARIO DE PRACTICA", "OTRO CURSO"], ["LEC", "LAB"])

        self.assertEqual(len(filtered), 2)


class DeduplicationTest(unittest.TestCase):
    def test_deduplicates_combined_sections_and_keeps_first_row(self) -> None:
        rows = [
            make_row(id_seccion_combinada="0545", nombre_curso="PRIMER CURSO"),
            make_row(source_row=3, id_seccion_combinada="0545", nombre_curso="SEGUNDO CURSO"),
            make_row(source_row=4, id_seccion_combinada="", nombre_curso="SIN COMBINADA"),
        ]

        deduplicated = deduplicate_combined_sections(rows)

        self.assertEqual(len(deduplicated), 2)
        self.assertEqual(deduplicated[0]["nombre_curso"], "PRIMER CURSO")
        self.assertEqual(deduplicated[1]["nombre_curso"], "SIN COMBINADA")

    def test_deduplicates_combined_sections_by_installation_id_not_description(self) -> None:
        rows = [
            make_row(
                id_seccion_combinada="0777",
                hora_inicio="08:00:AM",
                hora_final="11:00:AM",
                instalacion_id="A101-CAMP",
                instalacion_descripcion="AULA A101",
                dia="Lunes",
            ),
            make_row(
                source_row=3,
                id_seccion_combinada="0777",
                hora_inicio="08:00:AM",
                hora_final="11:00:AM",
                instalacion_id="A101-CAMP",
                instalacion_descripcion="AULA A101 RENOMBRADA",
                dia="Lunes",
            ),
            make_row(
                source_row=4,
                id_seccion_combinada="0777",
                hora_inicio="11:00:AM",
                hora_final="02:00:PM",
                instalacion_id="A101-CAMP",
                instalacion_descripcion="AULA A101",
                dia="Lunes",
            ),
        ]

        deduplicated = deduplicate_combined_sections(rows)

        self.assertEqual(len(deduplicated), 2)

    def test_keeps_same_combined_section_when_day_is_different(self) -> None:
        rows = [
            make_row(
                id_seccion_combinada="0197",
                dia="Martes",
                hora_inicio="09:00:AM",
                hora_final="10:00:AM",
                instalacion_id="B202-CAMP",
            ),
            make_row(
                source_row=3,
                id_seccion_combinada="0197",
                dia="Viernes",
                hora_inicio="09:00:AM",
                hora_final="10:00:AM",
                instalacion_id="B202-CAMP",
            ),
        ]

        deduplicated = deduplicate_combined_sections(rows)

        self.assertEqual(len(deduplicated), 2)


class ReportServiceTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.repository = DatasetRepository(Path(self.temp_dir.name) / "test.sqlite3")
        self.repository.init_db()

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def load_rows(self, rows: list[dict[str, str | int]]) -> None:
        self.repository.replace_rows(rows, "test.xlsx")

    def test_visualizar_componente_false_groups_by_course(self) -> None:
        self.load_rows(
            [
                make_row(componente="LEC"),
                make_row(source_row=3, componente="LAB"),
            ]
        )

        response = ReportService(self.repository).build_professor_sessions_report(
            ReportRequest(
                numeroDocumentoDocente="52867332",
                idProfesor="",
                cicloLectivo="PERIODO 2016-2",
                visualizarComponente=False,
            )
        )

        self.assertEqual(len(response.tabla), 1)
        self.assertEqual(response.tabla[0].materia, "SEMINARIO DE PRACTICA")
        self.assertEqual(response.tabla[0].sesiones, 2)
        self.assertEqual(response.tabla[0].departamento, "PROCESOS INDUSTRIALES")

    def test_visualizar_componente_true_groups_by_course_and_component(self) -> None:
        self.load_rows(
            [
                make_row(componente="LEC"),
                make_row(source_row=3, componente="LAB"),
            ]
        )

        response = ReportService(self.repository).build_professor_sessions_report(
            ReportRequest(
                numeroDocumentoDocente="52867332",
                idProfesor="",
                cicloLectivo="PERIODO 2016-2",
                visualizarComponente=True,
            )
        )

        names = [row.materia for row in response.tabla]
        self.assertEqual(names, ["SEMINARIO DE PRACTICA - LEC", "SEMINARIO DE PRACTICA - LAB"])
        self.assertEqual([row.sesiones for row in response.tabla], [1, 1])

    def test_report_applies_optional_component_filter(self) -> None:
        self.load_rows(
            [
                make_row(componente="LEC"),
                make_row(source_row=3, componente="LAB"),
            ]
        )

        response = ReportService(self.repository).build_professor_sessions_report(
            ReportRequest(
                numeroDocumentoDocente="52867332",
                idProfesor="",
                cicloLectivo="PERIODO 2016-2",
                componente="LAB",
                visualizarComponente=True,
            )
        )

        self.assertEqual(len(response.tabla), 1)
        self.assertEqual(response.tabla[0].materia, "SEMINARIO DE PRACTICA - LAB")

    def test_report_applies_multiple_course_and_component_filters(self) -> None:
        self.load_rows(
            [
                make_row(nombre_curso="CURSO A", componente="LEC"),
                make_row(source_row=3, nombre_curso="CURSO B", componente="LAB"),
                make_row(source_row=4, nombre_curso="CURSO C", componente="TEO"),
            ]
        )

        response = ReportService(self.repository).build_professor_sessions_report(
            ReportRequest(
                numeroDocumentoDocente="52867332",
                idProfesor="",
                cicloLectivo="PERIODO 2016-2",
                nombreCurso=["CURSO A", "CURSO B"],
                componente=["LEC", "LAB"],
                visualizarComponente=True,
            )
        )

        self.assertEqual([row.materia for row in response.tabla], ["CURSO A - LEC", "CURSO B - LAB"])

    def test_report_without_cycle_filter_returns_all_professor_cycles(self) -> None:
        self.load_rows(
            [
                make_row(ciclo_lectivo="PERIODO 2016-2"),
                make_row(source_row=3, ciclo_lectivo="PERIODO 2017-1"),
            ]
        )

        response = ReportService(self.repository).build_professor_sessions_report(
            ReportRequest(numeroDocumentoDocente="52867332", idProfesor="")
        )

        self.assertEqual([row.semestre for row in response.tabla], ["PERIODO 2016-2", "PERIODO 2017-1"])
        self.assertEqual([row.sesiones for row in response.tabla], [1, 1])

    def test_report_filters_by_cycle_start_and_end(self) -> None:
        self.load_rows(
            [
                make_row(ciclo_lectivo="PERIODO 2016-2"),
                make_row(source_row=3, ciclo_lectivo="PERIODO 2017-1"),
                make_row(source_row=4, ciclo_lectivo="PERIODO 2017-2"),
                make_row(source_row=5, ciclo_lectivo="PERIODO 2018-1"),
            ]
        )

        response = ReportService(self.repository).build_professor_sessions_report(
            ReportRequest(
                numeroDocumentoDocente="52867332",
                idProfesor="",
                cicloLectivoInicio="PERIODO 2017-1",
                cicloLectivoFinal="PERIODO 2017-2",
            )
        )

        self.assertEqual([row.semestre for row in response.tabla], ["PERIODO 2017-1", "PERIODO 2017-2"])

    def test_report_accepts_inverted_cycle_range(self) -> None:
        self.load_rows(
            [
                make_row(ciclo_lectivo="PERIODO 2016-2"),
                make_row(source_row=3, ciclo_lectivo="PERIODO 2017-1"),
            ]
        )

        response = ReportService(self.repository).build_professor_sessions_report(
            ReportRequest(
                numeroDocumentoDocente="52867332",
                idProfesor="",
                cicloLectivoInicio="PERIODO 2017-1",
                cicloLectivoFinal="PERIODO 2016-2",
            )
        )

        self.assertEqual([row.semestre for row in response.tabla], ["PERIODO 2016-2", "PERIODO 2017-1"])

    def test_report_rejects_invalid_cycle_range_value(self) -> None:
        self.load_rows([make_row()])

        with self.assertRaises(AppError) as context:
            ReportService(self.repository).build_professor_sessions_report(
                ReportRequest(
                    numeroDocumentoDocente="52867332",
                    idProfesor="",
                    cicloLectivoInicio="ciclo raro",
                )
            )

        self.assertEqual(context.exception.status_code, 422)
        self.assertEqual(context.exception.code, "ciclo_inicio_invalido")

    def test_report_deduplicates_combined_sections_before_calculating_hours(self) -> None:
        self.load_rows(
            [
                make_row(id_seccion_combinada="0545"),
                make_row(source_row=3, id_seccion_combinada="0545", nombre_curso="OTRO NOMBRE"),
            ]
        )

        response = ReportService(self.repository).build_professor_sessions_report(
            ReportRequest(
                numeroDocumentoDocente="52867332",
                idProfesor="",
                cicloLectivo="PERIODO 2016-2",
            )
        )

        self.assertEqual(response.tabla[0].sesiones, 1)
        self.assertEqual(response.tabla[0].materia, "SEMINARIO DE PRACTICA")

    def test_report_keeps_different_combined_section_ids_for_expected_six_hours(self) -> None:
        self.load_rows(
            [
                make_row(
                    source_row=2,
                    id_profesor="0000017786",
                    numero_documento_docente="80876044",
                    nombre_profesor="PROFESOR PRUEBA",
                    ciclo_lectivo="PERIODO 2017-1",
                    nombre_curso="GESTION DE OPERACIONES I",
                    id_seccion_combinada="1234",
                    hora_inicio="08:00:AM",
                    hora_final="09:00:AM",
                    instalacion_id="B202-CAMP",
                    dia="Lunes",
                ),
                make_row(
                    source_row=3,
                    id_profesor="0000017786",
                    numero_documento_docente="80876044",
                    nombre_profesor="PROFESOR PRUEBA",
                    ciclo_lectivo="PERIODO 2017-1",
                    nombre_curso="GESTION DE OPERACIONES I",
                    id_seccion_combinada="1234",
                    hora_inicio="09:00:AM",
                    hora_final="10:00:AM",
                    instalacion_id="C202-CAMP",
                    dia="Martes",
                ),
                make_row(
                    source_row=4,
                    id_profesor="0000017786",
                    numero_documento_docente="80876044",
                    nombre_profesor="PROFESOR PRUEBA",
                    ciclo_lectivo="PERIODO 2017-1",
                    nombre_curso="GESTION DE OPERACIONES I",
                    id_seccion_combinada="1234",
                    hora_inicio="10:00:AM",
                    hora_final="11:00:AM",
                    instalacion_id="D202-CAMP",
                    dia="Miercoles",
                ),
                make_row(
                    source_row=5,
                    id_profesor="0000017786",
                    numero_documento_docente="80876044",
                    nombre_profesor="PROFESOR PRUEBA",
                    ciclo_lectivo="PERIODO 2017-1",
                    nombre_curso="GESTION DE OPERACIONES I",
                    id_seccion_combinada="5678",
                    hora_inicio="08:00:AM",
                    hora_final="09:00:AM",
                    instalacion_id="B202-CAMP",
                    dia="Jueves",
                ),
                make_row(
                    source_row=6,
                    id_profesor="0000017786",
                    numero_documento_docente="80876044",
                    nombre_profesor="PROFESOR PRUEBA",
                    ciclo_lectivo="PERIODO 2017-1",
                    nombre_curso="GESTION DE OPERACIONES I",
                    id_seccion_combinada="5678",
                    hora_inicio="09:00:AM",
                    hora_final="10:00:AM",
                    instalacion_id="C202-CAMP",
                    dia="Viernes",
                ),
                make_row(
                    source_row=7,
                    id_profesor="0000017786",
                    numero_documento_docente="80876044",
                    nombre_profesor="PROFESOR PRUEBA",
                    ciclo_lectivo="PERIODO 2017-1",
                    nombre_curso="GESTION DE OPERACIONES I",
                    id_seccion_combinada="5678",
                    hora_inicio="10:00:AM",
                    hora_final="11:00:AM",
                    instalacion_id="D202-CAMP",
                    dia="Sabado",
                ),
            ]
        )

        response = ReportService(self.repository).build_professor_sessions_report(
            ReportRequest(
                idProfesor="0000017786",
                cicloLectivo="PERIODO 2017-1",
                nombreCurso="GESTION DE OPERACIONES I",
            )
        )

        self.assertEqual(response.tabla[0].sesiones, 6)

    def test_report_keeps_same_time_and_installation_when_day_is_different(self) -> None:
        self.load_rows(
            [
                make_row(
                    id_profesor="0000017786",
                    numero_documento_docente="80876044",
                    nombre_profesor="PROFESOR PRUEBA",
                    ciclo_lectivo="PERIODO 2017-1",
                    nombre_curso="GESTION DE OPERACIONES II",
                    id_seccion_combinada="0197",
                    dia="Martes",
                    hora_inicio="09:00:AM",
                    hora_final="10:00:AM",
                    instalacion_id="B202-CAMP",
                ),
                make_row(
                    source_row=3,
                    id_profesor="0000017786",
                    numero_documento_docente="80876044",
                    nombre_profesor="PROFESOR PRUEBA",
                    ciclo_lectivo="PERIODO 2017-1",
                    nombre_curso="GESTION DE OPERACIONES II",
                    id_seccion_combinada="0197",
                    dia="Viernes",
                    hora_inicio="09:00:AM",
                    hora_final="10:00:AM",
                    instalacion_id="B202-CAMP",
                ),
            ]
        )

        response = ReportService(self.repository).build_professor_sessions_report(
            ReportRequest(
                idProfesor="0000017786",
                cicloLectivo="PERIODO 2017-1",
                nombreCurso="GESTION DE OPERACIONES II",
            )
        )

        self.assertEqual(response.tabla[0].sesiones, 2)

    def test_report_rejects_missing_professor_identifier(self) -> None:
        self.load_rows([make_row()])

        with self.assertRaises(AppError) as context:
            ReportService(self.repository).build_professor_sessions_report(
                ReportRequest(numeroDocumentoDocente="", idProfesor="", cicloLectivo="PERIODO 2016-2")
            )

        self.assertEqual(context.exception.status_code, 400)

    def test_message_contains_markdown_table(self) -> None:
        self.load_rows([make_row()])
        response = ReportService(self.repository).build_professor_sessions_report(
            ReportRequest(numeroDocumentoDocente="52867332", idProfesor="", cicloLectivo="PERIODO 2016-2")
        )

        message = build_message(response.profesor, response.tabla)

        self.assertIn("Buen Día", message)
        self.assertIn("| Semestre | Materia | Sesiones | Departamento |", message)
        self.assertIn("SEMINARIO DE PRACTICA", message)


if __name__ == "__main__":
    unittest.main()
