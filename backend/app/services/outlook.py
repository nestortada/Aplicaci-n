from __future__ import annotations

import json
import os
import subprocess
import tempfile
from pathlib import Path

from app.exceptions import AppError
from app.models import OutlookDraftRequest


def open_outlook_draft(request: OutlookDraftRequest) -> None:
    if os.name != "nt":
        raise AppError(
            400,
            "outlook_no_disponible",
            "La apertura directa de Outlook solo está disponible en Windows.",
            {"sugerencia": "Ejecute la aplicación local en Windows o use el botón de copiar."},
        )

    payload = {
        "to": request.to,
        "cc": ";".join(request.cc),
        "subject": request.subject,
        "bodyHtml": request.body_html,
    }
    json_path = _write_temp_payload(payload)
    script_path = _write_temp_script(_POWERSHELL_SCRIPT)
    startupinfo, creationflags = _hidden_windows_process_settings()
    try:
        completed = subprocess.run(
            [
                "powershell.exe",
                "-NoLogo",
                "-NoProfile",
                "-NonInteractive",
                "-WindowStyle",
                "Hidden",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                str(script_path),
                str(json_path),
            ],
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            startupinfo=startupinfo,
            creationflags=creationflags,
            timeout=20,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise AppError(
            500,
            "outlook_no_abierto",
            "No fue posible abrir Outlook automáticamente.",
            {"sugerencia": "Verifique que Outlook esté instalado y configurado en Windows."},
        ) from exc
    finally:
        json_path.unlink(missing_ok=True)
        script_path.unlink(missing_ok=True)

    if completed.returncode != 0:
        raise AppError(
            500,
            "outlook_no_abierto",
            "No fue posible abrir Outlook automáticamente.",
            {"sugerencia": "Verifique que Outlook esté instalado y configurado en Windows."},
        )


def _write_temp_payload(payload: dict[str, str]) -> Path:
    with tempfile.NamedTemporaryFile("w", delete=False, suffix=".json", encoding="utf-8") as temp_file:
        json.dump(payload, temp_file, ensure_ascii=False)
        return Path(temp_file.name)


def _write_temp_script(script: str) -> Path:
    with tempfile.NamedTemporaryFile("w", delete=False, suffix=".ps1", encoding="utf-8") as temp_file:
        temp_file.write(script)
        return Path(temp_file.name)


def _hidden_windows_process_settings() -> tuple[subprocess.STARTUPINFO | None, int]:
    if os.name != "nt":
        return None, 0

    startupinfo = subprocess.STARTUPINFO()
    startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
    startupinfo.wShowWindow = 0
    return startupinfo, subprocess.CREATE_NO_WINDOW


_POWERSHELL_SCRIPT = r"""
param([string]$payloadPath)
$payload = Get-Content -LiteralPath $payloadPath -Raw -Encoding UTF8 | ConvertFrom-Json
try {
    $outlook = [Runtime.InteropServices.Marshal]::GetActiveObject("Outlook.Application")
} catch {
    $outlook = New-Object -ComObject Outlook.Application
}
$mail = $outlook.CreateItem(0)
$mail.BodyFormat = 2
$mail.Display($false)
Start-Sleep -Milliseconds 250
$mail.To = [string]$payload.to
$mail.CC = [string]$payload.cc
$mail.Subject = [string]$payload.subject
$mail.HTMLBody = [string]$payload.bodyHtml
$mail.Save()
$mail.GetInspector.Activate()
"""
