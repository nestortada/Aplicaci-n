import type {
  DatasetMetadata,
  FilterOptionsResponse,
  FilterParams,
  ReportRequest,
  ReportResponse,
  UploadResponse,
} from "../types";

const defaultApiUrl = window.location.port === "5173" ? "http://127.0.0.1:8000" : window.location.origin;
const API_URL = (import.meta.env.VITE_API_URL || defaultApiUrl).replace(/\/$/, "");
const BROWSER_SESSION_ID =
  crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const SESSION_HEADER = "X-Certisabana-Session";

export async function uploadDatabase(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  return request<UploadResponse>("/api/uploads", {
    method: "POST",
    body: formData,
  });
}

export async function getCurrentDatabase(): Promise<DatasetMetadata> {
  return request<DatasetMetadata>("/api/uploads/estado");
}

export async function deleteDatabase(): Promise<DatasetMetadata> {
  return request<DatasetMetadata>("/api/uploads", { method: "DELETE" });
}

export async function getCiclos(): Promise<FilterOptionsResponse> {
  return request<FilterOptionsResponse>("/api/filtros/ciclos");
}

export async function getMaterias(params: FilterParams): Promise<FilterOptionsResponse> {
  return request<FilterOptionsResponse>(`/api/filtros/materias${toQuery(params)}`);
}

export async function getComponentes(params: FilterParams): Promise<FilterOptionsResponse> {
  return request<FilterOptionsResponse>(`/api/filtros/componentes${toQuery(params)}`);
}

export async function generateReporte(params: ReportRequest): Promise<ReportResponse> {
  return request<ReportResponse>("/api/reportes/sesiones-profesor", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  headers.set(SESSION_HEADER, BROWSER_SESSION_ID);
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    const detail = typeof payload === "object" && payload !== null ? payload.detail : null;
    const message = detail?.message || detail?.code || response.statusText || "No fue posible completar la solicitud.";
    throw new Error(message);
  }

  return payload as T;
}

function toQuery(params: FilterParams): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item) {
          searchParams.append(key, item);
        }
      });
      return;
    }
    if (value) {
      searchParams.set(key, value);
    }
  });
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}
