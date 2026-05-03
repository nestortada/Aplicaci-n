from __future__ import annotations

from dataclasses import dataclass
import logging
from uuid import uuid4
from typing import Any

from fastapi import HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


@dataclass
class AppError(Exception):
    status_code: int
    code: str
    message: str
    details: dict[str, Any] | None = None


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return _error_response(request, exc.status_code, exc.code, exc.message, exc.details)


async def request_validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    errores = [_format_validation_error(error) for error in exc.errors()]
    return _error_response(
        request,
        422,
        "parametros_invalidos",
        "La solicitud tiene parametros invalidos o incompletos.",
        {
            "errores": errores,
            "sugerencia": "Revise los nombres y tipos de los campos enviados.",
        },
    )


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    status_code = exc.status_code
    message = str(exc.detail) if exc.detail else "No fue posible procesar la solicitud."
    code = "ruta_no_encontrada" if status_code == 404 else "solicitud_invalida"
    return _error_response(request, status_code, code, message)


async def unexpected_error_handler(request: Request, exc: Exception) -> JSONResponse:
    logging.exception("Unhandled API error", exc_info=exc)
    return _error_response(
        request,
        500,
        "error_interno",
        "Ocurrio un error inesperado procesando la solicitud.",
        {"sugerencia": "Intente nuevamente y reporte el requestId si el problema continua."},
    )


def _error_response(
    request: Request,
    status_code: int,
    code: str,
    message: str,
    details: dict[str, Any] | None = None,
) -> JSONResponse:
    request_id = request.headers.get("x-request-id") or uuid4().hex
    payload: dict[str, Any] = {
        "code": code,
        "message": message,
        "contexto": {
            "requestId": request_id,
            "metodo": request.method,
            "ruta": request.url.path,
        },
    }
    if details:
        details_copy = dict(details)
        detail_context = details_copy.pop("contexto", None)
        payload.update(details_copy)
        if isinstance(detail_context, dict):
            payload["contexto"].update(detail_context)
    return JSONResponse(status_code=status_code, content={"detail": payload})


def _format_validation_error(error: dict[str, Any]) -> dict[str, Any]:
    loc = [str(part) for part in error.get("loc", []) if part not in {"body", "query", "path"}]
    formatted = {
        "campo": ".".join(loc) if loc else "solicitud",
        "mensaje": error.get("msg", "Valor invalido."),
        "tipo": error.get("type", "validation_error"),
    }
    if "input" in error:
        formatted["valorRecibido"] = _safe_value(error["input"])
    return formatted


def _safe_value(value: Any) -> Any:
    if isinstance(value, bytes):
        return f"<{len(value)} bytes>"
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    if isinstance(value, list):
        return [_safe_value(item) for item in value[:10]]
    if isinstance(value, dict):
        return {str(key): _safe_value(item) for key, item in list(value.items())[:20]}
    return str(value)
