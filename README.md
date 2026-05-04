# Sabana Certificado

Aplicacion para cargar una base academica en formato `.xlsx` o `.csv`, consultar la informacion de un profesor y generar un reporte de sesiones listo para copiar. El frontend permite subir la base, filtrar por identificacion, rango de ciclos, materia y componente; el backend valida el archivo, guarda la informacion en SQLite y calcula la tabla final del reporte.

## Como funciona

El proyecto esta separado en dos capas:

- `frontend/`: aplicacion React + Vite. Contiene la interfaz de carga de archivo, filtros, vista previa del certificado, copiado de tabla/mensaje y boton de descarga del `.exe`.
- `backend/`: API FastAPI. Recibe la base, normaliza columnas, persiste los registros en SQLite, expone filtros dinamicos y genera el reporte de sesiones por profesor.

Flujo principal:

1. El usuario carga un archivo `.xlsx` o `.csv` desde la interfaz.
2. El backend valida que existan las columnas esperadas y reemplaza la base activa en SQLite.
3. La interfaz consulta ciclos, materias y componentes disponibles segun los filtros.
4. Al buscar un profesor, el backend filtra por documento o ID, ciclo, materia y componente.
5. El servicio de reportes deduplica secciones combinadas, calcula horas/sesiones y retorna la tabla junto con un mensaje listo para copiar.

Columnas obligatorias del archivo:

```text
Ciclo Lectivo
Nombre del curso
Componente
Día
Hora Inicio
Hora Final
ID Instalación
ID Instalación descripción
Id profesor
Numero documento docente
Nombre profesor
Departamento
Descripción Materia
ID Sección Combinada
```

## Requisitos

- Python 3.11 o superior recomendado.
- Node.js 18 o superior.
- npm.

En Windows, para generar el ejecutable tambien se usa PyInstaller, instalado por el script de build.

## Configuracion

El backend lee variables desde `.env` si existe en la raiz del proyecto. Las principales son:

```env
DATABASE_PATH=data/reportes.sqlite3
FRONTEND_DIST_PATH=frontend/dist
HOST=127.0.0.1
PORT=8000
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

El frontend puede tomar estas variables en `frontend/.env`:

```env
VITE_API_URL=http://127.0.0.1:8000
VITE_INSTALLER_URL=/downloads/SabanaCertificado.exe
```

Hay un ejemplo disponible en `frontend/.env.example`.

## Desplegar backend en Vercel

El repositorio incluye configuracion para desplegar el backend FastAPI en Vercel:

- `backend/index.py`: entrada que Vercel detecta y que carga `backend/app/main.py`.
- `backend/requirements.txt`: dependencias Python del backend.
- `backend/vercel.json`: enruta `/api/*` y `/health` hacia la funcion Python.

Al crear el proyecto en Vercel, configura `backend` como Root Directory. Asi Vercel instala `backend/requirements.txt` y usa `backend/vercel.json`.

En Vercel no se debe depender de persistencia local con SQLite. Por eso, cuando Vercel define `VERCEL=1`, el backend usa por defecto:

```text
/tmp/reportes.sqlite3
```

Esa ruta permite guardar la base cargada mientras la funcion/instancia siga viva, pero puede perderse entre despliegues, reinicios o nuevas instancias. En la practica, en Vercel hay que volver a subir el archivo cuando la base ya no este activa. En desarrollo local y en el `.exe`, SQLite conserva el comportamiento persistente anterior:

- local: `data/reportes.sqlite3`
- `.exe` Windows: `%LOCALAPPDATA%\SabanaCertificado\data\reportes.sqlite3`

Si despliegas solo el backend, configura el frontend con la URL publica de Vercel:

```env
VITE_API_URL=https://tu-proyecto.vercel.app
```

Y en las variables de entorno del proyecto de Vercel agrega el origen del frontend si esta en otro dominio:

```env
ALLOWED_ORIGINS=https://tu-frontend.vercel.app
```

## Ejecutar en local

Ejecuta estos comandos desde la raiz del proyecto.

## Ejecutar con Docker

La aplicacion puede correr en un solo contenedor: el frontend se compila con Vite y FastAPI sirve tanto la API como los archivos estaticos generados.

```bash
docker compose up --build
```

La aplicacion queda disponible en:

```text
http://localhost:8080
```

El archivo SQLite se guarda en el volumen `sabana_certificado_data`, por lo que la base cargada se conserva aunque reinicies el contenedor. Para detener la aplicacion:

```bash
docker compose down
```

Si necesitas borrar tambien la base persistida:

```bash
docker compose down -v
```

### 1. Preparar el backend

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

En Windows PowerShell:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
```

Levanta la API:

```bash
uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
```

La API queda disponible en:

```text
http://127.0.0.1:8000
```

Puedes validar que esta viva con:

```text
http://127.0.0.1:8000/health
```

### 2. Preparar el frontend

En otra terminal:

```bash
cd frontend
npm install
npm run dev
```

La aplicacion queda disponible en:

```text
http://localhost:5173
```

En desarrollo, el frontend usa `http://127.0.0.1:8000` como API por defecto cuando corre en el puerto `5173`.

## Endpoints principales

- `GET /health`: verifica que el backend este activo.
- `POST /api/uploads`: carga un archivo `.xlsx` o `.csv`.
- `GET /api/uploads/estado`: consulta si hay una base activa.
- `DELETE /api/uploads`: borra la base cargada.
- `GET /api/filtros/ciclos`: lista ciclos disponibles.
- `GET /api/filtros/materias`: lista materias segun profesor y ciclos.
- `GET /api/filtros/componentes`: lista componentes segun profesor, ciclos y materia.
- `POST /api/reportes/sesiones-profesor`: genera el reporte final.

## Pruebas

Backend:

```bash
PYTHONPATH=backend pytest backend/tests
```

Frontend:

```bash
cd frontend
npm test
```

## Build y ejecutable de Windows

Para compilar el frontend:

```bash
cd frontend
npm run build
```

El backend puede servir automaticamente `frontend/dist` si ese build existe.

Para generar el `.exe` en Windows, ejecuta desde una terminal de Windows, no desde WSL:

```bat
scripts\build-windows-exe.bat
```

Ese script instala dependencias del backend, compila el frontend, empaqueta FastAPI con PyInstaller y copia el ejecutable a:

```text
frontend\public\downloads\SabanaCertificado.exe
frontend\dist\downloads\SabanaCertificado.exe
```

Mas detalles del empaquetado estan en `BUILD_EXE.md`.
