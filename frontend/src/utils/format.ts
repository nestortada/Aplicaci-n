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
    ["SEMESTRE", "MATERIA", "SESIONES", "DEPARTAMENTO"].join("\t"),
    ...rows.map((row) => [row.semestre, row.materia, String(row.sesiones), row.departamento].join("\t")),
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
  const header = ["SEMESTRE", "MATERIA", "SESIONES", "DEPARTAMENTO"]
    .map((column) => `<th>${escapeHtml(column)}</th>`)
    .join("");
  const body = rows
    .map(
      (row) =>
        `<tr><td>${escapeHtml(row.semestre)}</td><td>${escapeHtml(row.materia)}</td><td>${escapeHtml(
          String(row.sesiones),
        )}</td><td>${escapeHtml(row.departamento)}</td></tr>`,
    )
    .join("");
  return `<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
}

export function buildMessageHtml(report: ReportResponse): string {
  return `<p>Buen día, cordial saludo,</p><p>Apreciad@s, envío la información encontrada del profesor <strong>${escapeHtml(
    report.profesor,
  )}</strong>.</p>${buildTableHtml(report.tabla)}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
