import type { Command } from "commander";
import { buildContext } from "./context";
import { formatHumanReadable, type OutputLine } from "./output-formatter";
import { SilentExitError } from "../utils/errors";
import { OutputStyle } from "../types/index";
import { createReporterFromCommand, consoleReporter, type Reporter } from "./reporter";
import { detectHarnesses } from "../detection/harness/index";
import { filterHighMediumHarnesses } from "../config/index";
import { requireInitialized } from "./guards";
import { loadConfig, loadLock } from "../config/index";
import { checkDeprecations, formatDeprecationsClassified, type DeprecationReport } from "../deprecation/index";
import { CLI_NAME } from "../constants";
import { runProjectValidations } from "./project-validations";

export interface RunCheckOptions {
  strict?: boolean;
  reporter?: Reporter;
  checkDeprecations?: boolean;
}

export async function runCheck(projectRoot: string, options: RunCheckOptions = {}): Promise<void> {
  const reporter = options.reporter ?? consoleReporter;

  const [config, lock] = requireInitialized(
    await loadConfig(projectRoot),
    await loadLock(projectRoot),
  );

  const issues: string[] = [];
  const warnings: string[] = [];

  if (options.checkDeprecations) {
    const deprecationReport: DeprecationReport = await checkDeprecations({ projectRoot });
    const formatted = formatDeprecationsClassified(deprecationReport, options.strict ?? false);
    issues.push(...formatted.issues);
    warnings.push(...formatted.warnings);
  }

  const validations = await runProjectValidations(projectRoot);

  if (!validations.lockfileConsistency.consistent) {
    issues.push("Lockfile is inconsistent with config");
    for (const error of validations.lockfileConsistency.errors) {
      issues.push(`  - ${error}`);
    }
  }

  for (const warning of validations.lockfileConsistency.warnings) {
    warnings.push(warning);
  }

  if (validations.skills.missing.length > 0) {
    issues.push(`Missing skills: ${validations.skills.missing.join(", ")}`);
  }

  if (validations.skills.extra.length > 0) {
    warnings.push(`Extra skills in canonical store: ${validations.skills.extra.join(", ")}`);
  }

  for (const mismatch of validations.skills.hashMismatches) {
    issues.push(`Skill hash mismatch: ${mismatch.skillId} (expected ${mismatch.expected}, got ${mismatch.actual})`);
  }

  if (validations.projections.missing > 0) {
    issues.push(`Missing projections: ${validations.projections.missing}`);
  }
  if (validations.projections.stale > 0) {
    issues.push(`Stale projections: ${validations.projections.stale}`);
  }
  if (validations.projections.unexpected > 0) {
    warnings.push(`Unexpected projections: ${validations.projections.unexpected}`);
  }

  if (!validations.agentsMd.exists) {
    issues.push("AGENTS.md is missing");
  } else if (!validations.agentsMd.isCurrent) {
    issues.push("AGENTS.md managed section is out of date");
  }

  for (const validation of validations.bootstrapFiles) {
    if (validation.legacyExists && validation.legacyFile) {
      warnings.push(`Legacy bootstrap file ${validation.legacyFile} found; run '${CLI_NAME} sync' to migrate to ${validation.bootstrapFile} (${validation.harness} harness)`);
    }
    
    if (!validation.exists && !validation.legacyExists) {
      issues.push(`${validation.bootstrapFile} is missing (${validation.harness} harness configured)`);
    } else if (validation.exists && !validation.isCurrent) {
      issues.push(`${validation.bootstrapFile} is out of date (${validation.harness} harness)`);
    }
  }

  const detectedHarnesses = await detectHarnesses(projectRoot);
  const configuredSet = new Set(config.agentHarnesses);
  const detectedHighMedium = new Set(filterHighMediumHarnesses(detectedHarnesses));

  for (const harness of detectedHighMedium) {
    if (!configuredSet.has(harness)) {
      warnings.push(
        `${harness} appears to be installed but isn't in agentHarnesses`,
      );
    }
  }

  for (const harness of config.agentHarnesses) {
    if (!detectedHighMedium.has(harness)) {
      warnings.push(`${harness} is configured but wasn't detected`);
    }
  }

  if (issues.length === 0 && (warnings.length === 0 || !options.strict)) {
    const lines: OutputLine[] = [
      { indent: 0, text: "Check passed!", style: OutputStyle.Success },
      { indent: 0, text: "" },
      { indent: 1, text: `Skills: ${lock.skills.length} installed` },
      { indent: 1, text: `Projections: ${(lock.projections ?? []).length} configured` },
      { indent: 1, text: `AGENTS.md: ${validations.agentsMd.exists ? "present" : "missing"}` },
    ];

    if (warnings.length > 0) {
      lines.push({ indent: 0, text: "" });
      lines.push({ indent: 1, text: `Warnings: ${warnings.length}`, style: OutputStyle.Warning });
      for (const warning of warnings) {
        lines.push({ indent: 2, text: warning, style: OutputStyle.Dim });
      }
    }

    reporter.info(formatHumanReadable(lines));
    return;
  } else {
    const lines: OutputLine[] = [
      { indent: 0, text: "Check failed!", style: OutputStyle.Error },
      { indent: 0, text: "" },
    ];

    if (issues.length > 0) {
      lines.push({ indent: 1, text: `Issues: ${issues.length}`, style: OutputStyle.Error });
      for (const issue of issues) {
        lines.push({ indent: 2, text: issue });
      }
    }

    if (warnings.length > 0) {
      lines.push({ indent: 0, text: "" });
      lines.push({ indent: 1, text: `Warnings: ${warnings.length}`, style: OutputStyle.Warning });
      for (const warning of warnings) {
        lines.push({ indent: 2, text: warning, style: OutputStyle.Dim });
      }
    }

    lines.push({ indent: 0, text: "" });
    lines.push({ indent: 1, text: `Run '${CLI_NAME} sync' to fix issues.`, style: OutputStyle.Dim });

    reporter.info(formatHumanReadable(lines));
    throw new SilentExitError(2);
  }
}

export function registerCheckCommand(program: Command): void {
  program
    .command("check")
    .description("Check if project state matches lock file")
    .option("--strict", "Treat warnings as errors")
    .option("--check-deprecations", "Also check for deprecated configurations")
    .action(async (options: { strict?: boolean; checkDeprecations?: boolean }, command: Command) => {
      const reporter = createReporterFromCommand(command);
      const globalOpts = command.optsWithGlobals() as { projectRoot?: string };
      const context = await buildContext({ projectRoot: globalOpts.projectRoot });
      await runCheck(context.projectRoot, { ...options, reporter, checkDeprecations: options.checkDeprecations });
    });
}
