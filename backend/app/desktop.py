from __future__ import annotations

import os
import socket
import sys
import threading
import webbrowser
from contextlib import suppress
from pathlib import Path

import uvicorn

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import get_server_host, get_server_port
from app.main import create_app


def main() -> None:
    _ensure_standard_streams()
    host = get_server_host()
    port = _available_port(get_server_port(), host)
    os.environ["PORT"] = str(port)

    url = f"http://{host}:{port}"
    threading.Timer(1.2, lambda: webbrowser.open(url)).start()
    uvicorn.run(create_app(), host=host, port=port, log_level="error", log_config=None, access_log=False)


def _ensure_standard_streams() -> None:
    if sys.stdout is not None and sys.stderr is not None:
        return

    null_stream = open(os.devnull, "w", encoding="utf-8")
    if sys.stdout is None:
        sys.stdout = null_stream
    if sys.stderr is None:
        sys.stderr = null_stream
    with suppress(Exception):
        if sys.stdin is None:
            sys.stdin = open(os.devnull, "r", encoding="utf-8")


def _available_port(preferred_port: int, host: str) -> int:
    for port in range(preferred_port, preferred_port + 30):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as server:
            server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                server.bind((host, port))
            except OSError:
                continue
            return port
    raise RuntimeError(f"No hay puertos disponibles desde {preferred_port} hasta {preferred_port + 29}.")


if __name__ == "__main__":
    main()
