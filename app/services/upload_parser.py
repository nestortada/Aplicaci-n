from __future__ import annotations

from dataclasses import dataclass
from email.parser import BytesParser
from email.policy import default

from fastapi import Request

from app.exceptions import AppError


@dataclass(frozen=True)
class UploadedFileData:
    filename: str
    content: bytes


async def extract_uploaded_file(request: Request) -> UploadedFileData:
    content_type = request.headers.get("content-type", "")
    if not content_type.casefold().startswith("multipart/form-data"):
        raise AppError(400, "archivo_no_enviado", "Debe enviar el archivo en formato multipart/form-data.")

    body = await request.body()
    if not body:
        raise AppError(400, "archivo_no_enviado", "No se envio ningun archivo.")

    message = BytesParser(policy=default).parsebytes(
        b"Content-Type: "
        + content_type.encode("utf-8")
        + b"\r\nMIME-Version: 1.0\r\n\r\n"
        + body
    )

    if not message.is_multipart():
        raise AppError(400, "archivo_no_enviado", "No se encontro una parte de archivo en la solicitud.")

    for part in message.iter_parts():
        disposition = part.get_content_disposition()
        field_name = part.get_param("name", header="content-disposition")
        filename = part.get_filename()
        if disposition == "form-data" and field_name == "file" and filename:
            payload = part.get_payload(decode=True) or b""
            return UploadedFileData(filename=filename, content=payload)

    raise AppError(400, "archivo_no_enviado", "Debe enviar un archivo en el campo 'file'.")

