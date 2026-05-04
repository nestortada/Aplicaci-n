import { useEffect, useRef, useState } from "react";
import type { ReportResponse } from "../types";
import { buildMessageHtml, buildTableHtml } from "../utils/format";

type ExportFormat = "pdf" | "word" | "excel";

interface ExportButtonProps {
  report: ReportResponse | null;
  onError: (message: string) => void;
}

const exportOptions: Array<{ format: ExportFormat; label: string; icon: string; tone: string }> = [
  { format: "pdf", label: "PDF", icon: "picture_as_pdf", tone: "pdf" },
  { format: "word", label: "Word", icon: "description", tone: "word" },
  { format: "excel", label: "Excel", icon: "table_view", tone: "excel" },
];

export function ExportButton({ report, onError }: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const canExport = Boolean(report?.tabla.length);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  function handleExport(format: ExportFormat) {
    if (!report) {
      onError("Primero genera un resultado para exportar.");
      return;
    }

    setIsOpen(false);
    const fileBaseName = sanitizeFileName(`certificado-${report.profesor}`);

    if (format === "pdf") {
      exportPdf(report, onError);
      return;
    }

    if (format === "word") {
      downloadBlob(buildDocumentHtml(report), `${fileBaseName}.doc`, "application/msword;charset=utf-8");
      return;
    }

    downloadBlob(buildExcelHtml(report), `${fileBaseName}.xls`, "application/vnd.ms-excel;charset=utf-8");
  }

  return (
    <div className="export-menu" ref={containerRef}>
      <button
        className="export-trigger"
        type="button"
        disabled={!canExport}
        aria-label="Exportar mensaje con tabla"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          download
        </span>
        <span>Exportar</span>
        <span className="material-symbols-outlined export-trigger__chevron" aria-hidden="true">
          expand_more
        </span>
      </button>

      {isOpen ? (
        <div className="export-menu__list" role="menu" aria-label="Opciones de exportación">
          {exportOptions.map((option) => (
            <button
              className={`export-option export-option--${option.tone}`}
              key={option.format}
              type="button"
              role="menuitem"
              onClick={() => handleExport(option.format)}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                {option.icon}
              </span>
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function exportPdf(report: ReportResponse, onError: (message: string) => void) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    onError("No fue posible abrir la ventana de impresión para PDF.");
    return;
  }

  printWindow.document.write(buildPrintableHtml(report));
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => printWindow.print(), 250);
}

function downloadBlob(content: string, fileName: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildPrintableHtml(report: ReportResponse): string {
  return buildHtmlDocument("Certificado sesiones", buildMessageHtml(report), "window-print");
}

function buildDocumentHtml(report: ReportResponse): string {
  return buildHtmlDocument("Certificado sesiones", buildMessageHtml(report), "word-export");
}

function buildExcelHtml(report: ReportResponse): string {
  const intro = `<p>Buen dia, cordial saludo,</p><p>Apreciad@s, envio la informacion encontrada del profesor <strong>${escapeHtml(
    report.profesor,
  )}</strong>.</p>`;
  return buildHtmlDocument("Certificado sesiones", `${intro}${buildTableHtml(report.tabla)}`, "excel-export");
}

function buildHtmlDocument(title: string, body: string, mode: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;margin:32px}body.window-print{margin:24px}p{font-size:13px;line-height:1.5}table{page-break-inside:auto}tr{page-break-inside:avoid;page-break-after:auto}@media print{body{margin:18mm}}</style></head><body class="${mode}">${body}</body></html>`;
}

function sanitizeFileName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
