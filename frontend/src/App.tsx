import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { CertificatePreview } from "./components/CertificatePreview";
import { ControlPanel } from "./components/ControlPanel";
import {
  deleteDatabase,
  generateReporte,
  getCiclos,
  getComponentes,
  getCurrentDatabase,
  getMaterias,
  uploadDatabase,
} from "./services/api";
import type { DatasetMetadata, FilterOption, FilterParams, IdentificationType, ReportResponse } from "./types";
import { copyRichText } from "./utils/clipboard";
import {
  buildMessageHtml,
  buildMessageText,
  buildTableHtml,
  buildTableText,
  isAcceptedDatabaseFile,
  isCycleBefore,
} from "./utils/format";

const ALL_OPTION: FilterOption = { valor: "TODOS", etiqueta: "Todos" };
const EMPTY_CYCLE_OPTION: FilterOption = { valor: "", etiqueta: "Todos los periodos" };
const EMPTY_DATABASE: DatasetMetadata = { activa: false, archivo: "", fechaCarga: "", filasCargadas: 0 };
const INSTALLER_URL = import.meta.env.VITE_INSTALLER_URL || "/downloads/SabanaCertificado.exe";

export default function App() {
  const [database, setDatabase] = useState<DatasetMetadata | null>(null);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [uploadError, setUploadError] = useState("");
  const [identificationType, setIdentificationType] = useState<IdentificationType>("id");
  const [identification, setIdentification] = useState("");
  const [cicloInicio, setCicloInicio] = useState("");
  const [cicloFin, setCicloFin] = useState("");
  const [materia, setMateria] = useState(ALL_OPTION.valor);
  const [componente, setComponente] = useState(ALL_OPTION.valor);
  const [visualizarComponente, setVisualizarComponente] = useState(false);
  const [ciclos, setCiclos] = useState<FilterOption[]>([]);
  const [materias, setMaterias] = useState<FilterOption[]>([ALL_OPTION]);
  const [componentes, setComponentes] = useState<FilterOption[]>([ALL_OPTION]);
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<ReportResponse | null>(null);
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState("");
  const [controlPanelWidth, setControlPanelWidth] = useState(() => {
    const savedWidth = Number(window.localStorage.getItem("sabana-control-panel-width"));
    return Number.isFinite(savedWidth) && savedWidth >= 26 && savedWidth <= 55 ? savedWidth : 33;
  });
  const [isResizing, setIsResizing] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const activeDatabase = Boolean(database?.activa);
  const ciclosInicio = useMemo(() => [EMPTY_CYCLE_OPTION, ...ciclos], [ciclos]);

  const ciclosFin = useMemo(() => {
    if (!cicloInicio) {
      return [EMPTY_CYCLE_OPTION, ...ciclos];
    }
    return [EMPTY_CYCLE_OPTION, ...ciclos.filter((option) => !isCycleBefore(option.valor, cicloInicio))];
  }, [cicloInicio, ciclos]);

  useEffect(() => {
    let isMounted = true;

    getCurrentDatabase()
      .then((metadata) => {
        if (!isMounted) {
          return;
        }
        setDatabase(metadata);
        setUploadStatus(metadata.activa ? "success" : "idle");
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }
        setDatabase(EMPTY_DATABASE);
        setUploadStatus("error");
        setUploadError(error instanceof Error ? error.message : "No fue posible consultar la base actual.");
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!activeDatabase) {
      setCiclos([]);
      return;
    }

    let isCurrent = true;
    getCiclos()
      .then((response) => {
        if (isCurrent) {
          setCiclos(response.opciones);
        }
      })
      .catch((error) => {
        if (isCurrent) {
          setFormError(error instanceof Error ? error.message : "No fue posible cargar los ciclos lectivos.");
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [activeDatabase, database?.archivo]);

  useEffect(() => {
    if (cicloFin && cicloInicio && isCycleBefore(cicloFin, cicloInicio)) {
      setCicloFin("");
    }
  }, [cicloFin, cicloInicio]);

  useEffect(() => {
    if (!isResizing) {
      return;
    }

    function handlePointerMove(event: PointerEvent) {
      const grid = gridRef.current;
      if (!grid) {
        return;
      }
      const rect = grid.getBoundingClientRect();
      const nextWidth = ((event.clientX - rect.left) / rect.width) * 100;
      setControlPanelWidth(clamp(nextWidth, 26, 55));
    }

    function handlePointerUp() {
      setIsResizing(false);
    }

    document.body.classList.add("is-resizing-panels");
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      document.body.classList.remove("is-resizing-panels");
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isResizing]);

  useEffect(() => {
    window.localStorage.setItem("sabana-control-panel-width", String(Math.round(controlPanelWidth * 10) / 10));
  }, [controlPanelWidth]);

  useEffect(() => {
    if (!activeDatabase || !identification.trim()) {
      setMaterias([ALL_OPTION]);
      setMateria(ALL_OPTION.valor);
      return;
    }

    let isCurrent = true;
    getMaterias(buildFilterParams())
      .then((response) => {
        if (!isCurrent) {
          return;
        }
        const nextOptions = withTodos(response.opciones);
        setMaterias(nextOptions);
        setMateria((current) => (hasOption(nextOptions, current) ? current : ALL_OPTION.valor));
      })
      .catch((error) => {
        if (isCurrent) {
          setFormError(error instanceof Error ? error.message : "No fue posible cargar las materias.");
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [activeDatabase, identification, identificationType, cicloInicio, cicloFin]);

  useEffect(() => {
    if (!activeDatabase || !identification.trim()) {
      setComponentes([ALL_OPTION]);
      setComponente(ALL_OPTION.valor);
      return;
    }

    let isCurrent = true;
    getComponentes({ ...buildFilterParams(), nombreCurso: materia })
      .then((response) => {
        if (!isCurrent) {
          return;
        }
        const nextOptions = withTodos(response.opciones);
        setComponentes(nextOptions);
        setComponente((current) => (hasOption(nextOptions, current) ? current : ALL_OPTION.valor));
      })
      .catch((error) => {
        if (isCurrent) {
          setFormError(error instanceof Error ? error.message : "No fue posible cargar los componentes.");
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [activeDatabase, identification, identificationType, cicloInicio, cicloFin, materia]);

  const handleCopyTable = useCallback(async () => {
    if (!result) {
      return;
    }
    await copyRichText({
      text: buildTableText(result.tabla),
      html: buildTableHtml(result.tabla),
    });
  }, [result]);

  const handleCopyMessage = useCallback(async () => {
    if (!result) {
      return;
    }
    await copyRichText({
      text: buildMessageText(result),
      html: buildMessageHtml(result),
    });
  }, [result]);

  async function handleFileSelected(file: File) {
    setUploadError("");
    setFormError("");

    if (!isAcceptedDatabaseFile(file)) {
      setUploadStatus("error");
      setUploadError("Formato no válido. Sube un archivo .xlsx o .csv.");
      return;
    }

    setUploadStatus("uploading");
    try {
      const response = await uploadDatabase(file);
      setDatabase(response.baseDatos);
      setUploadStatus("success");
      resetFilters();
      setResult(null);
      const filterResponse = await getCiclos();
      setCiclos(filterResponse.opciones);
    } catch (error) {
      setUploadStatus("error");
      setUploadError(error instanceof Error ? error.message : "No fue posible cargar el archivo.");
    }
  }

  async function handleDeleteDatabase() {
    if (activeDatabase && !window.confirm("¿Seguro que deseas borrar la base de datos cargada?")) {
      return;
    }
    await clearDatabaseAndUi();
  }

  async function handleClearAll() {
    setFormError("");
    setUploadError("");
    resetFilters();
    setResult(null);
    showToast("Parámetros limpiados");
  }

  async function clearDatabaseAndUi() {
    setFormError("");
    setUploadError("");
    try {
      if (activeDatabase) {
        const metadata = await deleteDatabase();
        setDatabase(metadata);
      } else {
        setDatabase(EMPTY_DATABASE);
      }
      setUploadStatus("idle");
      setCiclos([]);
      resetFilters();
      setResult(null);
      showToast("Base y filtros limpiados");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "No fue posible borrar la base de datos.");
    }
  }

  async function handleSearch() {
    setFormError("");
    setUploadError("");

    const cleanIdentification = identification.trim();
    if (!activeDatabase) {
      setFormError("Primero carga una base de datos.");
      setResult(null);
      return;
    }
    if (!cleanIdentification) {
      setFormError("Ingresa una identificación para consultar.");
      setResult(null);
      return;
    }
    setIsSearching(true);
    setResult(null);
    try {
      const report = await generateReporte({
        numeroDocumentoDocente: identificationType === "document" ? cleanIdentification : "",
        idProfesor: identificationType === "id" ? cleanIdentification : "",
        cicloLectivoInicio: cicloInicio,
        cicloLectivoFinal: cicloFin,
        nombreCurso: materia,
        componente,
        visualizarComponente,
      });
      setResult(report);
    } catch (error) {
      setResult(null);
      setFormError(error instanceof Error ? error.message : "No se encontraron datos para la búsqueda.");
    } finally {
      setIsSearching(false);
    }
  }

  function resetFilters() {
    setIdentification("");
    setCicloInicio("");
    setCicloFin("");
    setMateria(ALL_OPTION.valor);
    setComponente(ALL_OPTION.valor);
    setMaterias([ALL_OPTION]);
    setComponentes([ALL_OPTION]);
    setVisualizarComponente(false);
  }

  function buildFilterParams(): FilterParams {
    const cleanIdentification = identification.trim();
    return {
      numeroDocumentoDocente: identificationType === "document" ? cleanIdentification : "",
      idProfesor: identificationType === "id" ? cleanIdentification : "",
      cicloLectivoInicio: cicloInicio,
      cicloLectivoFinal: cicloFin,
    };
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }

  async function handleInstallerDownload(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();

    const download = () => {
      const link = document.createElement("a");
      link.href = INSTALLER_URL;
      link.download = "SabanaCertificado.exe";
      document.body.appendChild(link);
      link.click();
      link.remove();
    };

    try {
      const response = await fetch(INSTALLER_URL, { method: "HEAD", cache: "no-store" });
      if (response.ok) {
        download();
        return;
      }
    } catch {
      // If the installer is hosted elsewhere and HEAD is blocked, let the browser try the download.
      if (new URL(INSTALLER_URL, window.location.href).origin !== window.location.origin) {
        download();
        return;
      }
    }

    showToast("El instalador aún no está disponible. Genera el .exe primero.");
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Sabana Certificado</h1>
        <a className="installer-download" href={INSTALLER_URL} download="SabanaCertificado.exe" onClick={handleInstallerDownload}>
          <span className="material-symbols-outlined" aria-hidden="true">
            download
          </span>
          Descargar .exe
        </a>
      </header>

      <main className="app-main">
        <div
          ref={gridRef}
          className={`app-grid ${isResizing ? "app-grid--resizing" : ""}`}
          style={{ "--control-panel-width": `${controlPanelWidth}%` } as CSSProperties}
        >
          <ControlPanel
            database={database}
            uploadStatus={uploadStatus}
            uploadError={uploadError}
            identificationType={identificationType}
            identification={identification}
            cicloInicio={cicloInicio}
            cicloFin={cicloFin}
            materia={materia}
            componente={componente}
            visualizarComponente={visualizarComponente}
            ciclosInicio={ciclosInicio}
            ciclosFin={ciclosFin}
            materias={materias}
            componentes={componentes}
            isSearching={isSearching}
            formError={formError}
            onFileSelected={handleFileSelected}
            onDeleteDatabase={handleDeleteDatabase}
            onIdentificationTypeChange={setIdentificationType}
            onIdentificationChange={setIdentification}
            onCicloInicioChange={setCicloInicio}
            onCicloFinChange={setCicloFin}
            onMateriaChange={setMateria}
            onComponenteChange={setComponente}
            onVisualizarComponenteChange={setVisualizarComponente}
            onSearch={handleSearch}
            onClearAll={handleClearAll}
          />

          <button
            className="panel-resizer"
            type="button"
            aria-label="Ajustar ancho de paneles"
            aria-orientation="vertical"
            aria-valuemin={26}
            aria-valuemax={55}
            aria-valuenow={Math.round(controlPanelWidth)}
            role="separator"
            onPointerDown={(event) => {
              event.preventDefault();
              setIsResizing(true);
            }}
            onDoubleClick={() => setControlPanelWidth(33)}
            title="Arrastra para ajustar los paneles. Doble click para restaurar."
          >
            <span aria-hidden="true" />
          </button>

          <CertificatePreview
            result={result}
            isLoading={isSearching}
            error={formError}
            onCopyTable={handleCopyTable}
            onCopyMessage={handleCopyMessage}
            onCopied={showToast}
            onCopyError={setFormError}
          />
        </div>
      </main>

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}

function withTodos(options: FilterOption[]): FilterOption[] {
  return [ALL_OPTION, ...options.filter((option) => option.valor !== ALL_OPTION.valor)];
}

function hasOption(options: FilterOption[], value: string): boolean {
  return options.some((option) => option.valor === value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
