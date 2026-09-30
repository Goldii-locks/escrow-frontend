import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CONTRACT_PAUSE_EXPORT_HEADERS,
  buildContractPauseCsv,
  buildContractPauseSummaryRow,
  contractPauseExportFilename,
  escapeContractPauseCsvCell,
  exportContractPauseHistory,
  handleContractPauseExport,
  toContractPauseExportRows,
  type ContractPauseExportRow,
} from "@/app/lib/contract_pause_switch_export";
import {
  MOCK_CONTRACT_PAUSE_STATE,
  MOCK_CONTRACT_PAUSE_TRANSITIONS,
} from "@/app/lib/contract_pause_switch";

const ROWS: ContractPauseExportRow[] = [
  {
    id: "pause-002",
    at: "2026-09-24T18:42:00Z",
    by: "GADMIN3XQ7LKZP4V2M6YB9WDHRTC5FJN8AUE2HSVG6KCDY",
    to: "frozen",
    reason: "Payout indexer reports duplicate release events for milestone 3.",
  },
  {
    id: "pause-001",
    at: "2026-09-21T07:15:00Z",
    by: "GADMIN3XQ7LKZP4V2M6YB9WDHRTC5FJN8AUE2HSVG6KCDY",
    to: "active",
    reason: "Freeze lifted after the entrypoint upgrade completed.",
  },
];

describe("contract_pause_switch export (#477)", () => {
  beforeEach(() => {
    // jsdom has no object-URL or click implementation, so both are stubbed and
    // the blob they receive is captured for assertion.
    URL.createObjectURL = vi.fn().mockReturnValue("blob:mock");
    URL.revokeObjectURL = vi.fn();
    HTMLAnchorElement.prototype.click = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("cell escaping", () => {
    it("escapes commas, quotes and newlines per RFC 4180", () => {
      expect(escapeContractPauseCsvCell('a,"b"')).toBe('"a,""b"""');
      expect(escapeContractPauseCsvCell("line1\nline2")).toBe('"line1\nline2"');
      expect(escapeContractPauseCsvCell("has,comma")).toBe('"has,comma"');
    });

    it("neutralises spreadsheet formula injection", () => {
      expect(escapeContractPauseCsvCell("=SUM(A1)")).toBe("'=SUM(A1)");
      expect(escapeContractPauseCsvCell("@cmd")).toBe("'@cmd");
      expect(escapeContractPauseCsvCell("+1")).toBe("'+1");
      expect(escapeContractPauseCsvCell("-1")).toBe("'-1");
    });

    it("renders nullish values as empty cells", () => {
      expect(escapeContractPauseCsvCell(undefined)).toBe("");
      expect(escapeContractPauseCsvCell(null)).toBe("");
    });

    it("leaves plain values untouched", () => {
      expect(escapeContractPauseCsvCell("frozen")).toBe("frozen");
      expect(escapeContractPauseCsvCell(42)).toBe("42");
    });
  });

  describe("csv formatting", () => {
    it("writes the header row", () => {
      expect(CONTRACT_PAUSE_EXPORT_HEADERS.join(",")).toBe(
        "Transition ID,At,By,To,Reason",
      );
      expect(buildContractPauseCsv([])).toBe(
        "Transition ID,At,By,To,Reason",
      );
    });

    it("writes correct cell values for each transition", () => {
      const [header, first, second] = buildContractPauseCsv(ROWS).split("\r\n");

      expect(header).toBe("Transition ID,At,By,To,Reason");
      expect(first).toBe(
        "pause-002,2026-09-24T18:42:00Z,GADMIN3XQ7LKZP4V2M6YB9WDHRTC5FJN8AUE2HSVG6KCDY,frozen,Payout indexer reports duplicate release events for milestone 3.",
      );
      expect(second).toBe(
        "pause-001,2026-09-21T07:15:00Z,GADMIN3XQ7LKZP4V2M6YB9WDHRTC5FJN8AUE2HSVG6KCDY,active,Freeze lifted after the entrypoint upgrade completed.",
      );
    });

    it("quotes a reason containing a comma", () => {
      const csv = buildContractPauseCsv([
        { ...ROWS[0], reason: "Indexer lag, milestone 3" },
      ]);
      expect(csv.split("\r\n")[1]).toBe(
        'pause-002,2026-09-24T18:42:00Z,GADMIN3XQ7LKZP4V2M6YB9WDHRTC5FJN8AUE2HSVG6KCDY,frozen,"Indexer lag, milestone 3"',
      );
    });

    it("emits one CRLF-delimited line per row", () => {
      const csv = buildContractPauseCsv(ROWS);
      expect(csv.split("\r\n")).toHaveLength(ROWS.length + 1);
    });
  });

  describe("row projection", () => {
    it("maps transitions onto export rows", () => {
      const rows = toContractPauseExportRows(MOCK_CONTRACT_PAUSE_TRANSITIONS);
      expect(rows).toHaveLength(MOCK_CONTRACT_PAUSE_TRANSITIONS.length);
      expect(rows[0]).toEqual({
        id: "pause-002",
        at: "2026-09-24T18:42:00Z",
        by: "GADMIN3XQ7LKZP4V2M6YB9WDHRTC5FJN8AUE2HSVG6KCDY",
        to: "frozen",
        reason: MOCK_CONTRACT_PAUSE_TRANSITIONS[0].reason,
      });
    });

    it("projects the current state as a summary row", () => {
      const row = buildContractPauseSummaryRow(MOCK_CONTRACT_PAUSE_STATE);
      expect(row).toEqual({
        id: MOCK_CONTRACT_PAUSE_STATE.contractId,
        at: MOCK_CONTRACT_PAUSE_STATE.updatedAt,
        by: MOCK_CONTRACT_PAUSE_STATE.updatedBy,
        to: "frozen",
        reason: MOCK_CONTRACT_PAUSE_STATE.reason,
      });
    });

    it("summarises an unfrozen contract as active", () => {
      const row = buildContractPauseSummaryRow({
        ...MOCK_CONTRACT_PAUSE_STATE,
        paused: false,
      });
      expect(row.to).toBe("active");
    });
  });

  describe("filenames", () => {
    it("builds a dated filename", () => {
      expect(contractPauseExportFilename(new Date("2026-09-28T10:00:00Z"))).toBe(
        "contract-pause-history-2026-09-28.csv",
      );
    });
  });

  describe("download handler", () => {
    it("triggers a download containing the csv bytes", async () => {
      const created: Blob[] = [];
      URL.createObjectURL = vi.fn((blob: Blob) => {
        created.push(blob);
        return "blob:mock";
      });

      const handled = handleContractPauseExport(ROWS);

      expect(handled).toBe(true);
      expect(created).toHaveLength(1);
      // A BOM is prepended so Excel opens the UTF-8 text correctly. Read the
      // raw bytes for that: `Blob.text()` UTF-8-decodes, which strips the BOM
      // per spec, so the decoded string is the CSV on its own.
      const bytes = new Uint8Array(await created[0].arrayBuffer());
      expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);
      expect(await created[0].text()).toBe(buildContractPauseCsv(ROWS));
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");
    });

    it("sets a csv mime type on the blob", () => {
      const created: Blob[] = [];
      URL.createObjectURL = vi.fn((blob: Blob) => {
        created.push(blob);
        return "blob:mock";
      });

      handleContractPauseExport(ROWS);

      expect(created[0].type).toBe("text/csv;charset=utf-8;");
    });

    it("downloads under the supplied filename and leaves no anchor behind", () => {
      const anchors: HTMLAnchorElement[] = [];
      const spy = vi
        .spyOn(HTMLAnchorElement.prototype, "click")
        .mockImplementation(function (this: HTMLAnchorElement) {
          anchors.push(this);
        });

      handleContractPauseExport(ROWS, "freeze.csv");

      expect(spy).toHaveBeenCalled();
      expect(anchors[0].download).toBe("freeze.csv");
      // The anchor is appended only long enough to be clickable.
      expect(document.body.contains(anchors[0])).toBe(false);
    });

    it("refuses to download with no rows", () => {
      expect(handleContractPauseExport([])).toBe(false);
      expect(URL.createObjectURL).not.toHaveBeenCalled();
    });
  });

  describe("panel-bound export handler", () => {
    it("exports the panel's transition log", async () => {
      const created: Blob[] = [];
      URL.createObjectURL = vi.fn((blob: Blob) => {
        created.push(blob);
        return "blob:mock";
      });

      const handled = exportContractPauseHistory(MOCK_CONTRACT_PAUSE_TRANSITIONS);

      expect(handled).toBe(true);
      // `text()` strips the BOM, so compare against the CSV directly.
      expect(await created[0].text()).toBe(
        buildContractPauseCsv(toContractPauseExportRows(MOCK_CONTRACT_PAUSE_TRANSITIONS)),
      );
    });

    it("accepts a custom filename", () => {
      exportContractPauseHistory(MOCK_CONTRACT_PAUSE_TRANSITIONS, "history.csv");
      expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
    });

    it("returns false for an empty history", () => {
      expect(exportContractPauseHistory([])).toBe(false);
    });
  });
});