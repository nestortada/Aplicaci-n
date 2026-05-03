# -*- mode: python ; coding: utf-8 -*-

from PyInstaller.utils.hooks import collect_submodules
from pathlib import Path


project_root = Path(SPECPATH).parent


hiddenimports = []
for package in ("fastapi", "pydantic", "pydantic_core", "starlette", "uvicorn"):
    hiddenimports += collect_submodules(package)


a = Analysis(
    [str(project_root / "backend" / "app" / "desktop.py")],
    pathex=[str(project_root / "backend")],
    binaries=[],
    datas=[(str(project_root / "frontend" / "dist"), "frontend/dist")],
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="SabanaCertificado",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
