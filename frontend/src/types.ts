export type IdentificationType = "professorName" | "document";
export type RuntimeEnvironment = "local" | "desktop" | "cloud";

export interface RuntimeMetadata {
  runtime: RuntimeEnvironment;
}

export interface OutlookDraftRequest {
  to: string;
  cc: string[];
  subject: string;
  bodyHtml: string;
  bodyText: string;
}

export interface DatasetMetadata {
  activa: boolean;
  archivo: string;
  fechaCarga: string;
  filasCargadas: number;
}

export interface UploadResponse {
  estado: string;
  archivo: string;
  filasCargadas: number;
  columnasDetectadas: string[];
  baseDatos: DatasetMetadata;
}

export interface FilterOption {
  valor: string;
  etiqueta: string;
}

export interface FilterOptionsResponse {
  opciones: FilterOption[];
}

export interface ReportTableRow {
  semestre: string;
  materia: string;
  fechaInicio: string;
  fechaFinal: string;
  sesiones: number;
  componente?: string;
  departamento: string;
}

export interface ReportMetricRow {
  semestre: string;
  materia: string;
  componente: string;
  departamento: string;
  sesiones: number;
}

export interface AppliedFilters {
  numeroDocumentoDocente: string;
  idProfesor: string;
  nombreProfesor: string;
  cicloLectivo: string;
  cicloLectivoInicio: string;
  cicloLectivoFinal: string;
  nombreCurso: string | string[];
  componente: string | string[];
  departamento: string | string[];
  visualizarComponente: boolean;
}

export interface ReportResponse {
  profesor: string;
  filtrosAplicados: AppliedFilters;
  tabla: ReportTableRow[];
  metricas?: ReportMetricRow[];
  mensaje: string;
  baseDatos: DatasetMetadata | null;
}

export interface ReportRequest {
  numeroDocumentoDocente: string;
  idProfesor: string;
  nombreProfesor: string;
  cicloLectivoInicio: string;
  cicloLectivoFinal: string;
  nombreCurso: string[];
  componente: string[];
  departamento: string[];
  visualizarComponente: boolean;
}

export interface FilterParams {
  query?: string;
  numeroDocumentoDocente?: string;
  idProfesor?: string;
  nombreProfesor?: string;
  cicloLectivoInicio?: string;
  cicloLectivoFinal?: string;
  nombreCurso?: string | string[];
  componente?: string | string[];
}

export interface ApiErrorDetail {
  code?: string;
  message?: string;
  sugerencia?: string;
}
