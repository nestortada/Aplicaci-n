from __future__ import annotations

from dataclasses import dataclass
from email.parser import BytesParser
from email.policy import default

from fastapi import Request
from starlette.requests import ClientDisconnect

from app.exceptions import AppError


@dataclass(frozen=True)
class UploadedFileData:
    filename: str
    content: bytes


async def extract_uploaded_file(request: Request) -> UploadedFileData:
    content_type = request.headers.get("content-type", "")
    if not content_type.casefold().startswith("multipart/form-data"):
        raise AppError(400, "archivo_no_enviado", "Debe enviar el archivo en formato multipart/form-data.")

    try:
        body = await request.body()
    except ClientDisconnect as exc:
        raise AppError(
            499,
            "cliente_desconectado",
            "La carga del archivo se interrumpio antes de completarse.",
            {"sugerencia": "Intente subir el archivo nuevamente sin cerrar o recargar la pagina."},
        ) from exc
    if not body:
        raise AppError(400, "archivo_no_enviado", "No se envio ningun archivo.")

    try:
        message = BytesParser(policy=default).parsebytes(
            b"Content-Type: "
            + content_type.encode("utf-8")
            + b"\r\nMIME-Version: 1.0\r\n\r\n"
            + body
        )
    except Exception as exc:
        raise AppError(
            400,
            "multipart_invalido",
            "No fue posible interpretar el archivo enviado.",
            {"sugerencia": "Envie el archivo como multipart/form-data en el campo 'file'."},
        ) from exc

    if not message.is_multipart():
        raise AppError(400, "archivo_no_enviado", "No se encontro una parte de archivo en la solicitud.")

    for part in message.iter_parts():
        disposition = part.get_content_disposition()
        field_name = part.get_param("name", header="content-disposition")
        filename = part.get_filename()
        if disposition == "form-data" and field_name == "file" and filename:
            payload = part.get_payload(decode=True) or b""
            safe_filename = filename.replace("\\", "/").rsplit("/", 1)[-1]
            return UploadedFileData(filename=safe_filename, content=payload)

    raise AppError(400, "archivo_no_enviado", "Debe enviar un archivo en el campo 'file'.")
