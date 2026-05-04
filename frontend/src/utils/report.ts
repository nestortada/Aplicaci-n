import type { ReportMetricRow, ReportResponse, ReportTableRow } from "../types";

export const SESSION_WEEKS_MULTIPLIER = 16;

export function multiplyReportSessions(report: ReportResponse): ReportResponse {
  return {
    ...report,
    tabla: report.tabla.map(multiplyTableRowSessions),
    metricas: report.metricas?.map(multiplyMetricRowSessions),
  };
}

function multiplyTableRowSessions(row: ReportTableRow): ReportTableRow {
  return { ...row, sesiones: multiplySessions(row.sesiones) };
}

function multiplyMetricRowSessions(row: ReportMetricRow): ReportMetricRow {
  return { ...row, sesiones: multiplySessions(row.sesiones) };
}

function multiplySessions(value: number): number {
  return roundSessionValue(Number(value || 0) * SESSION_WEEKS_MULTIPLIER);
}

function roundSessionValue(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? rounded : Number(rounded.toFixed(2));
}
