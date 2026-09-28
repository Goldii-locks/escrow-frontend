import { describe, expect, it, vi } from "vitest";
import {
  convertToCSV,
  downloadCSV,
  escapeCsvCell,
  exportPlatformMetrics,
  formatMetricsForExport,
  metricsExportFilename,
} from "@/app/lib/platform_metrics_charts_export";
import { MOCK_PLATFORM_METRICS_DATA } from "@/app/lib/platform_metrics_charts_mapping";

describe("platform_metrics_charts export", () => {
  it("escapeCsvCell handles strings, numbers, and empty values", () => {
    expect(escapeCsvCell("hello")).toBe("hello");
    expect(escapeCsvCell(42)).toBe("42");
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
    expect(escapeCsvCell("")).toBe("");
  });

  it("escapeCsvCell escapes quotes and commas", () => {
    expect(escapeCsvCell('a,"b"')).toBe('"a,""b"""');
    expect(escapeCsvCell("has,comma")).toBe('"has,comma"');
  });

  it("escapeCsvCell neutralises formula injection", () => {
    expect(escapeCsvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(escapeCsvCell("+CMD")).toBe("'+CMD");
    expect(escapeCsvCell("-1")).toBe("'-1");
    expect(escapeCsvCell("@user")).toBe("'@user");
  });

  it("metricsExportFilename builds a dated filename", () => {
    expect(metricsExportFilename(new Date("2026-09-28T10:00:00Z"))).toBe(
      "platform-metrics-2026-09-28.csv",
    );
  });

  it("formatMetricsForExport returns one row per metric with correct keys", () => {
    const rows = formatMetricsForExport(MOCK_PLATFORM_METRICS_DATA);
    expect(rows).toHaveLength(MOCK_PLATFORM_METRICS_DATA.metrics.length);
    const first = rows[0];
    expect(first).toHaveProperty("ID");
    expect(first).toHaveProperty("Label");
    expect(first).toHaveProperty("Value");
    expect(first).toHaveProperty("Change (%)");
    expect(first).toHaveProperty("Unit");
    expect(first["ID"]).toBe(MOCK_PLATFORM_METRICS_DATA.metrics[0].id);
    expect(first["Label"]).toBe(MOCK_PLATFORM_METRICS_DATA.metrics[0].label);
    expect(first["Value"]).toBe(MOCK_PLATFORM_METRICS_DATA.metrics[0].value);
  });

  it("convertToCSV generates correct CSV string with headers and values", () => {
    const rows = formatMetricsForExport(MOCK_PLATFORM_METRICS_DATA);
    const csv = convertToCSV(rows);
    const lines = csv.split("\r\n");
    // First line is the header
    expect(lines[0]).toContain("ID");
    expect(lines[0]).toContain("Label");
    expect(lines[0]).toContain("Value");
    expect(lines[0]).toContain("Change (%)");
    expect(lines[0]).toContain("Unit");
    // Should have header + data rows
    expect(lines).toHaveLength(MOCK_PLATFORM_METRICS_DATA.metrics.length + 1);
  });

  it("convertToCSV returns just the header for empty rows array", () => {
    const csv = convertToCSV([]);
    expect(csv).not.toContain("\r\n");
  });

  it("downloadCSV creates an anchor element and triggers a click", () => {
    const appendSpy = vi.spyOn(document.body, "appendChild");
    const removeSpy = vi.spyOn(document.body, "removeChild");
    const createSpy = vi.spyOn(document, "createElement");

    const mockAnchor = {
      href: "",
      download: "",
      click: vi.fn(),
    } as unknown as HTMLAnchorElement;

    createSpy.mockReturnValueOnce(mockAnchor);

    // jsdom doesn't implement URL.createObjectURL — stub it
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => "blob:mock");
    URL.revokeObjectURL = vi.fn();

    downloadCSV("test-file.csv", "col1,col2\r\nval1,val2");

    expect(mockAnchor.download).toBe("test-file.csv");
    expect(mockAnchor.click).toHaveBeenCalledOnce();
    expect(appendSpy).toHaveBeenCalledWith(mockAnchor);
    expect(removeSpy).toHaveBeenCalledWith(mockAnchor);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");

    URL.createObjectURL = origCreate;
    URL.revokeObjectURL = origRevoke;
    createSpy.mockRestore();
    appendSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it("exportPlatformMetrics calls downloadCSV with a dated filename", () => {
    const appendSpy = vi.spyOn(document.body, "appendChild");
    const removeSpy = vi.spyOn(document.body, "removeChild");
    const createSpy = vi.spyOn(document, "createElement");

    const mockAnchor = {
      href: "",
      download: "",
      click: vi.fn(),
    } as unknown as HTMLAnchorElement;

    createSpy.mockReturnValueOnce(mockAnchor);

    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => "blob:mock2");
    URL.revokeObjectURL = vi.fn();

    exportPlatformMetrics(MOCK_PLATFORM_METRICS_DATA);

    expect(mockAnchor.download).toMatch(/^platform-metrics-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(mockAnchor.click).toHaveBeenCalledOnce();

    URL.createObjectURL = origCreate;
    URL.revokeObjectURL = origRevoke;
    createSpy.mockRestore();
    appendSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
