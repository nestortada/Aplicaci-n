import type { ReportResponse, ReportTableRow } from "../types";

const ALL_VALUE = "TODOS";

export function isAll(value: string): boolean {
  return !value || value === ALL_VALUE;
}

export function isAcceptedDatabaseFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".xlsx") || name.endsWith(".csv");
}

export function parseCycleKey(value: string): [number, number] | null {
  const match = value.match(/(\d{4})\s*[-_]\s*(\d+)/);
  if (!match) {
    return null;
  }
  return [Number(match[1]), Number(match[2])];
}

export function isCycleBefore(left: string, right: string): boolean {
  const leftKey = parseCycleKey(left);
  const rightKey = parseCycleKey(right);
  if (!leftKey || !rightKey) {
    return false;
  }
  return leftKey[0] < rightKey[0] || (leftKey[0] === rightKey[0] && leftKey[1] < rightKey[1]);
}

export function buildTableText(rows: ReportTableRow[]): string {
  return [
    ["SEMESTRE", "MATERIA", "FECHA DE INICIO", "FECHA FINAL", "SESIONES", "DEPARTAMENTO"].join("\t"),
    ...rows.map((row) =>
      [row.semestre, row.materia, row.fechaInicio, row.fechaFinal, String(row.sesiones), row.departamento].join("\t"),
    ),
  ].join("\n");
}

export function buildMessageText(report: ReportResponse): string {
  return [
    "Buen día, cordial saludo,",
    "",
    `Apreciad@s, envío la información encontrada del profesor ${report.profesor}.`,
    "",
    buildTableText(report.tabla),
  ].join("\n");
}

export function buildTableHtml(rows: ReportTableRow[]): string {
  const tableStyle = [
    "border-collapse:collapse",
    "border-spacing:0",
    "width:100%",
    "font-family:Arial,Helvetica,sans-serif",
    "font-size:12px",
    "color:#0f172a",
  ].join(";");
  const headerStyle = [
    "border:1px solid #94a3b8",
    "background-color:#f1f5f9",
    "color:#334155",
    "font-weight:700",
    "text-transform:uppercase",
    "letter-spacing:0",
    "padding:8px 10px",
    "text-align:left",
    "vertical-align:middle",
  ].join(";");
  const cellStyle = [
    "border:1px solid #cbd5e1",
    "padding:8px 10px",
    "text-align:left",
    "vertical-align:top",
    "background-color:#ffffff",
  ].join(";");
  const numberCellStyle = `${cellStyle};text-align:right`;
  const header = ["SEMESTRE", "MATERIA", "FECHA DE INICIO", "FECHA FINAL", "SESIONES", "DEPARTAMENTO"]
    .map((column) => `<th style="${headerStyle}" scope="col">${escapeHtml(column)}</th>`)
    .join("");
  const body = rows
    .map(
      (row) =>
        `<tr><td style="${cellStyle}">${escapeHtml(row.semestre)}</td><td style="${cellStyle}">${escapeHtml(
          row.materia,
        )}</td><td style="${cellStyle}">${escapeHtml(row.fechaInicio)}</td><td style="${cellStyle}">${escapeHtml(
          row.fechaFinal,
        )}</td><td style="${numberCellStyle}">${escapeHtml(String(row.sesiones))}</td><td style="${cellStyle}">${escapeHtml(
          row.departamento,
        )}</td></tr>`,
    )
    .join("");
  return `<table border="1" cellpadding="0" cellspacing="0" style="${tableStyle}"><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
}

export function buildMessageHtml(report: ReportResponse): string {
  const wrapperStyle = "font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#0f172a;line-height:1.5";
  const paragraphStyle = "margin:0 0 12px 0";
  return `<div style="${wrapperStyle}"><p style="${paragraphStyle}">Buen día, cordial saludo,</p><p style="${paragraphStyle}">Apreciad@s, envío la información encontrada del profesor <strong>${escapeHtml(
    report.profesor,
  )}</strong>.</p>${buildTableHtml(report.tabla)}</div>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
