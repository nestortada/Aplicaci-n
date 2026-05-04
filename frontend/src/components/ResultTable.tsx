import { useEffect, useMemo, useState } from "react";
import type { ReportTableRow } from "../types";

interface ResultTableProps {
  rows: ReportTableRow[];
  title?: string;
  onRowsChange?: (rows: ReportTableRow[]) => void;
  activeCellFilters?: Partial<Record<FilterableColumnKey, string>>;
  filterableColumns?: FilterableColumnKey[];
  onCellFilter?: (key: FilterableColumnKey, value: string) => void;
  showComponentColumn?: boolean;
}

type SortKey = "semestre" | "materia" | "componente" | "fechaInicio" | "fechaFinal" | "sesiones" | "departamento";
type SortDirection = "asc" | "desc";
export type FilterableColumnKey = "semestre" | "materia" | "componente" | "departamento";

const collator = new Intl.Collator("es", { numeric: true, sensitivity: "base" });
const baseColumns: Array<{ key: SortKey; label: string; numeric?: boolean }> = [
  { key: "semestre", label: "Semestre" },
  { key: "materia", label: "Materia" },
  { key: "fechaInicio", label: "Fecha de inicio" },
  { key: "fechaFinal", label: "Fecha final" },
  { key: "sesiones", label: "Sesiones", numeric: true },
  { key: "departamento", label: "Departamento" },
];

export function ResultTable({
  rows,
  title = "Resultados",
  onRowsChange,
  activeCellFilters = {},
  filterableColumns = [],
  onCellFilter,
  showComponentColumn = false,
}: ResultTableProps) {
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({
    key: "semestre",
    direction: "asc",
  });
  const columns = useMemo(() => {
    if (!showComponentColumn) {
      return baseColumns;
    }
    return [
      baseColumns[0],
      baseColumns[1],
      { key: "componente" as const, label: "Componente" },
      ...baseColumns.slice(2),
    ];
  }, [showComponentColumn]);

  const visibleRows = useMemo(() => {
    return [...rows].sort((left, right) => compareRows(left, right, sort.key, sort.direction));
  }, [rows, sort]);

  useEffect(() => {
    onRowsChange?.(visibleRows);
  }, [onRowsChange, visibleRows]);

  function handleSort(nextKey: SortKey) {
    setSort((current) => ({
      key: nextKey,
      direction: current.key === nextKey && current.direction === "asc" ? "desc" : "asc",
    }));
  }

  function renderCell(row: ReportTableRow, key: SortKey) {
    const value = String(row[key] ?? "");
    if (!isFilterableColumn(key) || !filterableColumns.includes(key) || !value) {
      return value;
    }
    const isActive = activeCellFilters[key] === value;
    return (
      <button
        className={`table-cell-filter ${isActive ? "table-cell-filter--active" : ""}`}
        type="button"
        onClick={() => onCellFilter?.(key, value)}
        title={isActive ? `Quitar filtro ${value}` : `Filtrar por ${value}`}
      >
        {value}
      </button>
    );
  }

  return (
    <div className="result-table-wrap" aria-label={title}>
      <div className="table-shell">
        <table className="result-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} aria-sort={sort.key === column.key ? toAriaSort(sort.direction) : undefined}>
                  <button
                    className="table-sort-button"
                    type="button"
                    onClick={() => handleSort(column.key)}
                    title={`Ordenar por ${column.label}`}
                  >
                    <span>{column.label}</span>
                    <span className="material-symbols-outlined" aria-hidden="true">
                      {sort.key === column.key
                        ? sort.direction === "asc"
                          ? "arrow_upward"
                          : "arrow_downward"
                        : column.numeric
                          ? "swap_vert"
                          : "sort_by_alpha"}
                    </span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, index) => (
              <tr key={`${row.semestre}-${row.materia}-${row.componente || ""}-${row.departamento}-${index}`}>
                {columns.map((column) => (
                  <td key={column.key}>{renderCell(row, column.key)}</td>
                ))}
              </tr>
            ))}
            {visibleRows.length === 0 ? (
              <tr>
                <td className="result-table__empty" colSpan={columns.length}>
                  No hay resultados.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function compareRows(left: ReportTableRow, right: ReportTableRow, key: SortKey, direction: SortDirection): number {
  const multiplier = direction === "asc" ? 1 : -1;
  if (key === "sesiones") {
    return (left.sesiones - right.sesiones) * multiplier;
  }
  return collator.compare(String(left[key] ?? ""), String(right[key] ?? "")) * multiplier;
}

function toAriaSort(direction: SortDirection): "ascending" | "descending" {
  return direction === "asc" ? "ascending" : "descending";
}

function isFilterableColumn(key: SortKey): key is FilterableColumnKey {
  return key === "semestre" || key === "materia" || key === "componente" || key === "departamento";
}
