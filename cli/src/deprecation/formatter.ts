import { OutputStyle } from "../types/index";
import type { DeprecationCheckResult, DeprecationReport } from "./types";
import { formatHumanReadable, type OutputLine } from "../cli/output-formatter";

const SEVERITY_LABEL_ERROR = "ERROR";
const SEVERITY_LABEL_WARN = "WARN";

function formatDeprecationEntry(result: DeprecationCheckResult): string {
  return `[DEPRECATION] ${result.entry.title}: ${result.entry.description}`;
}

export interface FormattedDeprecations {
  issues: string[];
  warnings: string[];
}

/**
 * Formats a deprecation report into issues and warnings arrays.
 * Error-severity results are always classified as issues. When strictMode is
 * true, warning-severity results are additionally promoted to issues;
 * otherwise they remain warnings.
 */
export function formatDeprecationsClassified(
  report: DeprecationReport,
  strictMode: boolean,
): FormattedDeprecations {
  const issues: string[] = [];
  const warnings: string[] = [];

  for (const result of report.errors) {
    issues.push(formatDeprecationEntry(result));
  }
  for (const result of report.warnings) {
    if (strictMode) {
      issues.push(formatDeprecationEntry(result));
    } else {
      warnings.push(formatDeprecationEntry(result));
    }
  }

  return { issues, warnings };
}

export function formatDeprecationReport(report: DeprecationReport): string {
  if (!report.hasIssues) {
    return "";
  }

  const lines: OutputLine[] = [];

  lines.push({ indent: 0, text: "" });
  lines.push({
    indent: 0,
    text: `Deprecation warnings: ${report.warnings.length + report.errors.length} issue(s) found`,
    style: report.errors.length > 0 ? OutputStyle.Error : OutputStyle.Warning,
  });

  appendResultLines(lines, report.errors, SEVERITY_LABEL_ERROR, OutputStyle.Error);
  appendResultLines(lines, report.warnings, SEVERITY_LABEL_WARN, OutputStyle.Warning);

  return formatHumanReadable(lines);
}

function buildResultLines(
  result: DeprecationCheckResult,
  label: string,
  baseIndent: number,
  titleStyle?: OutputStyle,
): OutputLine[] {
  const { entry } = result;
  const lines: OutputLine[] = [
    { indent: baseIndent, text: `[${label}] ${entry.title}`, style: titleStyle },
    { indent: baseIndent + 1, text: entry.description },
    { indent: baseIndent + 1, text: `Replacement: ${entry.replacement}`, style: OutputStyle.Success },
  ];

  if (entry.migrationCommand) {
    lines.push({ indent: baseIndent + 1, text: `Migration: ${entry.migrationCommand}`, style: OutputStyle.Bold });
  }

  return lines;
}

function appendResultLines(
  lines: OutputLine[],
  results: DeprecationCheckResult[],
  label: string,
  style: OutputStyle,
): void {
  for (const result of results) {
    lines.push({ indent: 1, text: "", style });
    lines.push(...buildResultLines(result, label, 1, style));
  }
}
