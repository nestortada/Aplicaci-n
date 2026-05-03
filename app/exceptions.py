from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from fastapi import Request
from fastapi.responses import JSONResponse


@dataclass
class AppError(Exception):
    status_code: int
    code: str
    message: str
    details: dict[str, Any] | None = None


async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
    payload: dict[str, Any] = {
        "code": exc.code,
        "message": exc.message,
    }
    if exc.details:
        payload.update(exc.details)
    return JSONResponse(status_code=exc.status_code, content={"detail": payload})

