import { useEffect, useMemo, useState } from "react";
import type { ReportMetricRow, ReportResponse } from "../types";
import { ResultTable } from "./ResultTable";
import type { FilterableColumnKey } from "./ResultTable";

interface ResultPreviewModalProps {
  result: ReportResponse;
  onClose: () => void;
}

const collator = new Intl.Collator("es", { numeric: true, sensitivity: "base" });

export function ResultPreviewModal({ result, onClose }: ResultPreviewModalProps) {
  const [semestreFilter, setSemestreFilter] = useState("");
  const [materiaFilter, setMateriaFilter] = useState("");
  const [componenteFilter, setComponenteFilter] = useState("");
  const [departamentoFilter, setDepartamentoFilter] = useState("");

  const metricRowsSource = useMemo(
    () => (result.metricas && result.metricas.length > 0 ? result.metricas : buildFallbackMetricRows(result.tabla)),
    [result.metricas, result.tabla],
  );
  const semestreOptions = useMemo(
    () => uniqueValues(metricRowsSource.map((row) => row.semestre)),
    [metricRowsSource],
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
          (!semestreFilter || row.semestre === semestreFilter) &&
          (!componenteFilter || row.componente === componenteFilter) &&
          (!departamentoFilter || row.departamento === departamentoFilter),
      ),
    [departamentoFilter, materiaFilter, componenteFilter, semestreFilter, metricRowsSource],
  );
  const filteredMetricKeys = useMemo(
    () => new Set(metricRows.map((row) => buildMetricKey(row.semestre, row.materia, row.departamento))),
    [metricRows],
  );
  const componentByMetricKey = useMemo(() => buildSingleComponentMap(metricRowsSource), [metricRowsSource]);
  const tableRows = useMemo(
    () =>
      result.tabla
        .filter(
          (row) =>
            (!materiaFilter || row.materia === materiaFilter) &&
            (!semestreFilter || row.semestre === semestreFilter) &&
            (!componenteFilter ||
              (row.componente
                ? row.componente === componenteFilter
                : filteredMetricKeys.has(buildMetricKey(row.semestre, row.materia, row.departamento)))) &&
            (!departamentoFilter || row.departamento === departamentoFilter),
        )
        .map((row) => {
          if (row.componente) {
            return row;
          }
          const metricKey = buildMetricKey(row.semestre, row.materia, row.departamento);
          const inferredComponent = componenteFilter || componentByMetricKey.get(metricKey) || "";
          return inferredComponent ? { ...row, componente: inferredComponent } : row;
        }),
    [
      departamentoFilter,
      materiaFilter,
      componenteFilter,
      semestreFilter,
      filteredMetricKeys,
      componentByMetricKey,
      result.tabla,
    ],
  );

  const totalSessions = useMemo(() => sumSessions(metricRows), [metricRows]);
  const sessionsBySemester = useMemo(() => buildSemesterMetrics(metricRows), [metricRows]);
  const hasComponentValues = useMemo(() => tableRows.some((row) => Boolean(row.componente)), [tableRows]);
  const hasActiveFilters = Boolean(semestreFilter || materiaFilter || componenteFilter || departamentoFilter);
  const activeCellFilters = useMemo(
    () => ({
      semestre: semestreFilter,
      materia: materiaFilter,
      componente: componenteFilter,
      departamento: departamentoFilter,
    }),
    [componenteFilter, departamentoFilter, materiaFilter, semestreFilter],
  );

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

  function clearFilters() {
    setSemestreFilter("");
    setMateriaFilter("");
    setComponenteFilter("");
    setDepartamentoFilter("");
  }

  function handleCellFilter(key: FilterableColumnKey, value: string) {
    if (key === "semestre") {
      setSemestreFilter((current) => (current === value ? "" : value));
      return;
    }
    if (key === "materia") {
      setMateriaFilter((current) => (current === value ? "" : value));
      return;
    }
    if (key === "componente") {
      setComponenteFilter((current) => (current === value ? "" : value));
      return;
    }
    setDepartamentoFilter((current) => (current === value ? "" : value));
  }

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
            <ResultTable
              rows={tableRows}
              title="Tabla ampliada de resultados"
              activeCellFilters={activeCellFilters}
              filterableColumns={["semestre", "materia", "componente", "departamento"]}
              showComponentColumn={hasComponentValues}
              onCellFilter={handleCellFilter}
            />
          </div>

          <aside className="metrics-panel" aria-label="Métricas de sesiones">
            <div className="metric-card metric-card--total">
              <span>Total de sesiones</span>
              <strong>{formatNumber(sumSessions(metricRowsSource))}</strong>
            </div>

            <div className="metrics-filters">
              <label className="table-filter">
                <span>Semestre</span>
                <select value={semestreFilter} onChange={(event) => setSemestreFilter(event.target.value)}>
                  <option value="">Todos</option>
                  {semestreOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
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
              <button
                className="clear-filters-button"
                type="button"
                disabled={!hasActiveFilters}
                onClick={clearFilters}
              >
                Limpiar filtros
              </button>
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

function buildSingleComponentMap(rows: ReportMetricRow[]): Map<string, string> {
  const componentsByKey = new Map<string, Set<string>>();
  rows.forEach((row) => {
    if (!row.componente) {
      return;
    }
    const key = buildMetricKey(row.semestre, row.materia, row.departamento);
    const components = componentsByKey.get(key) || new Set<string>();
    components.add(row.componente);
    componentsByKey.set(key, components);
  });

  const componentByKey = new Map<string, string>();
  componentsByKey.forEach((components, key) => {
    if (components.size === 1) {
      const [component] = components;
      if (component) {
        componentByKey.set(key, component);
      }
    }
  });
  return componentByKey;
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
