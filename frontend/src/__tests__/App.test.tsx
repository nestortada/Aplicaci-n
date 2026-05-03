import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { CertificatePreview } from "../components/CertificatePreview";
import * as api from "../services/api";
import type { DatasetMetadata, FilterOption, ReportResponse } from "../types";

vi.mock("../services/api", () => ({
  uploadDatabase: vi.fn(),
  getCurrentDatabase: vi.fn(),
  deleteDatabase: vi.fn(),
  getCiclos: vi.fn(),
  getMaterias: vi.fn(),
  getComponentes: vi.fn(),
  generateReporte: vi.fn(),
}));

const inactiveDatabase: DatasetMetadata = { activa: false, archivo: "", fechaCarga: "", filasCargadas: 0 };
const activeDatabase: DatasetMetadata = {
  activa: true,
  archivo: "datos.xlsx",
  fechaCarga: "2026-05-03T00:00:00Z",
  filasCargadas: 25,
};
const cycleOptions: FilterOption[] = [
  { valor: "PERIODO 2023-1", etiqueta: "2023-I" },
  { valor: "PERIODO 2023-2", etiqueta: "2023-II" },
  { valor: "PERIODO 2024-1", etiqueta: "2024-I" },
];
const report: ReportResponse = {
  profesor: "MARTINEZ HERNANDEZ LINA MARIA",
  filtrosAplicados: {
    numeroDocumentoDocente: "",
    idProfesor: "0000005357",
    cicloLectivo: "",
    cicloLectivoInicio: "PERIODO 2023-1",
    cicloLectivoFinal: "PERIODO 2024-1",
    nombreCurso: "TODOS",
    componente: "TODOS",
    visualizarComponente: false,
  },
  tabla: [
    {
      semestre: "PERIODO 2023-1",
      materia: "SEMINARIO DE PRACTICA",
      sesiones: 12,
      departamento: "PROCESOS INDUSTRIALES",
    },
  ],
  mensaje: "",
  baseDatos: activeDatabase,
};

describe("Sabana Certificado frontend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getCurrentDatabase).mockResolvedValue(inactiveDatabase);
    vi.mocked(api.getCiclos).mockResolvedValue({ opciones: [] });
    vi.mocked(api.getMaterias).mockResolvedValue({ opciones: [] });
    vi.mocked(api.getComponentes).mockResolvedValue({ opciones: [] });
    vi.mocked(api.uploadDatabase).mockResolvedValue({
      estado: "ok",
      archivo: "datos.csv",
      filasCargadas: 1,
      columnasDetectadas: [],
      baseDatos: { ...activeDatabase, archivo: "datos.csv", filasCargadas: 1 },
    });
    vi.mocked(api.deleteDatabase).mockResolvedValue(inactiveDatabase);
    vi.mocked(api.generateReporte).mockResolvedValue(report);
    Object.defineProperty(window, "confirm", { value: vi.fn(() => true), configurable: true });
  });

  it("uploads a valid file from the input and rejects invalid extensions", async () => {
    render(<App />);

    await screen.findByText("Subir archivo .xlsx o .csv");
    const input = screen.getByTestId("file-input");
    const invalidFile = new File(["bad"], "notas.txt", { type: "text/plain" });
    fireEvent.change(input, { target: { files: [invalidFile] } });

    expect(api.uploadDatabase).not.toHaveBeenCalled();
    expect(await screen.findByText("Formato no válido. Sube un archivo .xlsx o .csv.")).toBeInTheDocument();

    const validFile = new File(["ok"], "datos.csv", { type: "text/csv" });
    fireEvent.change(input, { target: { files: [validFile] } });

    await waitFor(() => expect(api.uploadDatabase).toHaveBeenCalledWith(validFile));
  });

  it("changes the identification placeholder based on the selected type", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByPlaceholderText("Id profesor...")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Tipo de identificación"), "document");

    expect(screen.getByPlaceholderText("Número...")).toBeInTheDocument();
  });

  it("filters the end cycle options after selecting a start cycle", async () => {
    const user = userEvent.setup();
    vi.mocked(api.getCurrentDatabase).mockResolvedValue(activeDatabase);
    vi.mocked(api.getCiclos).mockResolvedValue({ opciones: cycleOptions });

    render(<App />);

    const startSelect = await screen.findByLabelText("Inicio");
    await user.selectOptions(startSelect, "PERIODO 2023-2");
    const endSelect = screen.getByLabelText("Fin");

    expect((within(endSelect).getByRole("option", { name: "Todos los periodos" }) as HTMLOptionElement).value).toBe("");
    expect(within(endSelect).queryByRole("option", { name: "2023-I" })).not.toBeInTheDocument();
    expect(within(endSelect).getByRole("option", { name: "2023-II" })).toBeInTheDocument();
    expect(within(endSelect).getByRole("option", { name: "2024-I" })).toBeInTheDocument();
  });

  it("sends the expected payload without requiring cycle filters", async () => {
    const user = userEvent.setup();
    vi.mocked(api.getCurrentDatabase).mockResolvedValue(activeDatabase);
    vi.mocked(api.getCiclos).mockResolvedValue({ opciones: cycleOptions });

    render(<App />);

    await user.type(await screen.findByPlaceholderText("Id profesor..."), "0000005357");
    await user.click(screen.getByRole("button", { name: /buscar/i }));

    await waitFor(() =>
      expect(api.generateReporte).toHaveBeenCalledWith({
        numeroDocumentoDocente: "",
        idProfesor: "0000005357",
        cicloLectivoInicio: "",
        cicloLectivoFinal: "",
        nombreCurso: "TODOS",
        componente: "TODOS",
        visualizarComponente: false,
      }),
    );
  });

  it("loads course and component options for a professor even when cycles are empty", async () => {
    const user = userEvent.setup();
    vi.mocked(api.getCurrentDatabase).mockResolvedValue(activeDatabase);
    vi.mocked(api.getCiclos).mockResolvedValue({ opciones: cycleOptions });
    vi.mocked(api.getMaterias).mockResolvedValue({ opciones: [{ valor: "BIOQUIMICA", etiqueta: "BIOQUIMICA" }] });
    vi.mocked(api.getComponentes).mockResolvedValue({ opciones: [{ valor: "LAB", etiqueta: "LAB" }] });

    render(<App />);

    await user.type(await screen.findByPlaceholderText("Id profesor..."), "0000005357");

    await waitFor(() =>
      expect(api.getMaterias).toHaveBeenCalledWith({
        numeroDocumentoDocente: "",
        idProfesor: "0000005357",
        cicloLectivoInicio: "",
        cicloLectivoFinal: "",
      }),
    );
    expect(await screen.findByRole("option", { name: "BIOQUIMICA" })).toBeInTheDocument();
    expect(await screen.findByRole("option", { name: "LAB" })).toBeInTheDocument();
  });

  it("bottom Borrar clears parameters without deleting the uploaded database", async () => {
    const user = userEvent.setup();
    vi.mocked(api.getCurrentDatabase).mockResolvedValue(activeDatabase);
    vi.mocked(api.getCiclos).mockResolvedValue({ opciones: cycleOptions });

    render(<App />);

    await user.type(await screen.findByPlaceholderText("Id profesor..."), "0000005357");
    await user.selectOptions(screen.getByLabelText("Inicio"), "PERIODO 2023-1");
    await user.click(screen.getByRole("button", { name: /^borrar$/i }));

    expect(api.deleteDatabase).not.toHaveBeenCalled();
    expect(screen.getByText("datos.xlsx")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Id profesor...")).toHaveValue("");
    expect(screen.getByLabelText("Inicio")).toHaveValue("");
  });

  it("copies only the table or the complete message depending on the button", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    Object.defineProperty(window, "ClipboardItem", { value: undefined, configurable: true });

    render(
      <CertificatePreview
        result={report}
        isLoading={false}
        error=""
        onCopyTable={async () => {
          await navigator.clipboard.writeText("SEMESTRE\tMATERIA\tSESIONES\tDEPARTAMENTO");
        }}
        onCopyMessage={async () => {
          await navigator.clipboard.writeText("Buen día, cordial saludo,\n\nSEMESTRE\tMATERIA");
        }}
        onCopied={() => undefined}
        onCopyError={() => undefined}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Copiar solo la tabla" }));
    expect(writeText).toHaveBeenLastCalledWith(expect.not.stringContaining("Buen día"));
    expect(writeText).toHaveBeenLastCalledWith(expect.stringContaining("SEMESTRE"));

    await user.click(screen.getByRole("button", { name: /copiar para envío/i }));
    expect(writeText).toHaveBeenLastCalledWith(expect.stringContaining("Buen día, cordial saludo"));
  });
});
