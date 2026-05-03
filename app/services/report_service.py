from __future__ import annotations

from app.exceptions import AppError
from app.models import AppliedFilters, ReportRequest, ReportResponse
from app.repository import DatasetRepository
from app.services.deduplication import deduplicate_combined_sections
from app.services.filters import (
    apply_optional_filters,
    clean_filter,
    filter_by_cycle_selection,
    filter_by_professor,
    first_valid_professor_name,
    parse_cycle_key,
)
from app.services.message_builder import build_message
from app.services.report_builder import attach_session_hours, group_report_rows


class ReportService:
    def __init__(self, repository: DatasetRepository) -> None:
        self.repository = repository

    def build_professor_sessions_report(self, request: ReportRequest) -> ReportResponse:
        document = clean_filter(request.numero_documento_docente)
        professor_id = clean_filter(request.id_profesor)
        ciclo_lectivo = clean_filter(request.ciclo_lectivo)
        ciclo_lectivo_inicio = clean_filter(request.ciclo_lectivo_inicio)
        ciclo_lectivo_final = clean_filter(request.ciclo_lectivo_final)
        nombre_curso = clean_filter(request.nombre_curso) or "TODOS"
        componente = clean_filter(request.componente) or "TODOS"

        if not document and not professor_id:
            raise AppError(
                400,
                "profesor_requerido",
                "Debe enviar Numero documento docente o Id profesor.",
            )
        if ciclo_lectivo_inicio and parse_cycle_key(ciclo_lectivo_inicio) is None:
            raise AppError(
                422,
                "ciclo_inicio_invalido",
                "Ciclo Lectivo Inicio debe tener un formato como PERIODO 2016-2.",
            )
        if ciclo_lectivo_final and parse_cycle_key(ciclo_lectivo_final) is None:
            raise AppError(
                422,
                "ciclo_final_invalido",
                "Ciclo Lectivo Final debe tener un formato como PERIODO 2016-2.",
            )
        if not self.repository.has_active_dataset():
            raise AppError(409, "base_no_cargada", "No hay una base activa cargada.")

        all_rows = self.repository.get_rows()
        professor_rows = filter_by_professor(all_rows, document, professor_id)
        if not professor_rows:
            raise AppError(404, "profesor_no_encontrado", "Profesor no encontrado.")

        professor_name = first_valid_professor_name(professor_rows)
        cycle_rows = filter_by_cycle_selection(
            professor_rows,
            ciclo_lectivo,
            ciclo_lectivo_inicio,
            ciclo_lectivo_final,
        )
        if not cycle_rows:
            raise AppError(
                404,
                "ciclo_no_encontrado",
                "No se encontraron ciclos lectivos para ese profesor con los filtros enviados.",
            )

        filtered_rows = apply_optional_filters(cycle_rows, nombre_curso, componente)
        if not filtered_rows:
            raise AppError(
                404,
                "reporte_sin_datos",
                "No hay datos despues de aplicar los filtros.",
            )

        deduplicated_rows = deduplicate_combined_sections(filtered_rows)
        rows_with_hours = attach_session_hours(deduplicated_rows)
        table_rows = group_report_rows(rows_with_hours, request.visualizar_componente)
        if not table_rows:
            raise AppError(
                404,
                "reporte_sin_datos",
                "No hay datos despues de aplicar los filtros.",
            )

        filters = AppliedFilters(
            numeroDocumentoDocente=document,
            idProfesor=professor_id,
            cicloLectivo=ciclo_lectivo,
            cicloLectivoInicio=ciclo_lectivo_inicio,
            cicloLectivoFinal=ciclo_lectivo_final,
            nombreCurso=nombre_curso,
            componente=componente,
            visualizarComponente=request.visualizar_componente,
        )
        return ReportResponse(
            profesor=professor_name,
            filtrosAplicados=filters,
            tabla=table_rows,
            mensaje=build_message(professor_name, table_rows),
        )
