export type IdentificationType = "id" | "document";

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
  sesiones: number;
  departamento: string;
}

export interface AppliedFilters {
  numeroDocumentoDocente: string;
  idProfesor: string;
  cicloLectivo: string;
  cicloLectivoInicio: string;
  cicloLectivoFinal: string;
  nombreCurso: string | string[];
  componente: string | string[];
  visualizarComponente: boolean;
}

export interface ReportResponse {
  profesor: string;
  filtrosAplicados: AppliedFilters;
  tabla: ReportTableRow[];
  mensaje: string;
  baseDatos: DatasetMetadata | null;
}

export interface ReportRequest {
  numeroDocumentoDocente: string;
  idProfesor: string;
  cicloLectivoInicio: string;
  cicloLectivoFinal: string;
  nombreCurso: string[];
  componente: string[];
  visualizarComponente: boolean;
}

export interface FilterParams {
  numeroDocumentoDocente?: string;
  idProfesor?: string;
  cicloLectivoInicio?: string;
  cicloLectivoFinal?: string;
  nombreCurso?: string | string[];
}

export interface ApiErrorDetail {
  code?: string;
  message?: string;
  sugerencia?: string;
}
