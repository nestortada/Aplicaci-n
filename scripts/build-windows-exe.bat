@echo off
setlocal

cd /d "%~dp0\.."

echo [1/4] Instalando dependencias del backend...
if not exist ".venv\Scripts\python.exe" (
  py -3 -m venv .venv
)
call ".venv\Scripts\python.exe" -m pip install --upgrade pip
call ".venv\Scripts\python.exe" -m pip install -r backend\requirements.txt pyinstaller
if errorlevel 1 exit /b 1

echo [2/4] Compilando frontend...
if exist "frontend\public\downloads\SabanaCertificado.exe" del /Q "frontend\public\downloads\SabanaCertificado.exe"
set "FRONTEND_BUILD_DIR=%TEMP%\sabana-certificado-frontend-build"
taskkill /F /IM esbuild.exe >nul 2>nul
if exist "%FRONTEND_BUILD_DIR%" rmdir /S /Q "%FRONTEND_BUILD_DIR%"
mkdir "%FRONTEND_BUILD_DIR%"
robocopy frontend "%FRONTEND_BUILD_DIR%" /E /XD node_modules dist coverage /XF SabanaCertificado.exe >nul
if %ERRORLEVEL% GEQ 8 exit /b 1

pushd "%FRONTEND_BUILD_DIR%"
call npm install --no-audit --no-fund
if errorlevel 1 (
  popd
  exit /b 1
)
set VITE_API_URL=
call npm run build
if errorlevel 1 (
  popd
  exit /b 1
)
popd
if exist "frontend\dist" rmdir /S /Q "frontend\dist"
robocopy "%FRONTEND_BUILD_DIR%\dist" "frontend\dist" /MIR >nul
if %ERRORLEVEL% GEQ 8 exit /b 1

echo [3/4] Empaquetando .exe...
set "PYINSTALLER_BUILD_ROOT=%TEMP%\sabana-certificado-pyinstaller-%RANDOM%%RANDOM%"
set "PYINSTALLER_WORK_DIR=%PYINSTALLER_BUILD_ROOT%\work"
set "PYINSTALLER_DIST_DIR=%PYINSTALLER_BUILD_ROOT%\dist"
call ".venv\Scripts\python.exe" -m PyInstaller --noconfirm --clean --workpath "%PYINSTALLER_WORK_DIR%" --distpath "%PYINSTALLER_DIST_DIR%" scripts\SabanaCertificado.spec
if errorlevel 1 exit /b 1

echo [4/4] Copiando instalador al frontend...
if not exist "frontend\public\downloads" mkdir "frontend\public\downloads"
if not exist "frontend\dist\downloads" mkdir "frontend\dist\downloads"
copy /Y "%PYINSTALLER_DIST_DIR%\SabanaCertificado.exe" "frontend\public\downloads\SabanaCertificado.exe"
copy /Y "%PYINSTALLER_DIST_DIR%\SabanaCertificado.exe" "frontend\dist\downloads\SabanaCertificado.exe"
if errorlevel 1 exit /b 1
rmdir /S /Q "%PYINSTALLER_BUILD_ROOT%" >nul 2>nul

echo.
echo Listo: frontend\public\downloads\SabanaCertificado.exe
echo Ese es el archivo que descarga el boton verde.
