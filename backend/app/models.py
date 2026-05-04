from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class DatasetMetadata(BaseModel):
    activa: bool
    archivo: str = ""
    fecha_carga: str = Field(default="", alias="fechaCarga")
    filas_cargadas: int = Field(default=0, alias="filasCargadas")

    model_config = ConfigDict(populate_by_name=True)


class FilterOption(BaseModel):
    valor: str
    etiqueta: str


class FilterOptionsResponse(BaseModel):
    opciones: list[FilterOption]


class ReportRequest(BaseModel):
    numero_documento_docente: str = Field(default="", alias="numeroDocumentoDocente")
    id_profesor: str = Field(default="", alias="idProfesor")
    ciclo_lectivo: str = Field(default="", alias="cicloLectivo")
    ciclo_lectivo_inicio: str = Field(default="", alias="cicloLectivoInicio")
    ciclo_lectivo_final: str = Field(default="", alias="cicloLectivoFinal")
    nombre_curso: list[str] = Field(default_factory=lambda: ["TODOS"], alias="nombreCurso")
    componente: list[str] = Field(default_factory=lambda: ["TODOS"])
    visualizar_componente: bool = Field(default=False, alias="visualizarComponente")

    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    @field_validator(
        "numero_documento_docente",
        "id_profesor",
        "ciclo_lectivo",
        "ciclo_lectivo_inicio",
        "ciclo_lectivo_final",
        mode="before",
    )
    @classmethod
    def strip_text(cls, value: Any) -> str:
        if value is None:
            return ""
        return str(value).strip()

    @field_validator("nombre_curso", "componente", mode="before")
    @classmethod
    def normalize_selection(cls, value: Any) -> list[str]:
        if value is None:
            return ["TODOS"]
        values = value if isinstance(value, list) else [value]
        cleaned_values = [cleaned for item in values if (cleaned := str(item).strip())]
        return cleaned_values or ["TODOS"]


class UploadResponse(BaseModel):
    estado: str
    archivo: str
    filas_cargadas: int = Field(alias="filasCargadas")
    columnas_detectadas: list[str] = Field(alias="columnasDetectadas")
    base_datos: DatasetMetadata = Field(alias="baseDatos")

    model_config = ConfigDict(populate_by_name=True)


class AppliedFilters(BaseModel):
    numero_documento_docente: str = Field(alias="numeroDocumentoDocente")
    id_profesor: str = Field(alias="idProfesor")
    ciclo_lectivo: str = Field(alias="cicloLectivo")
    ciclo_lectivo_inicio: str = Field(alias="cicloLectivoInicio")
    ciclo_lectivo_final: str = Field(alias="cicloLectivoFinal")
    nombre_curso: str = Field(alias="nombreCurso")
    componente: str
    visualizar_componente: bool = Field(alias="visualizarComponente")

    model_config = ConfigDict(populate_by_name=True)


class ReportTableRow(BaseModel):
    semestre: str
    materia: str
    sesiones: int | float
    departamento: str

    model_config = ConfigDict(populate_by_name=True)


class ReportResponse(BaseModel):
    profesor: str
    filtros_aplicados: AppliedFilters = Field(alias="filtrosAplicados")
    tabla: list[ReportTableRow]
    mensaje: str
    base_datos: DatasetMetadata | None = Field(default=None, alias="baseDatos")

    model_config = ConfigDict(populate_by_name=True)
