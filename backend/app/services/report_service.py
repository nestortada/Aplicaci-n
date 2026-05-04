from __future__ import annotations

from app.exceptions import AppError
from app.models import AppliedFilters, ReportRequest, ReportResponse
from app.repository import DatasetRepository
from app.services.deduplication import deduplicate_combined_sections
from app.services.filters import (
    apply_optional_filters,
    clean_filter,
    format_filter_values,
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
        professor_name_filter = clean_filter(request.nombre_profesor)
        ciclo_lectivo = clean_filter(request.ciclo_lectivo)
        ciclo_lectivo_inicio = clean_filter(request.ciclo_lectivo_inicio)
        ciclo_lectivo_final = clean_filter(request.ciclo_lectivo_final)
        nombre_curso = request.nombre_curso or ["TODOS"]
        componente = request.componente or ["TODOS"]
        departamento = request.departamento or ["TODOS"]
        nombre_curso_label = format_filter_values(nombre_curso)
        componente_label = format_filter_values(componente)
        departamento_label = format_filter_values(departamento)
        received_filters = {
            "numeroDocumentoDocente": document,
            "idProfesor": professor_id,
            "nombreProfesor": professor_name_filter,
            "cicloLectivo": ciclo_lectivo,
            "cicloLectivoInicio": ciclo_lectivo_inicio,
            "cicloLectivoFinal": ciclo_lectivo_final,
            "nombreCurso": nombre_curso_label,
            "componente": componente_label,
            "departamento": departamento_label,
            "visualizarComponente": request.visualizar_componente,
        }
        database_metadata = self.repository.get_upload_metadata()

        if not document and not professor_id and not professor_name_filter:
            raise AppError(
                400,
                "profesor_requerido",
                "Debe enviar Numero documento docente, Id profesor o Nombre del Profesor.",
                {
                    "parametrosRecibidos": received_filters,
                    "baseDatos": database_metadata,
                    "sugerencia": "Complete al menos uno de los identificadores del profesor.",
                },
            )
        if ciclo_lectivo_inicio and parse_cycle_key(ciclo_lectivo_inicio) is None:
            raise AppError(
                422,
                "ciclo_inicio_invalido",
                "Ciclo Lectivo Inicio debe tener un formato como PERIODO 2016-2.",
                {
                    "parametrosRecibidos": received_filters,
                    "baseDatos": database_metadata,
                    "sugerencia": "Use el formato PERIODO AAAA-N, por ejemplo PERIODO 2017-1.",
                },
            )
        if ciclo_lectivo_final and parse_cycle_key(ciclo_lectivo_final) is None:
            raise AppError(
                422,
                "ciclo_final_invalido",
                "Ciclo Lectivo Final debe tener un formato como PERIODO 2016-2.",
                {
                    "parametrosRecibidos": received_filters,
                    "baseDatos": database_metadata,
                    "sugerencia": "Use el formato PERIODO AAAA-N, por ejemplo PERIODO 2017-2.",
                },
            )
        if not self.repository.has_active_dataset():
            raise AppError(
                409,
                "base_no_cargada",
                "No hay una base activa cargada.",
                {
                    "parametrosRecibidos": received_filters,
                    "baseDatos": database_metadata,
                    "sugerencia": "Cargue primero un archivo en /api/uploads.",
                },
            )

        all_rows = self.repository.get_rows()
        professor_rows = filter_by_professor(all_rows, document, professor_id, professor_name_filter)
        if not professor_rows:
            raise AppError(
                404,
                "profesor_no_encontrado",
                "Profesor no encontrado.",
                {
                    "parametrosRecibidos": received_filters,
                    "baseDatos": database_metadata,
                    "sugerencia": "Revise el numero de documento, el Id profesor o el nombre contra la base cargada.",
                },
            )

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
                {
                    "parametrosRecibidos": received_filters,
                    "baseDatos": database_metadata,
                    "sugerencia": "Revise el ciclo exacto o el rango de ciclos enviados.",
                },
            )

        filtered_rows = apply_optional_filters(cycle_rows, nombre_curso, componente, departamento)
        if not filtered_rows:
            raise AppError(
                404,
                "reporte_sin_datos",
                "No hay datos despues de aplicar los filtros.",
                {
                    "parametrosRecibidos": received_filters,
                    "baseDatos": database_metadata,
                    "sugerencia": "Pruebe con nombreCurso='TODOS', componente='TODOS' o departamento='TODOS'.",
                },
            )

        deduplicated_rows = deduplicate_combined_sections(filtered_rows)
        try:
            rows_with_hours = attach_session_hours(deduplicated_rows)
        except AppError as exc:
            if exc.code != "horas_invalidas":
                raise
            raise AppError(
                exc.status_code,
                exc.code,
                exc.message,
                {
                    **(exc.details or {}),
                    "parametrosRecibidos": received_filters,
                    "baseDatos": database_metadata,
                    "sugerencia": "Corrija las filas indicadas en la base y vuelva a cargar el archivo.",
                },
            ) from exc
        table_rows = group_report_rows(rows_with_hours, request.visualizar_componente)
        if not table_rows:
            raise AppError(
                404,
                "reporte_sin_datos",
                "No hay datos despues de aplicar los filtros.",
                {
                    "parametrosRecibidos": received_filters,
                    "baseDatos": database_metadata,
                    "sugerencia": "Pruebe con filtros mas amplios.",
                },
            )

        filters = AppliedFilters(
            numeroDocumentoDocente=document,
            idProfesor=professor_id,
            nombreProfesor=professor_name_filter,
            cicloLectivo=ciclo_lectivo,
            cicloLectivoInicio=ciclo_lectivo_inicio,
            cicloLectivoFinal=ciclo_lectivo_final,
            nombreCurso=nombre_curso_label,
            componente=componente_label,
            departamento=departamento_label,
            visualizarComponente=request.visualizar_componente,
        )
        return ReportResponse(
            profesor=professor_name,
            filtrosAplicados=filters,
            tabla=table_rows,
            mensaje=build_message(professor_name, table_rows),
            baseDatos=database_metadata,
        )
