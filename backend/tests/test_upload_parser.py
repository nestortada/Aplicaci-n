from __future__ import annotations

import asyncio
import unittest

from starlette.requests import Request

from app.exceptions import AppError
from app.services.upload_parser import extract_uploaded_file


class UploadParserTest(unittest.TestCase):
    def test_client_disconnect_returns_controlled_error(self) -> None:
        async def receive() -> dict[str, str]:
            return {"type": "http.disconnect"}

        request = Request(
            {
                "type": "http",
                "method": "POST",
                "path": "/api/uploads",
                "headers": [(b"content-type", b"multipart/form-data; boundary=test")],
                "query_string": b"",
                "server": ("testserver", 80),
                "scheme": "http",
                "client": ("testclient", 50000),
            },
            receive,
        )

        with self.assertRaises(AppError) as context:
            asyncio.run(extract_uploaded_file(request))

        self.assertEqual(context.exception.status_code, 499)
        self.assertEqual(context.exception.code, "cliente_desconectado")


if __name__ == "__main__":
    unittest.main()
