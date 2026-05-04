import type { ReportResponse } from "../types";
import { CopyButton } from "./CopyButton";
import { ResultTable } from "./ResultTable";

interface CertificatePreviewProps {
  result: ReportResponse | null;
  isLoading: boolean;
  error: string;
  onCopyTable: () => Promise<void>;
  onCopyMessage: () => Promise<void>;
  onSendEmail: () => void | Promise<void>;
  onCopied: (message: string) => void;
  onCopyError: (message: string) => void;
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
  showSendEmail,
  isSendingEmail,
}: CertificatePreviewProps) {
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
        <span className="document-kicker">Document Preview</span>
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
                <CopyButton
                  label="Copiar tabla"
                  copiedLabel="Tabla copiada"
                  tooltip="Copiar solo la tabla"
                  onCopy={onCopyTable}
                  onCopied={onCopied}
                  onError={onCopyError}
                />
              </div>
              <ResultTable rows={result.tabla} />
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
    </section>
  );
}
