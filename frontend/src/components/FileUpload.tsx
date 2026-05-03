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

  function openFilePicker() {
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
          }`}
          role="button"
          tabIndex={0}
          onClick={openFilePicker}
          onKeyDown={(event) => {
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
            onChange={handleInputChange}
            data-testid="file-input"
          />
          <span className="material-symbols-outlined upload-zone__icon" aria-hidden="true">
            {status === "uploading" ? "progress_activity" : activeDatabase ? "database" : "upload_file"}
          </span>
          <div className="upload-zone__text">
            <strong>{activeDatabase ? database?.archivo : "Subir archivo .xlsx o .csv"}</strong>
            <span>
              {status === "uploading"
                ? "Cargando base..."
                : activeDatabase
                  ? `${database?.filasCargadas ?? 0} filas cargadas`
                  : "Click o arrastra el archivo aquí"}
            </span>
          </div>
        </div>
        <IconButton icon="delete" label="Borrar base de datos" tone="danger" onClick={onDeleteDatabase} />
      </div>
      {error ? <p className="field-message field-message--error">{error}</p> : null}
      {status === "success" && activeDatabase ? (
        <p className="field-message field-message--success">Base cargada correctamente.</p>
      ) : null}
    </div>
  );
}
