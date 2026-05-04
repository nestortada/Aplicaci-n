import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import type { DatasetMetadata } from "../types";
import { IconButton } from "./IconButton";

interface FileUploadProps {
  database: DatasetMetadata | null;
  status: "idle" | "uploading" | "success" | "error";
  error: string;
  onFileSelected: (file: File) => void;
  onDeleteDatabase: () => void;
}

export function FileUpload({ database, status, error, onFileSelected, onDeleteDatabase }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const activeDatabase = Boolean(database?.activa);
  const isUploading = status === "uploading";

  function openFilePicker() {
    if (isUploading) {
      return;
    }
    inputRef.current?.click();
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      onFileSelected(file);
    }
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (isUploading) {
      return;
    }
    const file = event.dataTransfer.files?.[0];
    if (file) {
      onFileSelected(file);
    }
  }

  return (
    <div className="field-stack">
      <label className="field-label">BD</label>
      <div className="upload-row">
        <div
          className={`upload-zone ${activeDatabase ? "upload-zone--loaded" : ""} ${
            isDragging ? "upload-zone--dragging" : ""
          } ${isUploading ? "upload-zone--uploading" : ""}`}
          role="button"
          tabIndex={isUploading ? -1 : 0}
          aria-busy={isUploading}
          aria-disabled={isUploading}
          onClick={openFilePicker}
          onKeyDown={(event) => {
            if (isUploading) {
              return;
            }
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openFilePicker();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          data-testid="upload-zone"
        >
          <input
            ref={inputRef}
            className="visually-hidden"
            type="file"
            accept=".xlsx,.csv"
            disabled={isUploading}
            onChange={handleInputChange}
            data-testid="file-input"
          />
          <span
            className={`material-symbols-outlined upload-zone__icon ${isUploading ? "spinning" : ""}`}
            aria-hidden="true"
          >
            {isUploading ? "progress_activity" : activeDatabase ? "database" : "upload_file"}
          </span>
          <div className="upload-zone__text">
            <strong>
              {isUploading
                ? "Cargando base de datos"
                : activeDatabase
                  ? database?.archivo
                  : "Subir archivo .xlsx o .csv"}
            </strong>
            <span>
              {isUploading
                ? "Leyendo y guardando filas..."
                : activeDatabase
                  ? `${database?.filasCargadas ?? 0} filas cargadas`
                  : "Click o arrastra el archivo aquí"}
            </span>
          </div>
          {isUploading ? <span className="upload-zone__progress" aria-hidden="true" /> : null}
        </div>
        <IconButton
          icon="delete"
          label="Borrar base de datos"
          tone="danger"
          disabled={isUploading}
          onClick={onDeleteDatabase}
        />
      </div>
      {error ? <p className="field-message field-message--error">{error}</p> : null}
      {status === "success" && activeDatabase ? (
        <p className="field-message field-message--success">Base cargada correctamente.</p>
      ) : null}
    </div>
  );
}
