import { useState } from "react";
import type { ReportResponse, ReportTableRow } from "../types";
import { CopyButton } from "./CopyButton";
import { ExportButton } from "./ExportButton";
import { ResultPreviewModal } from "./ResultPreviewModal";
import { ResultTable } from "./ResultTable";
import { Tooltip } from "./Tooltip";

interface CertificatePreviewProps {
  result: ReportResponse | null;
  isLoading: boolean;
  error: string;
  onCopyTable: () => Promise<void>;
  onCopyMessage: () => Promise<void>;
  onSendEmail: () => void | Promise<void>;
  onCopied: (message: string) => void;
  onCopyError: (message: string) => void;
  onTableRowsChange?: (rows: ReportTableRow[]) => void;
  exportReport?: ReportResponse | null;
  showSendEmail: boolean;
  isSendingEmail: boolean;
}

export function CertificatePreview({
  result,
  isLoading,
  error,
  onCopyTable,
  onCopyMessage,
  onSendEmail,
  onCopied,
  onCopyError,
  onTableRowsChange,
  exportReport,
  showSendEmail,
  isSendingEmail,
}: CertificatePreviewProps) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const professorName = result?.profesor || "[PROFESOR]";
  const hasRows = Boolean(result?.tabla.length);

  return (
    <section className="result-panel" aria-label="Resultado">
      <div className="result-panel__header">
        <h2 className="section-title">
          <span className="material-symbols-outlined" aria-hidden="true">
            description
          </span>
          Resultado
        </h2>
        <ExportButton report={exportReport || null} onError={onCopyError} />
      </div>

      <article className={`certificate-sheet ${hasRows ? "certificate-sheet--ready" : ""}`}>
        <div className="certificate-heading">
          <h3>CERTIFICADO SESIONES {professorName}</h3>
          <div className="certificate-heading__line" />
        </div>

        {isLoading ? (
          <div className="preview-state">
            <span className="material-symbols-outlined spinning" aria-hidden="true">
              progress_activity
            </span>
            <p>Consultando información del profesor...</p>
          </div>
        ) : error ? (
          <div className="preview-state preview-state--error">
            <span className="material-symbols-outlined" aria-hidden="true">
              error
            </span>
            <p>{error}</p>
          </div>
        ) : hasRows && result ? (
          <>
            <div className="certificate-content">
              <p className="certificate-greeting">
                Buen día, cordial saludo,
                <br />
                <br />
                Apreciad@s, envío la información encontrada del profesor{" "}
                <strong>{result.profesor}</strong>.
              </p>

              <div className="table-actions">
                <Tooltip label="Ver detalles">
                  <button
                    className="copy-button copy-button--subtle copy-button--icon-only"
                    type="button"
                    onClick={() => setIsPreviewOpen(true)}
                    aria-label="Ver detalles"
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">
                      visibility
                    </span>
                  </button>
                </Tooltip>
                <CopyButton
                  label="Copiar tabla"
                  copiedLabel="Tabla copiada"
                  tooltip="Copiar solo la tabla"
                  iconOnly
                  onCopy={onCopyTable}
                  onCopied={onCopied}
                  onError={onCopyError}
                />
              </div>
              <ResultTable rows={result.tabla} onRowsChange={onTableRowsChange} />
            </div>
            <div className="certificate-footer">
              <div />
            </div>
          </>
        ) : (
          <div className="preview-state">
            <span className="material-symbols-outlined" aria-hidden="true">
              contract
            </span>
            <p>El certificado aparecerá aquí cuando ejecutes una búsqueda.</p>
          </div>
        )}
      </article>

      <div className="send-copy-row">
        <CopyButton
          label="Copiar para envío"
          copiedLabel="Copiado"
          variant="floating"
          disabled={!hasRows}
          onCopy={onCopyMessage}
          onCopied={onCopied}
          onError={onCopyError}
        />
        {showSendEmail ? (
          <button
            className={`copy-button copy-button--floating send-email-button ${
              isSendingEmail ? "copy-button--loading" : ""
            }`}
            type="button"
            disabled={!hasRows || isSendingEmail}
            onClick={onSendEmail}
            title="Enviar por Outlook"
            aria-busy={isSendingEmail}
          >
            <span
              className={`material-symbols-outlined ${isSendingEmail ? "spinning" : ""}`}
              aria-hidden="true"
            >
              {isSendingEmail ? "progress_activity" : "send"}
            </span>
            <span>{isSendingEmail ? "Enviando" : "Enviar"}</span>
          </button>
        ) : null}
      </div>
      {isPreviewOpen && result ? <ResultPreviewModal result={result} onClose={() => setIsPreviewOpen(false)} /> : null}
    </section>
  );
}
