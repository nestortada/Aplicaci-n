import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { CertificatePreview } from "./components/CertificatePreview";
import { ControlPanel } from "./components/ControlPanel";
import {
  deleteDatabase,
  generateReporte,
  getCiclos,
  getComponentes,
  getCurrentDatabase,
  getDepartamentos,
  getMaterias,
  getProfesores,
  getRuntime,
  openOutlookDraft,
  uploadDatabase,
} from "./services/api";
import type {
  DatasetMetadata,
  FilterOption,
  FilterParams,
  IdentificationType,
  ReportResponse,
  ReportTableRow,
  RuntimeEnvironment,
} from "./types";
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
const EMAIL_TO = "solicitud.certifica@unisabana.edu.co";
const EMAIL_CC = ["dianarc@unisabana.edu.co", "alvarorodu@unisabana.edu.co"];

export default function App() {
  const [database, setDatabase] = useState<DatasetMetadata | null>(null);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [uploadError, setUploadError] = useState("");
  const [identificationType, setIdentificationType] = useState<IdentificationType>("professorName");
  const [identification, setIdentification] = useState("");
  const [cicloInicio, setCicloInicio] = useState("");
  const [cicloFin, setCicloFin] = useState("");
  const [materia, setMateria] = useState<string[]>([ALL_OPTION.valor]);
  const [componente, setComponente] = useState<string[]>([ALL_OPTION.valor]);
  const [departamento, setDepartamento] = useState<string[]>([ALL_OPTION.valor]);
  const [visualizarComponente, setVisualizarComponente] = useState(false);
  const [ciclos, setCiclos] = useState<FilterOption[]>([]);
  const [materias, setMaterias] = useState<FilterOption[]>([ALL_OPTION]);
  const [componentes, setComponentes] = useState<FilterOption[]>([ALL_OPTION]);
  const [departamentos, setDepartamentos] = useState<FilterOption[]>([ALL_OPTION]);
  const [profesores, setProfesores] = useState<FilterOption[]>([]);
  const [selectedProfessor, setSelectedProfessor] = useState("");
  const [showProfessorDropdown, setShowProfessorDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [result, setResult] = useState<ReportResponse | null>(null);
  const [orderedTableRows, setOrderedTableRows] = useState<ReportTableRow[]>([]);
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState("");
  const [runtime, setRuntime] = useState<RuntimeEnvironment | "loading">("loading");
  const [controlPanelWidth, setControlPanelWidth] = useState(() => {
    const savedWidth = Number(window.localStorage.getItem("sabana-control-panel-width"));
    return Number.isFinite(savedWidth) && savedWidth >= 28 && savedWidth <= 48 ? savedWidth : 31;
  });
  const [isResizing, setIsResizing] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const activeDatabase = Boolean(database?.activa);
  const showInstallerDownload = runtime !== "loading" && runtime !== "desktop";
  const showSendEmail = runtime === "local" || runtime === "desktop";
  const ciclosInicio = useMemo(() => [EMPTY_CYCLE_OPTION, ...ciclos], [ciclos]);
  const materiaKey = materia.join("\u001f");
  const componenteKey = componente.join("\u001f");
  const outputReport = useMemo(() => {
    if (!result) {
      return null;
    }
    return { ...result, tabla: orderedTableRows.length > 0 ? orderedTableRows : result.tabla };
  }, [orderedTableRows, result]);

  const ciclosFin = useMemo(() => {
    if (!cicloInicio) {
      return [EMPTY_CYCLE_OPTION, ...ciclos];
    }
    return [EMPTY_CYCLE_OPTION, ...ciclos.filter((option) => !isCycleBefore(option.valor, cicloInicio))];
  }, [cicloInicio, ciclos]);

  useEffect(() => {
    let isMounted = true;

    getRuntime()
      .then((metadata) => {
        if (isMounted) {
          setRuntime(metadata.runtime);
        }
      })
      .catch(() => {
        if (isMounted) {
          setRuntime(inferRuntimeFromLocation());
        }
      });

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
      setControlPanelWidth(clamp(nextWidth, 28, 48));
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
    if (!activeDatabase || !selectedProfessor.trim()) {
      setMaterias([ALL_OPTION]);
      setMateria([ALL_OPTION.valor]);
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
        setMateria((current) => keepAvailableSelections(nextOptions, current));
      })
      .catch((error) => {
        if (isCurrent) {
          setFormError(error instanceof Error ? error.message : "No fue posible cargar las materias.");
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [activeDatabase, selectedProfessor, identificationType, cicloInicio, cicloFin]);

  useEffect(() => {
    if (!activeDatabase || !selectedProfessor.trim()) {
      setComponentes([ALL_OPTION]);
      setComponente([ALL_OPTION.valor]);
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
        setComponente((current) => keepAvailableSelections(nextOptions, current));
      })
      .catch((error) => {
        if (isCurrent) {
          setFormError(error instanceof Error ? error.message : "No fue posible cargar los componentes.");
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [activeDatabase, selectedProfessor, identificationType, cicloInicio, cicloFin, materiaKey]);

  useEffect(() => {
    if (!activeDatabase || !selectedProfessor.trim()) {
      setDepartamentos([ALL_OPTION]);
      setDepartamento([ALL_OPTION.valor]);
      return;
    }

    let isCurrent = true;
    getDepartamentos({ ...buildFilterParams(), nombreCurso: materia, componente })
      .then((response) => {
        if (!isCurrent) {
          return;
        }
        const nextOptions = withTodos(response.opciones);
        setDepartamentos(nextOptions);
        setDepartamento((current) => keepAvailableSelections(nextOptions, current));
      })
      .catch((error) => {
        if (isCurrent) {
          setFormError(error instanceof Error ? error.message : "No fue posible cargar los departamentos.");
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [activeDatabase, selectedProfessor, identificationType, cicloInicio, cicloFin, materiaKey, componenteKey]);

  const handleCopyTable = useCallback(async () => {
    if (!outputReport) {
      return;
    }
    await copyRichText({
      text: buildTableText(outputReport.tabla),
      html: buildTableHtml(outputReport.tabla),
    });
  }, [outputReport]);

  const handleCopyMessage = useCallback(async () => {
    if (!outputReport) {
      return;
    }
    await copyRichText({
      text: buildMessageText(outputReport),
      html: buildMessageHtml(outputReport),
    });
  }, [outputReport]);

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
      setOrderedTableRows([]);
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
    setOrderedTableRows([]);
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
      setOrderedTableRows([]);
      showToast("Base y filtros limpiados");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "No fue posible borrar la base de datos.");
    }
  }

  async function handleSearch() {
    setFormError("");
    setUploadError("");

    const cleanIdentification = identificationType === "document" 
      ? identification.trim() 
      : selectedProfessor;
    
    if (!activeDatabase) {
      setFormError("Primero carga una base de datos.");
      setResult(null);
      setOrderedTableRows([]);
      return;
    }
    if (!cleanIdentification) {
      setFormError("Ingresa una identificación para consultar.");
      setResult(null);
      setOrderedTableRows([]);
      return;
    }
    setIsSearching(true);
    setResult(null);
    setOrderedTableRows([]);
    try {
      const report = await generateReporte({
        numeroDocumentoDocente: identificationType === "document" ? cleanIdentification : "",
        idProfesor: "",
        nombreProfesor: identificationType === "professorName" ? cleanIdentification : "",
        cicloLectivoInicio: cicloInicio,
        cicloLectivoFinal: cicloFin,
        nombreCurso: materia,
        componente,
        departamento,
        visualizarComponente,
      });
      setResult(report);
      setOrderedTableRows(report.tabla);
    } catch (error) {
      setResult(null);
      setOrderedTableRows([]);
      setFormError(error instanceof Error ? error.message : "No se encontraron datos para la búsqueda.");
    } finally {
      setIsSearching(false);
    }
  }

  function resetFilters() {
    setIdentification("");
    setSelectedProfessor("");
    setShowProfessorDropdown(false);
    setCicloInicio("");
    setCicloFin("");
    setMateria([ALL_OPTION.valor]);
    setComponente([ALL_OPTION.valor]);
    setDepartamento([ALL_OPTION.valor]);
    setMaterias([ALL_OPTION]);
    setComponentes([ALL_OPTION]);
    setDepartamentos([ALL_OPTION]);
    setProfesores([]);
    setVisualizarComponente(false);
  }

  function buildFilterParams(): FilterParams {
    const cleanIdentification = identificationType === "document" 
      ? identification.trim() 
      : selectedProfessor;
    
    return {
      numeroDocumentoDocente: identificationType === "document" ? cleanIdentification : "",
      idProfesor: "",
      nombreProfesor: identificationType === "professorName" ? cleanIdentification : "",
      cicloLectivoInicio: cicloInicio,
      cicloLectivoFinal: cicloFin,
    };
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }

  async function handleVerifyProfessor() {
    const cleanIdentification = identification.trim();
    
    if (!activeDatabase) {
      setFormError("Primero carga una base de datos.");
      setProfesores([]);
      return;
    }

    if (!cleanIdentification) {
      setFormError("Ingresa un nombre de profesor.");
      setProfesores([]);
      return;
    }

    setFormError("");
    try {
      const response = await getProfesores(cleanIdentification);
      setProfesores(response.opciones);
      setShowProfessorDropdown(true);
      if (response.opciones.length === 0) {
        setFormError("No se encontraron nombres similares.");
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "No fue posible buscar nombres.");
      setProfesores([]);
      setShowProfessorDropdown(false);
    }
  }

  function handleSelectProfessor(professorName: string) {
    setSelectedProfessor(professorName);
    setIdentification(professorName);
    setShowProfessorDropdown(false);
    setFormError("");
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

  async function handleSendEmail() {
    if (!outputReport || isSendingEmail) {
      return;
    }

    const subject = `Solicitud Información - ${outputReport.profesor}`;
    const bodyText = buildMessageText(outputReport);
    setIsSendingEmail(true);
    try {
      await openOutlookDraft({
        to: EMAIL_TO,
        cc: EMAIL_CC,
        subject,
        bodyHtml: buildMessageHtml(outputReport),
        bodyText,
      });
      showToast("Borrador abierto en Outlook");
    } catch (error) {
      window.open(buildMailtoUrl(EMAIL_TO, EMAIL_CC, subject, bodyText), "_self");
      showToast(
        error instanceof Error ? "Outlook directo no disponible; se abrió correo sin formato." : "Abriendo Outlook...",
      );
    } finally {
      setIsSendingEmail(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Sabana Certificado</h1>
        {showInstallerDownload ? (
          <a
            className="installer-download"
            href={INSTALLER_URL}
            download="SabanaCertificado.exe"
            onClick={handleInstallerDownload}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              download
            </span>
            Descargar Aplicación
          </a>
        ) : null}
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
            departamento={departamento}
            visualizarComponente={visualizarComponente}
            ciclosInicio={ciclosInicio}
            ciclosFin={ciclosFin}
            materias={materias}
            componentes={componentes}
            departamentos={departamentos}
            profesores={profesores}
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
            onDepartamentoChange={setDepartamento}
            onVisualizarComponenteChange={setVisualizarComponente}
            onSearch={handleSearch}
            onClearAll={handleClearAll}
            onVerifyProfessor={handleVerifyProfessor}
            onSelectProfessor={handleSelectProfessor}
            showProfessorDropdown={showProfessorDropdown}
          />

          <button
            className="panel-resizer"
            type="button"
            aria-label="Ajustar ancho de paneles"
            aria-orientation="vertical"
            aria-valuemin={28}
            aria-valuemax={48}
            aria-valuenow={Math.round(controlPanelWidth)}
            role="separator"
            onPointerDown={(event) => {
              event.preventDefault();
              setIsResizing(true);
            }}
            onDoubleClick={() => setControlPanelWidth(31)}
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
            onSendEmail={handleSendEmail}
            onCopied={showToast}
            onCopyError={setFormError}
            onTableRowsChange={setOrderedTableRows}
            exportReport={outputReport}
            showSendEmail={showSendEmail}
            isSendingEmail={isSendingEmail}
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

function keepAvailableSelections(options: FilterOption[], values: string[]): string[] {
  if (values.includes(ALL_OPTION.valor)) {
    return [ALL_OPTION.valor];
  }
  const availableValues = new Set(options.map((option) => option.valor));
  const nextValues = values.filter((value) => availableValues.has(value));
  return nextValues.length > 0 ? nextValues : [ALL_OPTION.valor];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function inferRuntimeFromLocation(): RuntimeEnvironment {
  const hostname = window.location.hostname.toLowerCase();
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "local";
  }
  return "cloud";
}

function buildMailtoUrl(to: string, cc: string[], subject: string, body: string): string {
  return `mailto:${to}?cc=${encodeMailtoValue(cc.join(","))}&subject=${encodeMailtoValue(subject)}&body=${encodeMailtoValue(body)}`;
}

function encodeMailtoValue(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}
