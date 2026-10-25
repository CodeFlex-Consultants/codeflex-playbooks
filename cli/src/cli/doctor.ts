import type { Command } from "commander";
import { buildContext } from "./context";
import { formatHumanReadable, formatJson } from "./output-formatter";
import { createReporterFromCommand, consoleReporter, type Reporter } from "./reporter";
import { SilentExitError } from "../utils/errors";
import { EXIT_CODE_ERRORS_FOUND } from "../constants";
import {
  loadDoctorCheckContext,
  runAllDoctorChecks,
  type DiagnosticFinding,
} from "./doctor-checks";
import { applyFix, type DoctorFixResult } from "./doctor-fixes";
import { formatDoctorJson, formatDoctorHumanReadable } from "./doctor-formatter";

export interface RunDoctorOptions {
  fix?: boolean;
  dryRun?: boolean;
  json?: boolean;
  yes?: boolean;
  reporter?: Reporter;
}

function hasUnresolvedErrors(
  findings: DiagnosticFinding[],
  fixResults: DoctorFixResult[],
  shouldFix: boolean,
  isDryRun: boolean,
): boolean {
  const hasErrors = findings.some((f) => f.severity === "error");

  if (!shouldFix || isDryRun) {
    return hasErrors;
  }

  return findings.some(
    (f) => f.severity === "error" && (!f.fixable || !fixResults.find((r) => r.check === f.check)?.success),
  );
}

export async function runDoctor(projectRoot: string, options: RunDoctorOptions = {}): Promise<void> {
  const reporter = options.reporter ?? consoleReporter;
  const shouldFix = options.fix ?? false;
  const isDryRun = options.dryRun ?? false;

  const checkContext = await loadDoctorCheckContext(projectRoot);
  const findings = await runAllDoctorChecks(checkContext);

  const fixResults: DoctorFixResult[] = [];
  if (shouldFix && !isDryRun) {
    for (const finding of findings) {
      if (!finding.fixable) continue;
      const result = await applyFix(projectRoot, finding, checkContext, { yes: options.yes ?? false });
      if (result) {
        fixResults.push(result);
      }
    }
  } else if (shouldFix && isDryRun) {
    for (const finding of findings) {
      if (!finding.fixable) continue;
      fixResults.push({
        check: finding.check,
        success: false,
        message: `[dry-run] Would fix: ${finding.message}`,
      });
    }
  }

  const hasErrors = findings.some((f) => f.severity === "error");
  const hasRemainingErrors = hasUnresolvedErrors(findings, fixResults, shouldFix, isDryRun);

  if (options.json) {
    reporter.info(formatJson(formatDoctorJson(findings, fixResults, hasErrors)));
  } else {
    reporter.info(formatHumanReadable(formatDoctorHumanReadable(findings, fixResults, hasErrors)));
  }

  if (hasRemainingErrors) {
    throw new SilentExitError(EXIT_CODE_ERRORS_FOUND);
  }
}

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Diagnose and fix common configuration issues")
    .option("--fix", "Auto-fix issues where possible")
    .option("--dry-run", "Show what would be fixed without making changes")
    .option("--json", "Output results as JSON")
    .option("--yes", "Skip confirmation prompts when fixing (required in non-interactive environments)")
    .action(async (options: { fix?: boolean; dryRun?: boolean; json?: boolean; yes?: boolean }, command: Command) => {
      const reporter = createReporterFromCommand(command);
      const context = await buildContext({ dryRun: options.dryRun });
      await runDoctor(context.projectRoot, { ...options, reporter });
    });
}
