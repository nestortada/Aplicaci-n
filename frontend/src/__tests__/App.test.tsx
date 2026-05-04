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
  getRuntime: vi.fn(),
  deleteDatabase: vi.fn(),
  getCiclos: vi.fn(),
  getProfesores: vi.fn(),
  getMaterias: vi.fn(),
  getComponentes: vi.fn(),
  getDepartamentos: vi.fn(),
  generateReporte: vi.fn(),
  openOutlookDraft: vi.fn(),
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
    nombreProfesor: "MARTINEZ HERNANDEZ LINA MARIA",
    cicloLectivo: "",
    cicloLectivoInicio: "PERIODO 2023-1",
    cicloLectivoFinal: "PERIODO 2024-1",
    nombreCurso: "TODOS",
    componente: "TODOS",
    departamento: "TODOS",
    visualizarComponente: false,
  },
  tabla: [
    {
      semestre: "PERIODO 2023-1",
      materia: "SEMINARIO DE PRACTICA",
      fechaInicio: "2023-01-20",
      fechaFinal: "2023-05-30",
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
    vi.mocked(api.getRuntime).mockResolvedValue({ runtime: "local" });
    vi.mocked(api.getCurrentDatabase).mockResolvedValue(inactiveDatabase);
    vi.mocked(api.getCiclos).mockResolvedValue({ opciones: [] });
    vi.mocked(api.getProfesores).mockResolvedValue({ opciones: [] });
    vi.mocked(api.getMaterias).mockResolvedValue({ opciones: [] });
    vi.mocked(api.getComponentes).mockResolvedValue({ opciones: [] });
    vi.mocked(api.getDepartamentos).mockResolvedValue({ opciones: [] });
    vi.mocked(api.uploadDatabase).mockResolvedValue({
      estado: "ok",
      archivo: "datos.csv",
      filasCargadas: 1,
      columnasDetectadas: [],
      baseDatos: { ...activeDatabase, archivo: "datos.csv", filasCargadas: 1 },
    });
    vi.mocked(api.deleteDatabase).mockResolvedValue(inactiveDatabase);
    vi.mocked(api.generateReporte).mockResolvedValue(report);
    vi.mocked(api.openOutlookDraft).mockResolvedValue(undefined);
    Object.defineProperty(window, "confirm", { value: vi.fn(() => true), configurable: true });
  });

  it("shows the installer download link in the header when running locally", async () => {
    render(<App />);

    const downloadLink = await screen.findByRole("link", { name: /descargar aplicación/i });

    expect(downloadLink).toHaveAttribute("href", "/downloads/SabanaCertificado.exe");
    expect(downloadLink).toHaveAttribute("download", "SabanaCertificado.exe");
  });

  it("hides the installer download link in the desktop app", async () => {
    vi.mocked(api.getRuntime).mockResolvedValue({ runtime: "desktop" });

    render(<App />);

    await waitFor(() => expect(api.getRuntime).toHaveBeenCalled());
    expect(screen.queryByRole("link", { name: /descargar aplicación/i })).not.toBeInTheDocument();
  });

  it("opens Outlook with an HTML table draft from local or desktop runtime", async () => {
    const user = userEvent.setup();
    vi.mocked(api.getCurrentDatabase).mockResolvedValue(activeDatabase);
    vi.mocked(api.getCiclos).mockResolvedValue({ opciones: cycleOptions });

    render(<App />);

    await user.type(await screen.findByPlaceholderText("Nombre del profesor..."), "Lina Martinez");
    await user.click(screen.getByRole("button", { name: /buscar/i }));
    await screen.findByText("SEMINARIO DE PRACTICA");
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    await waitFor(() =>
      expect(api.openOutlookDraft).toHaveBeenCalledWith({
        to: "solicitud.certifica@unisabana.edu.co",
        cc: ["dianarc@unisabana.edu.co", "alvarorodu@unisabana.edu.co"],
        subject: "Solicitud Información - MARTINEZ HERNANDEZ LINA MARIA",
        bodyHtml: expect.stringContaining("<table"),
        bodyText: expect.stringContaining("SEMINARIO DE PRACTICA"),
      }),
    );
    expect(vi.mocked(api.openOutlookDraft).mock.calls[0][0].bodyHtml).toContain("SEMINARIO DE PRACTICA");
  });

  it("shows a loading state while opening the Outlook draft", async () => {
    const user = userEvent.setup();
    let resolveDraft: (() => void) | undefined;
    vi.mocked(api.openOutlookDraft).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveDraft = resolve;
        }),
    );
    vi.mocked(api.getCurrentDatabase).mockResolvedValue(activeDatabase);
    vi.mocked(api.getCiclos).mockResolvedValue({ opciones: cycleOptions });

    render(<App />);

    await user.type(await screen.findByPlaceholderText("Nombre del profesor..."), "Lina Martinez");
    await user.click(screen.getByRole("button", { name: /buscar/i }));
    await screen.findByText("SEMINARIO DE PRACTICA");
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    const sendingButton = await screen.findByRole("button", { name: "Enviando" });
    expect(sendingButton).toBeDisabled();
    expect(sendingButton).toHaveAttribute("aria-busy", "true");

    resolveDraft?.();
    await waitFor(() => expect(screen.getByRole("button", { name: "Enviar" })).not.toBeDisabled());
  });

  it("falls back to mailto without plus signs when Outlook automation is not available", async () => {
    const user = userEvent.setup();
    const open = vi.fn();
    vi.mocked(api.openOutlookDraft).mockRejectedValue(new Error("No fue posible abrir Outlook automáticamente."));
    vi.mocked(api.getCurrentDatabase).mockResolvedValue(activeDatabase);
    vi.mocked(api.getCiclos).mockResolvedValue({ opciones: cycleOptions });
    Object.defineProperty(window, "open", { value: open, configurable: true });

    render(<App />);

    await user.type(await screen.findByPlaceholderText("Nombre del profesor..."), "Lina Martinez");
    await user.click(screen.getByRole("button", { name: /buscar/i }));
    await screen.findByText("SEMINARIO DE PRACTICA");
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    await waitFor(() => expect(open).toHaveBeenCalled());
    const mailto = open.mock.calls[0][0] as string;
    expect(mailto).toMatch(/^mailto:solicitud\.certifica@unisabana\.edu\.co\?/);
    expect(mailto).not.toContain("+");
    expect(mailto).toContain("Solicitud%20Informaci%C3%B3n%20-%20MARTINEZ%20HERNANDEZ%20LINA%20MARIA");
  });

  it("does not show the Outlook send button in cloud deployments", async () => {
    vi.mocked(api.getRuntime).mockResolvedValue({ runtime: "cloud" });

    render(<App />);

    await waitFor(() => expect(api.getRuntime).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Enviar" })).not.toBeInTheDocument();
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

  it("shows a loading animation while the database is uploading", async () => {
    let resolveUpload: ((response: Awaited<ReturnType<typeof api.uploadDatabase>>) => void) | undefined;
    vi.mocked(api.uploadDatabase).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpload = resolve;
        }),
    );
    render(<App />);

    await screen.findByText("Subir archivo .xlsx o .csv");
    const validFile = new File(["ok"], "datos.csv", { type: "text/csv" });
    fireEvent.change(screen.getByTestId("file-input"), { target: { files: [validFile] } });

    const uploadZone = screen.getByTestId("upload-zone");
    expect(await screen.findByText("Cargando base de datos")).toBeInTheDocument();
    expect(uploadZone).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Borrar base de datos" })).toBeDisabled();

    resolveUpload?.({
      estado: "ok",
      archivo: "datos.csv",
      filasCargadas: 1,
      columnasDetectadas: [],
      baseDatos: { ...activeDatabase, archivo: "datos.csv", filasCargadas: 1 },
    });
    await waitFor(() => expect(screen.getByText("Base cargada correctamente.")).toBeInTheDocument());
  });

  it("changes the identification placeholder based on the selected type", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByPlaceholderText("Nombre del profesor...")).toBeInTheDocument();
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

    await user.type(await screen.findByPlaceholderText("Nombre del profesor..."), "Lina Martinez");
    await user.click(screen.getByRole("button", { name: /buscar/i }));

    await waitFor(() =>
      expect(api.generateReporte).toHaveBeenCalledWith({
        numeroDocumentoDocente: "",
        idProfesor: "",
        nombreProfesor: "Lina Martinez",
        cicloLectivoInicio: "",
        cicloLectivoFinal: "",
        nombreCurso: ["TODOS"],
        componente: ["TODOS"],
        departamento: ["TODOS"],
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

    await user.type(await screen.findByPlaceholderText("Nombre del profesor..."), "Lina Martinez");

    await waitFor(() =>
      expect(api.getMaterias).toHaveBeenCalledWith({
        numeroDocumentoDocente: "",
        idProfesor: "",
        nombreProfesor: "Lina Martinez",
        cicloLectivoInicio: "",
        cicloLectivoFinal: "",
      }),
    );
    await user.click(screen.getByRole("button", { name: /materias/i }));
    expect(await screen.findByRole("checkbox", { name: "BIOQUIMICA" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /componente/i }));
    expect(await screen.findByRole("checkbox", { name: "LAB" })).toBeInTheDocument();
  });

  it("allows selecting several courses and components", async () => {
    const user = userEvent.setup();
    vi.mocked(api.getCurrentDatabase).mockResolvedValue(activeDatabase);
    vi.mocked(api.getCiclos).mockResolvedValue({ opciones: cycleOptions });
    vi.mocked(api.getMaterias).mockResolvedValue({
      opciones: [
        { valor: "BIOQUIMICA", etiqueta: "BIOQUIMICA" },
        { valor: "FISICA", etiqueta: "FISICA" },
      ],
    });
    vi.mocked(api.getComponentes).mockResolvedValue({
      opciones: [
        { valor: "LAB", etiqueta: "LAB" },
        { valor: "LEC", etiqueta: "LEC" },
      ],
    });

    render(<App />);

    await user.type(await screen.findByPlaceholderText("Nombre del profesor..."), "Lina Martinez");
    await user.click(screen.getByRole("button", { name: /materias/i }));
    await user.click(await screen.findByRole("checkbox", { name: "BIOQUIMICA" }));
    await user.click(await screen.findByRole("checkbox", { name: "FISICA" }));
    await user.click(screen.getByRole("button", { name: /componente/i }));
    await user.click(await screen.findByRole("checkbox", { name: "LAB" }));
    await user.click(await screen.findByRole("checkbox", { name: "LEC" }));
    await user.click(screen.getByRole("button", { name: /buscar/i }));

    await waitFor(() =>
      expect(api.generateReporte).toHaveBeenCalledWith(
        expect.objectContaining({
          nombreCurso: ["BIOQUIMICA", "FISICA"],
          componente: ["LAB", "LEC"],
        }),
      ),
    );
  });

  it("bottom Borrar clears parameters without deleting the uploaded database", async () => {
    const user = userEvent.setup();
    vi.mocked(api.getCurrentDatabase).mockResolvedValue(activeDatabase);
    vi.mocked(api.getCiclos).mockResolvedValue({ opciones: cycleOptions });

    render(<App />);

    await user.type(await screen.findByPlaceholderText("Nombre del profesor..."), "Lina Martinez");
    await user.selectOptions(screen.getByLabelText("Inicio"), "PERIODO 2023-1");
    await user.click(screen.getByRole("button", { name: /^borrar$/i }));

    expect(api.deleteDatabase).not.toHaveBeenCalled();
    expect(screen.getByText("datos.xlsx")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Nombre del profesor...")).toHaveValue("");
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
        onSendEmail={() => undefined}
        onCopied={() => undefined}
        onCopyError={() => undefined}
        showSendEmail
        isSendingEmail={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Copiar solo la tabla" }));
    expect(writeText).toHaveBeenLastCalledWith(expect.not.stringContaining("Buen día"));
    expect(writeText).toHaveBeenLastCalledWith(expect.stringContaining("SEMESTRE"));

    await user.click(screen.getByRole("button", { name: /copiar para envío/i }));
    expect(writeText).toHaveBeenLastCalledWith(expect.stringContaining("Buen día, cordial saludo"));
  });
});
