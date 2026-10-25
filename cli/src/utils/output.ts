import chalk from "chalk";
import type { Diagnostic } from "../types/index";
import { DiagnosticSeverity } from "../types/index";

export function formatDiagnostic(diag: Diagnostic): string {
  const prefix =
    diag.severity === DiagnosticSeverity.Error
      ? chalk.red("error")
      : diag.severity === DiagnosticSeverity.Warning
        ? chalk.yellow("warning")
        : chalk.gray("info");
  const msg = `${prefix}: ${diag.message} [${diag.code}]`;
  return diag.detail ? `${msg}\n  ${diag.detail}` : msg;
}

export function printDiagnostics(diagnostics: readonly Diagnostic[]): void {
  for (const diag of diagnostics) {
    if (diag.severity === DiagnosticSeverity.Error) {
      process.stderr.write(`${formatDiagnostic(diag)}\n`);
    } else {
      process.stdout.write(`${formatDiagnostic(diag)}\n`);
    }
  }
}

export function formatTable(headers: string[], rows: string[][]): string {
  const colWidths = headers.map((h, i) => {
    const maxDataWidth = rows.reduce((max, row) => {
      const cell = row[i] ?? "";
      return Math.max(max, cell.length);
    }, 0);
    return Math.max(h.length, maxDataWidth);
  });

  const formatRow = (cells: string[]): string =>
    cells.map((cell, i) => (cell ?? "").padEnd(colWidths[i] ?? 0)).join("  ");

  const headerLine = formatRow(headers);
  const separator = colWidths.map((w) => "─".repeat(w)).join("──");
  const dataLines = rows.map(formatRow);

  return [headerLine, separator, ...dataLines].join("\n");
}
