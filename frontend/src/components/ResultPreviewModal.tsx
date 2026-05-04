import { useEffect, useMemo, useState } from "react";
import type { ReportMetricRow, ReportResponse } from "../types";
import { ResultTable } from "./ResultTable";

interface ResultPreviewModalProps {
  result: ReportResponse;
  onClose: () => void;
}

const collator = new Intl.Collator("es", { numeric: true, sensitivity: "base" });

export function ResultPreviewModal({ result, onClose }: ResultPreviewModalProps) {
  const [materiaFilter, setMateriaFilter] = useState("");
  const [componenteFilter, setComponenteFilter] = useState("");
  const [departamentoFilter, setDepartamentoFilter] = useState("");

  const metricRowsSource = useMemo(
    () => (result.metricas && result.metricas.length > 0 ? result.metricas : buildFallbackMetricRows(result.tabla)),
    [result.metricas, result.tabla],
  );
  const materiaOptions = useMemo(() => uniqueValues(metricRowsSource.map((row) => row.materia)), [metricRowsSource]);
  const componenteOptions = useMemo(
    () => uniqueValues(metricRowsSource.map((row) => row.componente)),
    [metricRowsSource],
  );
  const departamentoOptions = useMemo(
    () => uniqueValues(metricRowsSource.map((row) => row.departamento)),
    [metricRowsSource],
  );

  const metricRows = useMemo(
    () =>
      metricRowsSource.filter(
        (row) =>
          (!materiaFilter || row.materia === materiaFilter) &&
          (!componenteFilter || row.componente === componenteFilter) &&
          (!departamentoFilter || row.departamento === departamentoFilter),
      ),
    [departamentoFilter, materiaFilter, componenteFilter, metricRowsSource],
  );
  const filteredMetricKeys = useMemo(
    () => new Set(metricRows.map((row) => buildMetricKey(row.semestre, row.materia, row.departamento))),
    [metricRows],
  );
  const tableRows = useMemo(
    () =>
      result.tabla.filter(
        (row) =>
          (!materiaFilter || row.materia === materiaFilter) &&
          (!componenteFilter ||
            (row.componente
              ? row.componente === componenteFilter
              : filteredMetricKeys.has(buildMetricKey(row.semestre, row.materia, row.departamento)))) &&
          (!departamentoFilter || row.departamento === departamentoFilter),
      ),
    [departamentoFilter, materiaFilter, componenteFilter, filteredMetricKeys, result.tabla],
  );

  const totalSessions = useMemo(() => sumSessions(metricRows), [metricRows]);
  const sessionsBySemester = useMemo(() => buildSemesterMetrics(metricRows), [metricRows]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.body.classList.add("modal-open");
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.classList.remove("modal-open");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="preview-modal" role="dialog" aria-modal="true" aria-labelledby="preview-modal-title">
      <button className="preview-modal__backdrop" type="button" aria-label="Cerrar previsualización" onClick={onClose} />
      <div className="preview-modal__panel liquid-glass">
        <header className="preview-modal__header">
          <div>
            <p className="preview-modal__eyebrow">Previsualización</p>
            <h2 id="preview-modal-title">Sesiones de {result.profesor}</h2>
          </div>
          <button className="glass-icon-button" type="button" onClick={onClose} aria-label="Cerrar previsualización">
            <span className="material-symbols-outlined" aria-hidden="true">
              close
            </span>
          </button>
        </header>

        <div className="preview-modal__body">
          <div className="preview-modal__table">
            <ResultTable rows={tableRows} title="Tabla ampliada de resultados" />
          </div>

          <aside className="metrics-panel" aria-label="Métricas de sesiones">
            <div className="metric-card metric-card--total">
              <span>Total de sesiones</span>
              <strong>{formatNumber(sumSessions(metricRowsSource))}</strong>
            </div>

            <div className="metrics-filters">
              <label className="table-filter">
                <span>Materia</span>
                <select value={materiaFilter} onChange={(event) => setMateriaFilter(event.target.value)}>
                  <option value="">Todas</option>
                  {materiaOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="table-filter">
                <span>Componente</span>
                <select
                  value={componenteFilter}
                  disabled={componenteOptions.length === 0}
                  onChange={(event) => setComponenteFilter(event.target.value)}
                >
                  <option value="">Todos</option>
                  {componenteOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="table-filter">
                <span>Departamento</span>
                <select value={departamentoFilter} onChange={(event) => setDepartamentoFilter(event.target.value)}>
                  <option value="">Todos</option>
                  {departamentoOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="metric-card">
              <span>Sesiones con filtros</span>
              <strong>{formatNumber(totalSessions)}</strong>
            </div>

            <div className="semester-metrics">
              <h3>Total por semestre</h3>
              {sessionsBySemester.length > 0 ? (
                sessionsBySemester.map((metric) => (
                  <div className="semester-metric" key={metric.semestre}>
                    <span>{metric.semestre}</span>
                    <strong>{formatNumber(metric.sesiones)}</strong>
                  </div>
                ))
              ) : (
                <p>No hay sesiones para esos filtros.</p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => collator.compare(left, right));
}

function sumSessions(rows: ReportMetricRow[]): number {
  return rows.reduce((total, row) => total + Number(row.sesiones || 0), 0);
}

function buildSemesterMetrics(rows: ReportMetricRow[]): Array<{ semestre: string; sesiones: number }> {
  const totals = new Map<string, number>();
  rows.forEach((row) => {
    totals.set(row.semestre, (totals.get(row.semestre) || 0) + Number(row.sesiones || 0));
  });
  return Array.from(totals, ([semestre, sesiones]) => ({ semestre, sesiones })).sort((left, right) =>
    collator.compare(left.semestre, right.semestre),
  );
}

function buildMetricKey(semestre: string, materia: string, departamento: string): string {
  return `${semestre}\u001f${materia}\u001f${departamento}`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(value);
}

function buildFallbackMetricRows(rows: ReportResponse["tabla"]): ReportMetricRow[] {
  return rows.map((row) => ({
    semestre: row.semestre,
    materia: row.materia,
    componente: row.componente || "",
    departamento: row.departamento,
    sesiones: row.sesiones,
  }));
}
