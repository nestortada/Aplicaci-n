from __future__ import annotations

import sqlite3
import sys
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import get_allowed_origins, get_database_path
from app.exceptions import (
    AppError,
    app_error_handler,
    http_exception_handler,
    request_validation_error_handler,
    unexpected_error_handler,
)
from app.models import DatasetMetadata, FilterOptionsResponse, ReportRequest, ReportResponse, UploadResponse
from app.repository import DatasetRepository
from app.services.filter_options import build_component_options, build_course_options, build_cycle_options
from app.services.file_reader import parse_dataset_file
from app.services.report_service import ReportService
from app.services.upload_parser import extract_uploaded_file


def create_app(repository: DatasetRepository | None = None) -> FastAPI:
    repository = repository or DatasetRepository(get_database_path())
    repository.init_db()

    api = FastAPI(
        title="Reporte de Sesiones por Profesor",
        version="1.0.0",
        description="Backend para cargar bases Excel/CSV y generar reportes de sesiones por profesor.",
    )
    api.add_middleware(
        CORSMiddleware,
        allow_origins=get_allowed_origins(),
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    api.state.repository = repository
    api.add_exception_handler(AppError, app_error_handler)
    api.add_exception_handler(RequestValidationError, request_validation_error_handler)
    api.add_exception_handler(HTTPException, http_exception_handler)
    api.add_exception_handler(Exception, unexpected_error_handler)

    @api.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @api.get(
        "/api/uploads/estado",
        response_model=DatasetMetadata,
        response_model_by_alias=True,
    )
    async def upload_status(
        repository: Annotated[DatasetRepository, Depends(get_repository)],
    ) -> DatasetMetadata:
        return DatasetMetadata(**_safe_upload_metadata(repository))

    @api.post(
        "/api/uploads",
        response_model=UploadResponse,
        response_model_by_alias=True,
        openapi_extra={
            "requestBody": {
                "required": True,
                "content": {
                    "multipart/form-data": {
                        "schema": {
                            "type": "object",
                            "required": ["file"],
                            "properties": {"file": {"type": "string", "format": "binary"}},
                        }
                    }
                },
            }
        },
    )
    async def upload_dataset(
        request: Request,
        repository: Annotated[DatasetRepository, Depends(get_repository)],
    ) -> UploadResponse:
        uploaded_file = await extract_uploaded_file(request)
        parsed_dataset = parse_dataset_file(uploaded_file.filename, uploaded_file.content)
        try:
            loaded_rows = repository.replace_rows(parsed_dataset.rows, uploaded_file.filename)
        except sqlite3.Error as exc:
            raise AppError(
                500,
                "base_no_guardada",
                "El archivo fue leido, pero no fue posible guardar la base de datos.",
                {
                    "archivo": uploaded_file.filename,
                    "filasLeidas": len(parsed_dataset.rows),
                    "baseDatos": _safe_upload_metadata(repository),
                    "sugerencia": "Verifique permisos y disponibilidad del archivo SQLite configurado.",
                },
            ) from exc
        metadata = _safe_upload_metadata(repository)

        return UploadResponse(
            estado="ok",
            archivo=uploaded_file.filename,
            filasCargadas=loaded_rows,
            columnasDetectadas=parsed_dataset.detected_columns,
            baseDatos=metadata,
        )

    @api.delete(
        "/api/uploads",
        response_model=DatasetMetadata,
        response_model_by_alias=True,
    )
    async def delete_dataset(
        repository: Annotated[DatasetRepository, Depends(get_repository)],
    ) -> DatasetMetadata:
        try:
            repository.clear()
        except sqlite3.Error as exc:
            raise AppError(
                500,
                "base_no_borrada",
                "No fue posible borrar la base de datos cargada.",
                {
                    "baseDatos": _safe_upload_metadata(repository),
                    "sugerencia": "Verifique que la base SQLite exista y sea accesible.",
                },
            ) from exc
        return DatasetMetadata(**_safe_upload_metadata(repository))

    @api.get(
        "/api/filtros/ciclos",
        response_model=FilterOptionsResponse,
        response_model_by_alias=True,
    )
    async def cycle_filters(
        repository: Annotated[DatasetRepository, Depends(get_repository)],
    ) -> FilterOptionsResponse:
        rows = _safe_rows(repository)
        return FilterOptionsResponse(opciones=build_cycle_options(rows))

    @api.get(
        "/api/filtros/materias",
        response_model=FilterOptionsResponse,
        response_model_by_alias=True,
    )
    async def course_filters(
        repository: Annotated[DatasetRepository, Depends(get_repository)],
        numero_documento_docente: Annotated[str, Query(alias="numeroDocumentoDocente")] = "",
        id_profesor: Annotated[str, Query(alias="idProfesor")] = "",
        ciclo_lectivo_inicio: Annotated[str, Query(alias="cicloLectivoInicio")] = "",
        ciclo_lectivo_final: Annotated[str, Query(alias="cicloLectivoFinal")] = "",
    ) -> FilterOptionsResponse:
        rows = _safe_rows(repository)
        return FilterOptionsResponse(
            opciones=build_course_options(
                rows,
                numero_documento_docente,
                id_profesor,
                ciclo_lectivo_inicio,
                ciclo_lectivo_final,
            )
        )

    @api.get(
        "/api/filtros/componentes",
        response_model=FilterOptionsResponse,
        response_model_by_alias=True,
    )
    async def component_filters(
        repository: Annotated[DatasetRepository, Depends(get_repository)],
        numero_documento_docente: Annotated[str, Query(alias="numeroDocumentoDocente")] = "",
        id_profesor: Annotated[str, Query(alias="idProfesor")] = "",
        ciclo_lectivo_inicio: Annotated[str, Query(alias="cicloLectivoInicio")] = "",
        ciclo_lectivo_final: Annotated[str, Query(alias="cicloLectivoFinal")] = "",
        nombre_curso: Annotated[str, Query(alias="nombreCurso")] = "TODOS",
    ) -> FilterOptionsResponse:
        rows = _safe_rows(repository)
        return FilterOptionsResponse(
            opciones=build_component_options(
                rows,
                numero_documento_docente,
                id_profesor,
                ciclo_lectivo_inicio,
                ciclo_lectivo_final,
                nombre_curso,
            )
        )

    @api.post(
        "/api/reportes/sesiones-profesor",
        response_model=ReportResponse,
        response_model_by_alias=True,
    )
    async def professor_sessions_report(
        request: ReportRequest,
        repository: Annotated[DatasetRepository, Depends(get_repository)],
    ) -> ReportResponse:
        try:
            return ReportService(repository).build_professor_sessions_report(request)
        except sqlite3.Error as exc:
            raise AppError(
                500,
                "base_no_disponible",
                "No fue posible consultar la base de datos cargada.",
                {
                    "baseDatos": _safe_upload_metadata(repository),
                    "sugerencia": "Verifique que la base SQLite exista y sea accesible.",
                },
            ) from exc

    return api


async def get_repository(request: Request) -> DatasetRepository:
    return request.app.state.repository


def _safe_upload_metadata(repository: DatasetRepository) -> dict[str, object]:
    try:
        return repository.get_upload_metadata()
    except sqlite3.Error:
        return {
            "activa": False,
            "archivo": "",
            "fechaCarga": "",
            "filasCargadas": 0,
            "error": "No fue posible leer la metadata de la base.",
        }


def _safe_rows(repository: DatasetRepository) -> list[dict[str, object]]:
    try:
        return repository.get_rows()
    except sqlite3.Error as exc:
        raise AppError(
            500,
            "base_no_disponible",
            "No fue posible consultar la base de datos cargada.",
            {
                "baseDatos": _safe_upload_metadata(repository),
                "sugerencia": "Verifique que la base SQLite exista y sea accesible.",
            },
        ) from exc


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="127.0.0.1", port=8000)
