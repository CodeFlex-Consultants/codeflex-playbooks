import type { Command } from "commander";
import { buildContext } from "./context";
import { formatHumanReadable, buildBootstrapStatusLines } from "./output-formatter";
import { loadConfig, loadLock, saveLock, skillsDir } from "../config/index";
import { installSkills } from "../skills/installer";
import { readCanonicalStore, readCanonicalSkillManifest } from "../skills/canonical-store";
import { isCrossCutting } from "../resolution/index";
import { cleanupSources } from "../skills/source-fetcher";
import { generateProjectionsAndFiles } from "./generate-projections";
import type { StandardsSource, ResolvedSkill } from "../types/index";
import { OutputStyle } from "../types/index";
import { assertCodeFlexIntegrity } from "../integrity/release-verifier";
import { createReporterFromCommand, consoleReporter, type Reporter } from "./reporter";
import { requireInitialized } from "./guards";
import { autoDetectHarnesses } from "./harness-autodetect";
import { findCodeFlexSource } from "./pipeline";
import { AGENTS_MD_FILENAME } from "../constants";
import { tryHandleGlobalFlagLazy } from "./global-flag-guard";
import {
  verifyClientSourceHashes,
  verifyRepositorySourceHashes,
} from "../integrity/source-hash-verifier";
import {
  buildSourcesFromCanonical,
  reFetchSources,
  inferSourceFromSkillId,
} from "../skills/source-rebuilder";

export interface RunSyncOptions {
  dryRun?: boolean;
  reporter?: Reporter;
  removeLegacy?: boolean;
}

export async function runSync(projectRoot: string, options: RunSyncOptions = {}): Promise<void> {
  const dryRun = options.dryRun ?? false;
  const reporter = options.reporter ?? consoleReporter;

  let [config, lock] = requireInitialized(
    await loadConfig(projectRoot),
    await loadLock(projectRoot),
  );

  config = await autoDetectHarnesses(projectRoot, config, reporter);

  if (dryRun) {
    reporter.info("Dry run - no changes made.");
    reporter.info(`Would sync ${lock.skills.length} skills.`);
    return;
  }

  const canonicalDir = skillsDir(projectRoot);
  const canonicalStore = await readCanonicalStore(projectRoot);
  const missingSkills = lock.skills.filter((slug) => !canonicalStore.has(slug));

  if (!lock.skillSources) {
    reporter.warn(
      "Warning: Lock file is missing 'skillSources'. Skill sources are being inferred from slug prefixes, which may be inaccurate. Run 'codeflex-playbooks update' to regenerate the lock file.",
    );
  }

  const resolvedSkills: ResolvedSkill[] = await Promise.all(
    lock.skills.map(async (slug) => {
      const manifest = await readCanonicalSkillManifest(projectRoot, slug);
      return {
        id: slug,
        slug,
        source: lock.skillSources?.[slug] ?? inferSourceFromSkillId(slug),
        crossCutting: manifest ? isCrossCutting({ metadata: manifest }) : undefined,
      };
    }),
  );

  let sources: StandardsSource[];
  let syncedCount: number;

  if (missingSkills.length === 0) {
    sources = buildSourcesFromCanonical(canonicalDir, lock);

    const codeflexSource = findCodeFlexSource(sources);
    if (codeflexSource) {
      await assertCodeFlexIntegrity(codeflexSource, lock);
    }

    verifyClientSourceHashes(sources, lock);
    verifyRepositorySourceHashes(sources, lock, projectRoot);

    reporter.info("Syncing skills...");
    syncedCount = lock.skills.length;
  } else {
    reporter.info(`Missing ${missingSkills.length} skills in canonical store, re-fetching...`);
    sources = await reFetchSources(config, lock, projectRoot);

    try {
      const codeflexSource = findCodeFlexSource(sources);
      if (codeflexSource) {
        await assertCodeFlexIntegrity(codeflexSource, lock);
      }

      verifyClientSourceHashes(sources, lock);
      await verifyRepositorySourceHashes(sources, lock, projectRoot);

      reporter.info("Syncing skills...");
      const installResult = await installSkills({
        projectRoot,
        resolvedSkills,
        sources,
        lock,
      });

      if (installResult.errors.length > 0) {
        reporter.error("Errors during sync:");
        for (const error of installResult.errors) {
          reporter.error(`  - ${error}`);
        }
      }

      syncedCount = installResult.installed.length;
    } finally {
      await cleanupSources(sources);
    }
  }

  const { topology, lock: finalLock } = await generateProjectionsAndFiles({
    projectRoot,
    config,
    resolvedSkills,
    skillIds: lock.skills,
    lock,
    previousProjections: lock.projections,
    previousManagedProjections: lock.managedProjections,
    reporter,
    removeLegacy: options.removeLegacy ?? false,
  });

  await saveLock(projectRoot, finalLock);

  const lines = [
    { indent: 0, text: "Sync complete!", style: OutputStyle.Success },
    { indent: 0, text: "" },
    { indent: 1, text: `Skills synced: ${syncedCount}` },
    { indent: 1, text: `Projections updated: ${topology.targets.length}` },
    { indent: 1, text: `${AGENTS_MD_FILENAME}: updated` },
    ...buildBootstrapStatusLines(config),
  ];

  reporter.info(formatHumanReadable(lines));
}

export function registerSyncCommand(program: Command): void {
  program
    .command("sync")
    .description("Sync project state from lock file")
    .option("--dry-run", "Show what would be done without making changes")
    .option("--global", "Sync the global ~/.agents/AGENTS.md instead of project-level")
    .option("--remove-legacy", "Remove legacy bootstrap files that have been replaced by new ones")
    .action(async (options: { dryRun?: boolean; global?: boolean; removeLegacy?: boolean }, command: Command) => {
      const reporter = createReporterFromCommand(command);
      const globalOpts = command.optsWithGlobals() as { projectRoot?: string };

      if (await tryHandleGlobalFlagLazy({ ...options, projectRoot: globalOpts.projectRoot }, reporter)) {
        return;
      }

      const context = await buildContext({ dryRun: options.dryRun });
      await runSync(context.projectRoot, { ...options, reporter });
    });
}
