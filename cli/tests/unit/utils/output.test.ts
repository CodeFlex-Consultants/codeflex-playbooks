import { describe, it, expect } from "vitest";
import { formatDiagnostic, formatTable } from "../../../src/utils/output";
import type { Diagnostic } from "../../../src/types/index";

describe("formatDiagnostic", () => {
  it("formats error diagnostic", () => {
    const diag: Diagnostic = { severity: "error", code: "ERR_001", message: "something failed" };
    const result = formatDiagnostic(diag);
    expect(result).toContain("something failed");
    expect(result).toContain("ERR_001");
  });

  it("includes detail when present", () => {
    const diag: Diagnostic = { severity: "warning", code: "WARN_001", message: "watch out", detail: "more info" };
    const result = formatDiagnostic(diag);
    expect(result).toContain("more info");
  });
});

describe("formatTable", () => {
  it("formats headers and rows", () => {
    const result = formatTable(["Name", "Version"], [["dotnet", "8.0"], ["angular", "18.0"]]);
    const lines = result.split("\n");
    expect(lines).toHaveLength(4);
    expect(lines[0]).toContain("Name");
    expect(lines[0]).toContain("Version");
    expect(lines[1]).toContain("──");
    expect(lines[2]).toContain("dotnet");
    expect(lines[3]).toContain("angular");
  });

  it("pads columns to align", () => {
    const result = formatTable(["A", "B"], [["short", "x"], ["much longer value", "y"]]);
    const lines = result.split("\n");
    expect(lines[2]!.indexOf("x")).toBe(lines[3]!.indexOf("y"));
  });
});
