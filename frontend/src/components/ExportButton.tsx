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
      exportPdf(report, fileBaseName, onError);
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

function exportPdf(report: ReportResponse, fileBaseName: string, onError: (message: string) => void) {
  try {
    downloadBlob(buildPdf(report), `${fileBaseName}.pdf`, "application/pdf");
  } catch {
    onError("No fue posible generar el PDF.");
  }
}

function downloadBlob(content: BlobPart, fileName: string, type: string) {
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

function buildPdf(report: ReportResponse): string {
  const pages = buildPdfPages(report);
  const objects: string[] = [];
  const addObject = (body: string) => {
    objects.push(body);
    return objects.length;
  };

  const catalogRef = addObject("<< /Type /Catalog /Pages 2 0 R >>");
  const pagesRef = addObject("");
  const fontRef = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const boldFontRef = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const pageRefs: number[] = [];

  pages.forEach((page) => {
    const stream = page.join("\n");
    const contentRef = addObject(`<< /Length ${byteLength(stream)} >>\nstream\n${stream}\nendstream`);
    const pageRef = addObject(
      `<< /Type /Page /Parent ${pagesRef} 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 ${fontRef} 0 R /F2 ${boldFontRef} 0 R >> >> /Contents ${contentRef} 0 R >>`,
    );
    pageRefs.push(pageRef);
  });

  objects[pagesRef - 1] = `<< /Type /Pages /Kids [${pageRefs.map((ref) => `${ref} 0 R`).join(" ")}] /Count ${
    pageRefs.length
  } >>`;

  return assemblePdf(objects, catalogRef);
}

function buildPdfPages(report: ReportResponse): string[][] {
  const pages: string[][] = [];
  let commands = createPdfPage(report, 1);
  let y = 708;
  const bottom = 52;
  const rowGap = 0;
  const columns = [
    { label: "SEMESTRE", width: 78, key: "semestre" as const },
    { label: "MATERIA", width: 145, key: "materia" as const },
    { label: "FECHA INICIO", width: 64, key: "fechaInicio" as const },
    { label: "FECHA FINAL", width: 64, key: "fechaFinal" as const },
    { label: "SESIONES", width: 54, key: "sesiones" as const },
    { label: "DEPARTAMENTO", width: 118, key: "departamento" as const },
  ];
  const startX = 36;

  drawTableHeader(commands, columns, startX, y);
  y -= 28;

  report.tabla.forEach((row) => {
    const cells = columns.map((column) => {
      const value = String(row[column.key] ?? "");
      return wrapPdfText(value, Math.max(7, Math.floor(column.width / 5.2)));
    });
    const rowHeight = Math.max(26, Math.max(...cells.map((cell) => cell.length)) * 10 + 10);

    if (y - rowHeight < bottom) {
      drawPageNumber(commands, pages.length + 1);
      pages.push(commands);
      commands = createPdfPage(report, pages.length + 1);
      y = 748;
      drawTableHeader(commands, columns, startX, y);
      y -= 28;
    }

    drawPdfRow(commands, columns, cells, startX, y, rowHeight);
    y -= rowHeight + rowGap;
  });

  drawPageNumber(commands, pages.length + 1);
  pages.push(commands);
  return pages;
}

function createPdfPage(report: ReportResponse, pageNumber: number): string[] {
  const commands: string[] = [
    "0.96 0.98 1 rg 0 0 595.28 841.89 re f",
    "0.05 0.09 0.16 rg",
  ];
  drawText(commands, `CERTIFICADO SESIONES ${report.profesor}`, 36, 800, 13, true);
  drawText(commands, "Buen dia, cordial saludo,", 36, 768, 10);
  drawText(commands, `Apreciad@s, envio la informacion encontrada del profesor ${report.profesor}.`, 36, 748, 10);
  if (pageNumber > 1) {
    drawText(commands, "Continuacion", 478, 748, 9, true);
  }
  return commands;
}

function drawTableHeader(
  commands: string[],
  columns: Array<{ label: string; width: number }>,
  startX: number,
  y: number,
) {
  let x = startX;
  commands.push("0.90 0.95 1 rg");
  commands.push(`${toPdfNumber(startX)} ${toPdfNumber(y - 24)} 523 24 re f`);
  commands.push("0.58 0.64 0.72 RG 0.7 w");
  columns.forEach((column) => {
    commands.push(`${toPdfNumber(x)} ${toPdfNumber(y - 24)} ${toPdfNumber(column.width)} 24 re S`);
    drawText(commands, column.label, x + 4, y - 15, 7.5, true);
    x += column.width;
  });
}

function drawPdfRow(
  commands: string[],
  columns: Array<{ width: number }>,
  cells: string[][],
  startX: number,
  y: number,
  rowHeight: number,
) {
  let x = startX;
  commands.push("1 1 1 rg");
  commands.push("0.80 0.84 0.89 RG 0.5 w");
  columns.forEach((column, index) => {
    commands.push(`${toPdfNumber(x)} ${toPdfNumber(y - rowHeight)} ${toPdfNumber(column.width)} ${toPdfNumber(rowHeight)} re S`);
    cells[index].slice(0, Math.floor((rowHeight - 6) / 10)).forEach((line, lineIndex) => {
      drawText(commands, line, x + 4, y - 13 - lineIndex * 10, 7.3);
    });
    x += column.width;
  });
}

function drawPageNumber(commands: string[], pageNumber: number) {
  drawText(commands, `Pagina ${pageNumber}`, 506, 28, 8);
}

function drawText(commands: string[], text: string, x: number, y: number, size: number, bold = false) {
  commands.push("0.05 0.09 0.16 rg");
  commands.push(`BT /${bold ? "F2" : "F1"} ${toPdfNumber(size)} Tf ${toPdfNumber(x)} ${toPdfNumber(y)} Td ${toPdfString(text)} Tj ET`);
}

function wrapPdfText(value: string, maxChars: number): string[] {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  words.forEach((word) => {
    if (word.length > maxChars) {
      if (current) {
        lines.push(current);
        current = "";
      }
      for (let index = 0; index < word.length; index += maxChars) {
        lines.push(word.slice(index, index + maxChars));
      }
      return;
    }
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars) {
      lines.push(current);
      current = word;
      return;
    }
    current = next;
  });
  if (current) {
    lines.push(current);
  }
  return lines.length > 0 ? lines : [""];
}

function assemblePdf(objects: string[], catalogRef: number): string {
  const parts: string[] = ["%PDF-1.4\n"];
  const offsets: number[] = [0];
  let offset = byteLength(parts[0]);

  objects.forEach((body, index) => {
    offsets.push(offset);
    const objectText = `${index + 1} 0 obj\n${body}\nendobj\n`;
    parts.push(objectText);
    offset += byteLength(objectText);
  });

  const xrefOffset = offset;
  const xrefRows = offsets.map((item, index) =>
    index === 0 ? "0000000000 65535 f " : `${String(item).padStart(10, "0")} 00000 n `,
  );
  parts.push(
    `xref\n0 ${objects.length + 1}\n${xrefRows.join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root ${catalogRef} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
  );

  return parts.join("");
}

function toPdfString(value: string): string {
  const asciiValue = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
  return `(${asciiValue})`;
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function toPdfNumber(value: number): string {
  return Number(value.toFixed(2)).toString();
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
