# Crear el .exe de Windows

Ejecuta este comando desde Windows, no desde WSL:

```bat
scripts\build-windows-exe.bat
```

El script compila el frontend, empaqueta el backend con PyInstaller y copia el ejecutable final a:

```text
frontend\public\downloads\SabanaCertificado.exe
frontend\dist\downloads\SabanaCertificado.exe
```

Ese es el archivo que descarga el boton verde del frontend.

Si Windows muestra advertencias de antivirus o SmartScreen, normalmente se debe a que el `.exe` no esta firmado digitalmente. Para distribucion formal conviene firmarlo con un certificado de codigo.

Si `npm` falla con `EPERM` sobre `node_modules\@esbuild\...\esbuild.exe`, cierra cualquier servidor `npm run dev`, terminal o editor que pueda estar usando el frontend y vuelve a ejecutar el script. El build compila el frontend en `%TEMP%\sabana-certificado-frontend-build` y usa `npm install` ahi para evitar borrar `node_modules` dentro de OneDrive.
