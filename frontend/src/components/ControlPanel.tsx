import { useState, type FormEvent } from "react";
import type { DatasetMetadata, FilterOption, IdentificationType } from "../types";
import { FileUpload } from "./FileUpload";
import { MultiSelectField } from "./MultiSelectField";
import { SelectField } from "./SelectField";

interface ControlPanelProps {
  database: DatasetMetadata | null;
  uploadStatus: "idle" | "uploading" | "success" | "error";
  uploadError: string;
  identificationType: IdentificationType;
  identification: string;
  cicloInicio: string;
  cicloFin: string;
  materia: string[];
  componente: string[];
  departamento: string[];
  visualizarComponente: boolean;
  ciclosInicio: FilterOption[];
  ciclosFin: FilterOption[];
  materias: FilterOption[];
  componentes: FilterOption[];
  departamentos: FilterOption[];
  profesores: FilterOption[];
  isSearching: boolean;
  formError: string;
  showProfessorDropdown: boolean;
  onFileSelected: (file: File) => void;
  onDeleteDatabase: () => void;
  onIdentificationTypeChange: (value: IdentificationType) => void;
  onIdentificationChange: (value: string) => void;
  onCicloInicioChange: (value: string) => void;
  onCicloFinChange: (value: string) => void;
  onMateriaChange: (value: string[]) => void;
  onComponenteChange: (value: string[]) => void;
  onDepartamentoChange: (value: string[]) => void;
  onVisualizarComponenteChange: (value: boolean) => void;
  onSearch: () => void;
  onClearAll: () => void;
  onVerifyProfessor: () => void;
  onSelectProfessor: (professorName: string) => void;
}

export function ControlPanel({
  database,
  uploadStatus,
  uploadError,
  identificationType,
  identification,
  cicloInicio,
  cicloFin,
  materia,
  componente,
  departamento,
  visualizarComponente,
  ciclosInicio,
  ciclosFin,
  materias,
  componentes,
  departamentos,
  profesores,
  isSearching,
  formError,
  onFileSelected,
  onDeleteDatabase,
  onIdentificationTypeChange,
  onIdentificationChange,
  onCicloInicioChange,
  onCicloFinChange,
  onMateriaChange,
  onComponenteChange,
  onDepartamentoChange,
  onVisualizarComponenteChange,
  onSearch,
  onClearAll,
  onVerifyProfessor,
  onSelectProfessor,
  showProfessorDropdown,
}: ControlPanelProps) {
  const identificationPlaceholder =
    identificationType === "professorName" ? "Nombre del profesor..." : "Número...";
  const shouldShowProfessorSuggestions =
    identificationType === "professorName" && showProfessorDropdown && profesores.length > 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSearch();
  }

  return (
    <section className="control-panel" aria-label="Panel de Control">
      <div className="trust-bar" />
      <h2 className="section-title">
        <span className="material-symbols-outlined" aria-hidden="true">
          settings_input_component
        </span>
        Panel de Control
      </h2>

      <form className="control-form" onSubmit={handleSubmit}>
        <FileUpload
          database={database}
          status={uploadStatus}
          error={uploadError}
          onFileSelected={onFileSelected}
          onDeleteDatabase={onDeleteDatabase}
        />

        <div className="field-stack">
          <label className="field-label" htmlFor="identification-value">
            Identificación
          </label>
          <div className="identification-row">
            <select
              className={`field-control identification-type ${
                identificationType === "document" ? "identification-type--document" : ""
              }`}
              aria-label="Tipo de identificación"
              value={identificationType}
              onChange={(event) => onIdentificationTypeChange(event.target.value as IdentificationType)}
            >
              <option value="professorName">Nombre del Profesor</option>
              <option value="document">Número de documento</option>
            </select>
            <div className="professor-search">
              <input
                id="identification-value"
                className="field-control"
                placeholder={identificationPlaceholder}
                value={identification}
                aria-controls="professor-suggestions"
                aria-expanded={shouldShowProfessorSuggestions}
                autoComplete="off"
                onChange={(event) => onIdentificationChange(event.target.value)}
              />
              {identificationType === "professorName" ? (
                <button
                  type="button"
                  className="professor-verify-button"
                  title="Verificar nombre del profesor"
                  onClick={onVerifyProfessor}
                  aria-label="Verificar nombre del profesor"
                >
                  <span className="material-symbols-outlined" aria-hidden="true">
                    check_circle
                  </span>
                </button>
              ) : null}
              {shouldShowProfessorSuggestions ? (
                <div className="professor-suggestions" id="professor-suggestions" role="listbox">
                  {profesores.map((professor) => (
                    <button
                      className="professor-suggestion"
                      key={professor.valor}
                      type="button"
                      role="option"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        onSelectProfessor(professor.valor);
                      }}
                    >
                      {professor.etiqueta}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="field-stack">
          <label className="field-label">Semestre</label>
          <div className="cycle-row">
            <SelectField
              label="Inicio"
              id="ciclo-inicio"
              value={cicloInicio}
              onChange={(event) => onCicloInicioChange(event.target.value)}
              options={ciclosInicio}
            />
            <SelectField
              label="Fin"
              id="ciclo-fin"
              value={cicloFin}
              onChange={(event) => onCicloFinChange(event.target.value)}
              options={ciclosFin}
            />
          </div>
        </div>

        <MultiSelectField label="Materias" value={materia} onChange={onMateriaChange} options={materias} />

        <MultiSelectField
          label="Componente"
          value={componente}
          onChange={onComponenteChange}
          options={componentes}
        />

        <MultiSelectField
          label="Departamento"
          value={departamento}
          onChange={onDepartamentoChange}
          options={departamentos}
        />

        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={visualizarComponente}
            onChange={(event) => onVisualizarComponenteChange(event.target.checked)}
          />
          <span>Visualizar el componente</span>
        </label>

        {formError ? <p className="form-alert">{formError}</p> : null}

        <div className="form-actions">
          <button className="action-button action-button--danger" type="button" onClick={onClearAll}>
            <span className="material-symbols-outlined" aria-hidden="true">
              delete_sweep
            </span>
            Borrar
          </button>
          <button className="action-button action-button--search" type="submit" disabled={isSearching}>
            <span className={`material-symbols-outlined ${isSearching ? "spinning" : ""}`} aria-hidden="true">
              {isSearching ? "progress_activity" : "search"}
            </span>
            {isSearching ? "Buscando" : "Buscar"}
          </button>
        </div>
      </form>
    </section>
  );
}
