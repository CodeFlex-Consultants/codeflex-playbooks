import { OutputStyle } from "../types/index";
import type { OutputLine } from "./output-formatter";
import { CLI_NAME } from "../constants";
import type { DiagnosticFinding } from "./doctor-checks";
import type { DoctorFixResult } from "./doctor-fixes";

export function formatDoctorJson(
  findings: DiagnosticFinding[],
  fixResults: DoctorFixResult[],
  hasErrors: boolean,
): Record<string, unknown> {
  return {
    ok: !hasErrors,
    findings: findings.map((f) => ({
      check: f.check,
      severity: f.severity,
      message: f.message,
      fixable: f.fixable,
      ...(f.fixDescription ? { fixDescription: f.fixDescription } : {}),
    })),
    fixes: fixResults.map((f) => ({
      check: f.check,
      success: f.success,
      message: f.message,
    })),
    summary: {
      errors: findings.filter((f) => f.severity === "error").length,
      warnings: findings.filter((f) => f.severity === "warning").length,
      info: findings.filter((f) => f.severity === "info").length,
      fixed: fixResults.filter((f) => f.success).length,
    },
  };
}

export function formatDoctorHumanReadable(
  findings: DiagnosticFinding[],
  fixResults: DoctorFixResult[],
  hasErrors: boolean,
): OutputLine[] {
  const lines: OutputLine[] = [];

  lines.push({ indent: 0, text: "CodeFlex Playbooks Doctor", style: OutputStyle.Bold });
  lines.push({ indent: 0, text: "" });

  const errors = findings.filter((f) => f.severity === "error");
  const warnings = findings.filter((f) => f.severity === "warning");
  const infos = findings.filter((f) => f.severity === "info");

  if (findings.length === 0) {
    lines.push({ indent: 1, text: "No issues found!", style: OutputStyle.Success });
    return lines;
  }

  renderFindingGroup(lines, `Errors: ${errors.length}`, errors, OutputStyle.Error);
  renderFindingGroup(lines, `Warnings: ${warnings.length}`, warnings, OutputStyle.Warning);
  renderFindingGroup(lines, `Info: ${infos.length}`, infos, OutputStyle.Dim);

  if (fixResults.length > 0) {
    lines.push({ indent: 1, text: "Fixes applied:", style: OutputStyle.Bold });
    for (const result of fixResults) {
      if (result.success) {
        lines.push({ indent: 2, text: result.message, style: OutputStyle.Success });
      } else {
        lines.push({ indent: 2, text: result.message, style: OutputStyle.Warning });
      }
    }
    lines.push({ indent: 0, text: "" });
  }

  if (hasErrors) {
    const fixableCount = findings.filter((f) => f.severity === "error" && f.fixable).length;
    if (fixableCount > 0) {
      lines.push({ indent: 1, text: `${fixableCount} error${fixableCount === 1 ? "" : "s"} can be fixed with --fix`, style: OutputStyle.Dim });
    } else {
      lines.push({ indent: 1, text: `Run '${CLI_NAME} sync' to fix issues.`, style: OutputStyle.Dim });
    }
  }

  return lines;
}

export function renderFindingGroup(
  lines: OutputLine[],
  label: string,
  findings: DiagnosticFinding[],
  style: OutputStyle,
): void {
  if (findings.length === 0) return;

  lines.push({ indent: 1, text: label, style });
  for (const finding of findings) {
    lines.push({ indent: 2, text: finding.message, style });
    if (finding.fixable && finding.fixDescription) {
      lines.push({ indent: 3, text: `Fix: ${finding.fixDescription}`, style: OutputStyle.Dim });
    } else if (finding.fixDescription) {
      lines.push({ indent: 3, text: `Suggestion: ${finding.fixDescription}`, style: OutputStyle.Dim });
    }
  }
  lines.push({ indent: 0, text: "" });
}
