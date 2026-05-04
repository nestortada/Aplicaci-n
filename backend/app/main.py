from __future__ import annotations

import sqlite3
import sys
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import (
    get_allowed_origin_regex,
    get_allowed_origins,
    get_database_path,
    get_frontend_dist_path,
    get_server_host,
    get_server_port,
    is_render_environment,
)
from app.exceptions import (
    AppError,
    app_error_handler,
    http_exception_handler,
    request_validation_error_handler,
    unexpected_error_handler,
)
from app.models import DatasetMetadata, FilterOptionsResponse, ReportRequest, ReportResponse, UploadResponse
from app.repository import DatasetRepository, InMemoryDatasetRepository
from app.services.filter_options import build_component_options, build_course_options, build_cycle_options
from app.services.file_reader import parse_dataset_file
from app.services.report_service import ReportService
from app.services.upload_parser import extract_uploaded_file


Repository = DatasetRepository | InMemoryDatasetRepository
SESSION_HEADER = "x-certisabana-session"


def create_app(repository: Repository | None = None) -> FastAPI:
    use_session_repositories = repository is None and is_render_environment()
    if not use_session_repositories:
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
        allow_origin_regex=get_allowed_origin_regex(),
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    api.state.use_session_repositories = use_session_repositories
    if use_session_repositories:
        api.state.session_repositories = {}
    else:
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
        repository: Annotated[Repository, Depends(get_repository)],
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
        repository: Annotated[Repository, Depends(get_repository)],
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
        repository: Annotated[Repository, Depends(get_repository)],
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
        repository: Annotated[Repository, Depends(get_repository)],
    ) -> FilterOptionsResponse:
        rows = _safe_rows(repository)
        return FilterOptionsResponse(opciones=build_cycle_options(rows))

    @api.get(
        "/api/filtros/materias",
        response_model=FilterOptionsResponse,
        response_model_by_alias=True,
    )
    async def course_filters(
        repository: Annotated[Repository, Depends(get_repository)],
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
        repository: Annotated[Repository, Depends(get_repository)],
        numero_documento_docente: Annotated[str, Query(alias="numeroDocumentoDocente")] = "",
        id_profesor: Annotated[str, Query(alias="idProfesor")] = "",
        ciclo_lectivo_inicio: Annotated[str, Query(alias="cicloLectivoInicio")] = "",
        ciclo_lectivo_final: Annotated[str, Query(alias="cicloLectivoFinal")] = "",
        nombre_curso: list[str] = Query(default_factory=lambda: ["TODOS"], alias="nombreCurso"),
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
        repository: Annotated[Repository, Depends(get_repository)],
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

    _mount_frontend(api)

    return api


def _mount_frontend(api: FastAPI) -> None:
    frontend_dist_path = get_frontend_dist_path()
    index_path = frontend_dist_path / "index.html"
    assets_path = frontend_dist_path / "assets"

    if not index_path.exists():
        return

    if assets_path.exists():
        api.mount("/assets", StaticFiles(directory=assets_path), name="assets")

    @api.api_route("/{full_path:path}", methods=["GET", "HEAD"], include_in_schema=False)
    async def serve_frontend(full_path: str) -> FileResponse:
        requested_path = (frontend_dist_path / full_path).resolve()
        if full_path and requested_path.is_file() and frontend_dist_path.resolve() in requested_path.parents:
            return FileResponse(requested_path)
        if full_path.startswith("downloads/"):
            raise HTTPException(status_code=404, detail="Archivo no encontrado.")
        return FileResponse(index_path)


async def get_repository(request: Request) -> Repository:
    if getattr(request.app.state, "use_session_repositories", False):
        session_id = _get_session_id(request)
        repositories: dict[str, InMemoryDatasetRepository] = request.app.state.session_repositories
        if session_id not in repositories:
            repositories[session_id] = InMemoryDatasetRepository()
        return repositories[session_id]
    return request.app.state.repository


def _get_session_id(request: Request) -> str:
    raw_session_id = request.headers.get(SESSION_HEADER, "").strip()
    if not raw_session_id:
        raise AppError(
            400,
            "sesion_no_disponible",
            "No fue posible identificar la sesion temporal del navegador.",
            {"sugerencia": "Recargue la pagina e intente subir la base nuevamente."},
        )
    return raw_session_id[:128]


def _safe_upload_metadata(repository: Repository) -> dict[str, object]:
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


def _safe_rows(repository: Repository) -> list[dict[str, object]]:
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

    uvicorn.run("app.main:app", host=get_server_host(), port=get_server_port())
