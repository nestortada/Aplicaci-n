import type { ReportTableRow } from "../types";

interface ResultTableProps {
  rows: ReportTableRow[];
}

export function ResultTable({ rows }: ResultTableProps) {
  return (
    <div className="table-shell">
      <table className="result-table">
        <thead>
          <tr>
            <th>Semestre</th>
            <th>Materia</th>
            <th>Sesiones</th>
            <th>Departamento</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.semestre}-${row.materia}-${row.departamento}-${index}`}>
              <td>{row.semestre}</td>
              <td>{row.materia}</td>
              <td>{row.sesiones}</td>
              <td>{row.departamento}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
