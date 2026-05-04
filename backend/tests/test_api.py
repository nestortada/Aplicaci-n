from __future__ import annotations

import tempfile
import unittest
import asyncio
from io import BytesIO
from pathlib import Path
from unittest.mock import patch

import httpx
from openpyxl import Workbook

from app.main import create_app
from app.repository import DatasetRepository
from app.services.normalization import REQUIRED_COLUMNS


def xlsx_bytes(headers: list[str], rows: list[list[str]]) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.append(headers)
    for row in rows:
        sheet.append(row)

    output = BytesIO()
    workbook.save(output)
    return output.getvalue()


def valid_headers() -> list[str]:
    return list(REQUIRED_COLUMNS.values())


def valid_row(**overrides: str) -> list[str]:
    data = {
        "Ciclo Lectivo": "PERIODO 2016-2",
        "Nombre del curso": "SEMINARIO DE PRACTICA",
        "Componente": "LEC",
        "Día": " Martes",
        "Hora Inicio": "05:00:PM",
        "Hora Final": "06:00:PM",
        "ID Instalación": "B104-CAMP",
        "ID Instalación descripción": "AULA B104",
        "Id profesor": "0000005357",
        "Numero documento docente": "52867332",
        "Nombre profesor": "MARTINEZ HERNANDEZ LINA MARIA",
        "Departamento": "1221",
        "Descripción Materia": "PROCESOS INDUSTRIALES",
        "ID Sección Combinada": "",
    }
    data.update(overrides)
    return [data[header] for header in valid_headers()]


class ApiTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        repository = DatasetRepository(Path(self.temp_dir.name) / "api.sqlite3")
        self.app = create_app(repository)

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def request(self, method: str, url: str, **kwargs: object) -> httpx.Response:
        return asyncio.run(self._request(method, url, **kwargs))

    async def _request(self, method: str, url: str, **kwargs: object) -> httpx.Response:
        transport = httpx.ASGITransport(app=self.app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            return await client.request(method, url, **kwargs)

    async def _request_with_app(self, app: object, method: str, url: str, **kwargs: object) -> httpx.Response:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            return await client.request(method, url, **kwargs)

    def upload_valid_dataset(self, rows: list[list[str]] | None = None) -> None:
        content = xlsx_bytes(valid_headers(), rows or [valid_row()])
        response = self.request(
            "POST",
            "/api/uploads",
            files={
                "file": (
                    "datos.xlsx",
                    content,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
        )
        self.assertEqual(response.status_code, 200, response.text)

    def test_upload_valid_xlsx(self) -> None:
        content = xlsx_bytes(valid_headers(), [valid_row()])

        response = self.request(
            "POST",
            "/api/uploads",
            files={
                "file": (
                    "datos.xlsx",
                    content,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["archivo"], "datos.xlsx")
        self.assertEqual(payload["filasCargadas"], 1)
        self.assertTrue(payload["baseDatos"]["activa"])
        self.assertEqual(payload["baseDatos"]["archivo"], "datos.xlsx")
        self.assertIn("Ciclo Lectivo", payload["columnasDetectadas"])

    def test_upload_status_reports_active_dataset(self) -> None:
        response = self.request("GET", "/api/uploads/estado")

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["activa"])

        self.upload_valid_dataset()

        response = self.request("GET", "/api/uploads/estado")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["activa"])
        self.assertEqual(payload["archivo"], "datos.xlsx")
        self.assertEqual(payload["filasCargadas"], 1)

    def test_render_uploads_are_isolated_by_browser_session(self) -> None:
        with patch.dict("os.environ", {"RENDER": "true"}, clear=True):
            app = create_app()

        content = xlsx_bytes(valid_headers(), [valid_row()])
        upload_response = asyncio.run(
            self._request_with_app(
                app,
                "POST",
                "/api/uploads",
                headers={"X-Certisabana-Session": "session-a"},
                files={
                    "file": (
                        "datos.xlsx",
                        content,
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    )
                },
            )
        )
        self.assertEqual(upload_response.status_code, 200, upload_response.text)

        same_session_response = asyncio.run(
            self._request_with_app(
                app,
                "GET",
                "/api/uploads/estado",
                headers={"X-Certisabana-Session": "session-a"},
            )
        )
        self.assertTrue(same_session_response.json()["activa"])

        other_session_response = asyncio.run(
            self._request_with_app(
                app,
                "GET",
                "/api/uploads/estado",
                headers={"X-Certisabana-Session": "session-b"},
            )
        )
        self.assertFalse(other_session_response.json()["activa"])

    def test_delete_upload_clears_active_dataset(self) -> None:
        self.upload_valid_dataset()

        response = self.request("DELETE", "/api/uploads")

        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertFalse(payload["activa"])
        self.assertEqual(payload["archivo"], "")
        self.assertEqual(payload["filasCargadas"], 0)

        response = self.request("GET", "/api/uploads/estado")
        self.assertFalse(response.json()["activa"])

    def test_filter_cycles_returns_unique_sorted_options(self) -> None:
        self.upload_valid_dataset(
            [
                valid_row(**{"Ciclo Lectivo": "PERIODO 2017-2"}),
                valid_row(**{"Ciclo Lectivo": "PERIODO 2016-2"}),
                valid_row(**{"Ciclo Lectivo": "PERIODO 2017-1"}),
                valid_row(**{"Ciclo Lectivo": "PERIODO 2017-1"}),
            ]
        )

        response = self.request("GET", "/api/filtros/ciclos")

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(
            response.json()["opciones"],
            [
                {"valor": "PERIODO 2016-2", "etiqueta": "2016-II"},
                {"valor": "PERIODO 2017-1", "etiqueta": "2017-I"},
                {"valor": "PERIODO 2017-2", "etiqueta": "2017-II"},
            ],
        )

    def test_filter_courses_respects_professor_and_cycle_range(self) -> None:
        self.upload_valid_dataset(
            [
                valid_row(**{"Ciclo Lectivo": "PERIODO 2016-2", "Nombre del curso": "CURSO ANTIGUO"}),
                valid_row(**{"Ciclo Lectivo": "PERIODO 2017-1", "Nombre del curso": "CURSO ACTUAL"}),
                valid_row(
                    **{
                        "Ciclo Lectivo": "PERIODO 2017-1",
                        "Nombre del curso": "CURSO OTRO PROFESOR",
                        "Id profesor": "0000009999",
                        "Numero documento docente": "999",
                    }
                ),
            ]
        )

        response = self.request(
            "GET",
            "/api/filtros/materias",
            params={
                "numeroDocumentoDocente": "52867332",
                "cicloLectivoInicio": "PERIODO 2017-1",
                "cicloLectivoFinal": "PERIODO 2017-1",
            },
        )

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["opciones"], [{"valor": "CURSO ACTUAL", "etiqueta": "CURSO ACTUAL"}])

    def test_filter_components_respects_professor_cycle_and_course(self) -> None:
        self.upload_valid_dataset(
            [
                valid_row(**{"Ciclo Lectivo": "PERIODO 2017-1", "Nombre del curso": "CURSO ACTUAL", "Componente": "LAB"}),
                valid_row(**{"Ciclo Lectivo": "PERIODO 2017-1", "Nombre del curso": "CURSO ACTUAL", "Componente": "LEC"}),
                valid_row(**{"Ciclo Lectivo": "PERIODO 2017-1", "Nombre del curso": "CURSO DISTINTO", "Componente": "TEO"}),
            ]
        )

        response = self.request(
            "GET",
            "/api/filtros/componentes",
            params={
                "idProfesor": "0000005357",
                "cicloLectivoInicio": "PERIODO 2017-1",
                "cicloLectivoFinal": "PERIODO 2017-1",
                "nombreCurso": "CURSO ACTUAL",
            },
        )

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(
            response.json()["opciones"],
            [
                {"valor": "LAB", "etiqueta": "LAB"},
                {"valor": "LEC", "etiqueta": "LEC"},
            ],
        )

    def test_filter_components_accepts_multiple_courses(self) -> None:
        self.upload_valid_dataset(
            [
                valid_row(**{"Ciclo Lectivo": "PERIODO 2017-1", "Nombre del curso": "CURSO ACTUAL", "Componente": "LAB"}),
                valid_row(**{"Ciclo Lectivo": "PERIODO 2017-1", "Nombre del curso": "CURSO DISTINTO", "Componente": "TEO"}),
                valid_row(**{"Ciclo Lectivo": "PERIODO 2017-1", "Nombre del curso": "CURSO FUERA", "Componente": "LEC"}),
            ]
        )

        response = self.request(
            "GET",
            "/api/filtros/componentes",
            params=[
                ("idProfesor", "0000005357"),
                ("cicloLectivoInicio", "PERIODO 2017-1"),
                ("cicloLectivoFinal", "PERIODO 2017-1"),
                ("nombreCurso", "CURSO ACTUAL"),
                ("nombreCurso", "CURSO DISTINTO"),
            ],
        )

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(
            response.json()["opciones"],
            [
                {"valor": "LAB", "etiqueta": "LAB"},
                {"valor": "TEO", "etiqueta": "TEO"},
            ],
        )

    def test_upload_missing_columns_returns_422(self) -> None:
        content = xlsx_bytes(["Ciclo Lectivo", "Nombre del curso"], [["PERIODO 2016-2", "CURSO"]])

        response = self.request(
            "POST",
            "/api/uploads",
            files={
                "file": (
                    "incompleto.xlsx",
                    content,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
        )

        self.assertEqual(response.status_code, 422)
        self.assertIn("Hora Inicio", response.json()["detail"]["columnasFaltantes"])

    def test_upload_without_file_returns_400(self) -> None:
        response = self.request("POST", "/api/uploads")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"]["code"], "archivo_no_enviado")
        self.assertIn("contexto", response.json()["detail"])

    def test_query_valid_report(self) -> None:
        self.upload_valid_dataset()

        response = self.request(
            "POST",
            "/api/reportes/sesiones-profesor",
            json={
                "numeroDocumentoDocente": "52867332",
                "idProfesor": "",
                "cicloLectivo": "periodo 2016-2",
                "nombreCurso": "TODOS",
                "componente": "TODOS",
                "visualizarComponente": False,
            },
        )

        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(payload["profesor"], "MARTINEZ HERNANDEZ LINA MARIA")
        self.assertEqual(payload["tabla"][0]["sesiones"], 1)
        self.assertEqual(payload["tabla"][0]["semestre"], "PERIODO 2016-2")
        self.assertEqual(payload["tabla"][0]["materia"], "SEMINARIO DE PRACTICA")
        self.assertEqual(payload["tabla"][0]["departamento"], "PROCESOS INDUSTRIALES")
        self.assertIn("| Semestre | Materia | Sesiones | Departamento |", payload["mensaje"])

    def test_query_without_cycle_returns_all_cycles(self) -> None:
        self.upload_valid_dataset(
            [
                valid_row(**{"Ciclo Lectivo": "PERIODO 2016-2"}),
                valid_row(**{"Ciclo Lectivo": "PERIODO 2017-1"}),
            ]
        )

        response = self.request(
            "POST",
            "/api/reportes/sesiones-profesor",
            json={
                "numeroDocumentoDocente": "52867332",
                "idProfesor": "",
                "nombreCurso": "TODOS",
                "componente": "TODOS",
                "visualizarComponente": False,
            },
        )

        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual([row["semestre"] for row in payload["tabla"]], ["PERIODO 2016-2", "PERIODO 2017-1"])

    def test_query_with_cycle_start_and_end_returns_range(self) -> None:
        self.upload_valid_dataset(
            [
                valid_row(**{"Ciclo Lectivo": "PERIODO 2016-2"}),
                valid_row(**{"Ciclo Lectivo": "PERIODO 2017-1"}),
                valid_row(**{"Ciclo Lectivo": "PERIODO 2017-2"}),
            ]
        )

        response = self.request(
            "POST",
            "/api/reportes/sesiones-profesor",
            json={
                "numeroDocumentoDocente": "52867332",
                "idProfesor": "",
                "cicloLectivoInicio": "PERIODO 2017-1",
                "cicloLectivoFinal": "PERIODO 2017-2",
                "nombreCurso": "TODOS",
                "componente": "TODOS",
                "visualizarComponente": False,
            },
        )

        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual([row["semestre"] for row in payload["tabla"]], ["PERIODO 2017-1", "PERIODO 2017-2"])

    def test_query_without_professor_identifier_returns_400(self) -> None:
        response = self.request(
            "POST",
            "/api/reportes/sesiones-profesor",
            json={"numeroDocumentoDocente": "", "idProfesor": "", "cicloLectivo": "PERIODO 2016-2"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"]["code"], "profesor_requerido")
        self.assertIn("parametrosRecibidos", response.json()["detail"])
        self.assertIn("baseDatos", response.json()["detail"])

    def test_query_with_unknown_parameter_returns_contextual_422(self) -> None:
        response = self.request(
            "POST",
            "/api/reportes/sesiones-profesor",
            json={
                "numeroDocumentoDocente": "52867332",
                "idProfesor": "",
                "cicloLectivo": "PERIODO 2016-2",
                "parametroInventado": "valor",
            },
        )

        self.assertEqual(response.status_code, 422)
        payload = response.json()["detail"]
        self.assertEqual(payload["code"], "parametros_invalidos")
        self.assertIn("contexto", payload)
        self.assertEqual(payload["errores"][0]["campo"], "parametroInventado")

    def test_query_with_invalid_time_returns_422(self) -> None:
        self.upload_valid_dataset([valid_row(**{"Hora Inicio": "hora mala"})])

        response = self.request(
            "POST",
            "/api/reportes/sesiones-profesor",
            json={"numeroDocumentoDocente": "52867332", "idProfesor": "", "cicloLectivo": "PERIODO 2016-2"},
        )

        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["detail"]["code"], "horas_invalidas")
        self.assertIn("parametrosRecibidos", response.json()["detail"])


if __name__ == "__main__":
    unittest.main()
