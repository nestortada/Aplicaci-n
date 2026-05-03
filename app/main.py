from __future__ import annotations

import sys
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, Request

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import get_database_path
from app.exceptions import AppError, app_error_handler
from app.models import ReportRequest, ReportResponse, UploadResponse
from app.repository import DatasetRepository
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
    api.state.repository = repository
    api.add_exception_handler(AppError, app_error_handler)

    @api.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

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
        loaded_rows = repository.replace_rows(parsed_dataset.rows, uploaded_file.filename)

        return UploadResponse(
            estado="ok",
            archivo=uploaded_file.filename,
            filasCargadas=loaded_rows,
            columnasDetectadas=parsed_dataset.detected_columns,
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
        return ReportService(repository).build_professor_sessions_report(request)

    return api


async def get_repository(request: Request) -> DatasetRepository:
    return request.app.state.repository


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="127.0.0.1", port=8000)
