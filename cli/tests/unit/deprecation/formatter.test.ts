import { describe, it, expect } from "vitest";
import {
  formatDeprecationReport,
  formatDeprecationsClassified,
} from "../../../src/deprecation/formatter";
import { DeprecationCategory, DeprecationSeverity, type DeprecationCheckResult, type DeprecationReport } from "../../../src/deprecation/types";

function makeResult(overrides: Partial<DeprecationCheckResult["entry"]> = {}): DeprecationCheckResult {
  return {
    entry: {
      id: "TEST_DEPRECATION",
      category: DeprecationCategory.DirectoryStructure,
      severity: DeprecationSeverity.Warning,
      title: "Test deprecation",
      description: "This is a test deprecation.",
      replacement: "Use the new format instead.",
      detect: async () => true,
      ...overrides,
    },
    detected: true,
  };
}

function makeReport(results: DeprecationCheckResult[]): DeprecationReport {
  const warnings = results.filter(
    (r) => r.detected && r.entry.severity === DeprecationSeverity.Warning,
  );
  const errors = results.filter(
    (r) => r.detected && r.entry.severity === DeprecationSeverity.Error,
  );
  return {
    results,
    warnings,
    errors,
    hasIssues: warnings.length > 0 || errors.length > 0,
  };
}

describe("deprecation formatter", () => {
  describe("formatDeprecationsClassified", () => {
    it("classifies errors as issues in strict mode", () => {
      const report = makeReport([
        makeResult({ severity: DeprecationSeverity.Error, id: "ERR_1" }),
      ]);
      const result = formatDeprecationsClassified(report, true);
      expect(result.issues).toHaveLength(1);
      expect(result.warnings).toHaveLength(0);
      expect(result.issues[0]).toContain("[DEPRECATION]");
      expect(result.issues[0]).toContain("Test deprecation");
    });

    it("always classifies errors as issues, even in non-strict mode", () => {
      const report = makeReport([
        makeResult({ severity: DeprecationSeverity.Error, id: "ERR_1" }),
      ]);
      const result = formatDeprecationsClassified(report, false);
      expect(result.issues).toHaveLength(1);
      expect(result.warnings).toHaveLength(0);
    });

    it("promotes warnings to issues only in strict mode", () => {
      const report = makeReport([makeResult()]);
      const strictResult = formatDeprecationsClassified(report, true);
      const nonStrictResult = formatDeprecationsClassified(report, false);
      expect(strictResult.issues).toHaveLength(1);
      expect(strictResult.warnings).toHaveLength(0);
      expect(nonStrictResult.issues).toHaveLength(0);
      expect(nonStrictResult.warnings).toHaveLength(1);
    });

    it("handles mixed errors and warnings", () => {
      const report = makeReport([
        makeResult({ severity: DeprecationSeverity.Error, id: "ERR_1" }),
        makeResult({ severity: DeprecationSeverity.Warning, id: "WARN_1" }),
      ]);
      const strictResult = formatDeprecationsClassified(report, true);
      expect(strictResult.issues).toHaveLength(2);
      expect(strictResult.warnings).toHaveLength(0);

      const nonStrictResult = formatDeprecationsClassified(report, false);
      expect(nonStrictResult.issues).toHaveLength(1);
      expect(nonStrictResult.warnings).toHaveLength(1);
    });

    it("returns empty arrays for clean report", () => {
      const report = makeReport([]);
      const result = formatDeprecationsClassified(report, true);
      expect(result.issues).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe("formatDeprecationReport", () => {
    it("returns empty string for a report with no issues", () => {
      const report = makeReport([]);
      const output = formatDeprecationReport(report);
      expect(output).toBe("");
    });

    it("formats a report with warnings", () => {
      const report = makeReport([makeResult()]);
      const output = formatDeprecationReport(report);
      expect(output).toContain("Deprecation warnings");
      expect(output).toContain("1 issue(s) found");
      expect(output).toContain("Test deprecation");
    });

    it("formats a report with errors", () => {
      const report = makeReport([
        makeResult({ severity: DeprecationSeverity.Error, id: "ERR_1" }),
      ]);
      const output = formatDeprecationReport(report);
      expect(output).toContain("[ERROR]");
    });

    it("formats a report with both warnings and errors", () => {
      const report = makeReport([
        makeResult({ severity: DeprecationSeverity.Error, id: "ERR_1" }),
        makeResult({ severity: DeprecationSeverity.Warning, id: "WARN_1" }),
      ]);
      const output = formatDeprecationReport(report);
      expect(output).toContain("[ERROR]");
      expect(output).toContain("[WARN]");
      expect(output).toContain("2 issue(s) found");
    });
  });
});
