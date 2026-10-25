import type { Command } from "commander";
import { buildContext } from "./context";
import { formatHumanReadable, buildBootstrapStatusLines } from "./output-formatter";
import { detectProject } from "../detection/index";
import { detectHarnesses } from "../detection/harness/index";
import { saveConfig, saveLock, createDefaultConfig, loadConfig, codeflexDir } from "../config/index";
import { getOrgDefaultHarnesses } from "../config/org-defaults";
import { installSkills } from "../skills/installer";
import { generateProjectionsAndFiles } from "./generate-projections";
import { pathExists } from "../utils/fs";
import { OutputStyle } from "../types/index";
import { ConfigValidationError } from "../utils/errors";
import { parseChannel } from "./guards";
import {
  fetchAllSources,
  runPostFetchPipeline,
} from "./pipeline";
import { buildLock } from "../config/lockfile-builder";
import { cleanupSources } from "../skills/source-fetcher";
import type { OutputLine } from "./output-formatter";
import { createReporterFromCommand, consoleReporter, type Reporter } from "./reporter";
import { checkDeprecations, formatDeprecationReport, hasDeprecationErrors } from "../deprecation/index";
import { CLI_NAME, AGENTS_MD_FILENAME } from "../constants";
import { tryHandleGlobalFlagLazy } from "./global-flag-guard";

export interface RunInitOptions {
  dryRun?: boolean;
  force?: boolean;
  channel?: string;
  reporter?: Reporter;
  suppressDeprecations?: boolean;
  removeLegacy?: boolean;
}

export async function runInit(projectRoot: string, options: RunInitOptions = {}): Promise<void> {
  const dryRun = options.dryRun ?? false;
  const reporter = options.reporter ?? consoleReporter;

  const channel = parseChannel(options.channel);

  const codeflexDirPath = codeflexDir(projectRoot);
  const alreadyInitialized = await pathExists(codeflexDirPath);

  if (alreadyInitialized && !options.force) {
    throw new ConfigValidationError("Already initialized. Use --force to reinitialize.");
  }

  if (alreadyInitialized && options.force) {
    reporter.info("Reinitializing (force mode)...");
  }

  reporter.info("Detecting technologies...");
  const detection = await detectProject(projectRoot);

  if (detection.technologies.length === 0) {
    reporter.warn("Warning: No technologies detected.");
  }

  const orgDefaults = await getOrgDefaultHarnesses();
  let preliminaryConfig: Awaited<ReturnType<typeof loadConfig>> | undefined;
  if (alreadyInitialized) {
    try {
      preliminaryConfig = await loadConfig(projectRoot);
    } catch (error) {
      if (options.force) {
        reporter.warn("Existing configuration is invalid; regenerating from defaults.");
      } else {
        throw error;
      }
    }
  }
  const autoDetect = preliminaryConfig?.autoDetect ?? true;

  let harnessResults: Awaited<ReturnType<typeof detectHarnesses>>;
  if (autoDetect) {
    reporter.info("Detecting harnesses...");
    harnessResults = await detectHarnesses(projectRoot);

    if (harnessResults.length > 0) {
      const detectedSummary = harnessResults
        .map((r) => `${r.harness} (${r.confidence})`)
        .join(", ");
      reporter.info(`Detected harnesses: ${detectedSummary}`);
    } else {
      reporter.info("No harnesses detected, using defaults.");
    }
  } else {
    reporter.info("Harness auto-detection disabled, using org defaults.");
    harnessResults = [];
  }

  const config = createDefaultConfig(detection, harnessResults, orgDefaults);

  const prefilledSummary = config.agentHarnesses.join(", ");
  reporter.info(`Pre-filled agentHarnesses: ${prefilledSummary}`);

  if (!options.suppressDeprecations) {
    const deprecationReport = await checkDeprecations({ projectRoot });
    if (deprecationReport.hasIssues) {
      reporter.warn(formatDeprecationReport(deprecationReport));
      if (hasDeprecationErrors(deprecationReport)) {
        reporter.warn(`Run '${CLI_NAME} sync' to resolve deprecation issues.`);
      }
    }
  }

  const { codeflexSource, clientSourceList, repositorySourceList, sources } = await fetchAllSources({
    projectRoot,
    config,
    channel,
    reporter,
  });

  try {
    const { resolution } = await runPostFetchPipeline({
      codeflexSource,
      clientSourceList,
      repositorySourceList,
      detection,
      config,
      reporter,
    });

    if (dryRun) {
      reporter.info("\nDry run - no changes made.");
      reporter.info(`Would install ${resolution.skills.length} skills.`);
      return;
    }

    reporter.info("Saving configuration...");
    await saveConfig(projectRoot, config);

    const lock = buildLock(codeflexSource, clientSourceList, repositorySourceList, resolution, channel);

    reporter.info("Installing skills...");
    const installResult = await installSkills({
      projectRoot,
      resolvedSkills: resolution.skills,
      sources,
      lock,
      force: options.force,
    });

    if (installResult.errors.length > 0) {
      reporter.error("Errors during installation:");
      for (const error of installResult.errors) {
        reporter.error(`  - ${error}`);
      }
    }

    const currentSkillIds = resolution.skills.map((s) => s.slug);

    const { topology, lock: finalLock } = await generateProjectionsAndFiles({
      projectRoot,
      config,
      resolvedSkills: resolution.skills,
      skillIds: currentSkillIds,
      lock,
      reporter,
      removeLegacy: options.removeLegacy ?? false,
    });

    await saveLock(projectRoot, finalLock);

    const lines: OutputLine[] = [
      { indent: 0, text: "Initialization complete!", style: OutputStyle.Success },
      { indent: 0, text: "" },
      { indent: 1, text: `Skills installed: ${installResult.installed.length}` },
      { indent: 1, text: `Projections created: ${topology.targets.length}` },
      { indent: 1, text: `${AGENTS_MD_FILENAME}: updated` },
      ...buildBootstrapStatusLines(config),
    ];

    reporter.info(formatHumanReadable(lines));
  } finally {
    await cleanupSources(sources);
  }
}

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize CodeFlex Playbooks in the current project")
    .option("--dry-run", "Show what would be done without making changes")
    .option("--force", "Force initialization even if already initialized")
    .option("--channel <channel>", "Release channel (stable or canary)")
    .option("--global", "Initialize the global ~/.agents/AGENTS.md instead of project-level")
    .option("--suppress-deprecations", "Suppress deprecation warnings (not recommended)")
    .option("--remove-legacy", "Remove legacy bootstrap files that have been replaced by new ones")
    .action(async (options: { dryRun?: boolean; force?: boolean; channel?: string; global?: boolean; suppressDeprecations?: boolean; removeLegacy?: boolean }, command: Command) => {
      const reporter = createReporterFromCommand(command);
      const globalOpts = command.optsWithGlobals() as { projectRoot?: string };

      if (await tryHandleGlobalFlagLazy({ ...options, projectRoot: globalOpts.projectRoot }, reporter)) {
        return;
      }

      const context = await buildContext({ dryRun: options.dryRun, projectRoot: globalOpts.projectRoot });
      await runInit(context.projectRoot, { ...options, reporter });
    });
}
