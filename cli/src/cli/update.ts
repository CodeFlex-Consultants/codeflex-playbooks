import type { Command } from "commander";
import { buildContext } from "./context";
import { formatHumanReadable } from "./output-formatter";
import { loadConfig, saveLock, loadLock } from "../config/index";
import { detectProject } from "../detection/index";
import { generateProjectionsAndFiles } from "./generate-projections";
import { OutputStyle, SkillSource, type EngineeringLock } from "../types/index";
import { ClientStandardsDroppedError } from "../utils/errors";
import { assertCodeFlexIntegrity } from "../integrity/release-verifier";
import {
  fetchAllSources,
  loadAllSkills,
  resolveAndCheck,
} from "./pipeline";
import { buildLock } from "../config/lockfile-builder";
import { installSkills } from "../skills/installer";
import { cleanupSources } from "../skills/source-fetcher";
import { createReporterFromCommand, consoleReporter, type Reporter } from "./reporter";
import { requireInitialized, parseChannel } from "./guards";
import { autoDetectHarnesses } from "./harness-autodetect";

export interface RunUpdateOptions {
  dryRun?: boolean;
  channel?: string;
  force?: boolean;
  reporter?: Reporter;
}

export async function runUpdate(projectRoot: string, options: RunUpdateOptions = {}): Promise<void> {
  const reporter = options.reporter ?? consoleReporter;

  const channel = parseChannel(options.channel);

  let [config, lock] = requireInitialized(
    await loadConfig(projectRoot),
    await loadLock(projectRoot),
  );

  reporter.info("Detecting technologies...");
  const detection = await detectProject(projectRoot);

  config = await autoDetectHarnesses(projectRoot, config, reporter);

  const { codeflexSource, clientSourceList, repositorySourceList, sources } = await fetchAllSources({
    projectRoot,
    config,
    channel,
    reporter,
  });

  try {
    const codeflexChanged = codeflexSource.sha256 !== lock.sources.codeflex?.sha256;
    const clientChanged = clientSourceList.some((cs) => {
      const locked = lock.sources.client?.find((lc) => lc.id === cs.id);
      return !locked || locked.sha256 !== cs.sha256;
    });
    const repositoryChanged = repositorySourceList.some((rs) => {
      const locked = lock.sources.repository?.find((lr) => lr.id === rs.id);
      return !locked || locked.sha256 !== rs.sha256;
    });

    if (!codeflexChanged && !clientChanged && !repositoryChanged) {
      reporter.info("Already up to date.");
      return;
    }

    await assertCodeFlexIntegrity(codeflexSource, {
      version: 1,
      sources: {
        codeflex: {
          release: codeflexSource.release ?? "local",
          commit: codeflexSource.commit ?? "",
          sha256: codeflexSource.sha256,
        },
      },
      skills: [],
    } as EngineeringLock);

    reporter.info("Loading skills...");
    const { codeflexSkills, clientSkills, repositorySkills } = await loadAllSkills({
      codeflexSource,
      clientSourceList,
      repositorySourceList,
      config,
      reporter,
    });

    const lockedClientSkillIds = lock.skills.filter((id) =>
      id.startsWith("client-") || id.startsWith("repo-"),
    );

    const resolution = await resolveAndCheck({
      detection,
      config,
      codeflexSkills,
      clientSkills,
      repositorySkills,
      reporter,
    });

    const resolvedClientSkillIds = new Set(
      resolution.skills.filter((s) => s.source === SkillSource.Client || s.source === SkillSource.Repository).map((s) => s.slug),
    );
    const droppedClientSkills = lockedClientSkillIds.filter((id) => !resolvedClientSkillIds.has(id));

    if (droppedClientSkills.length > 0 && !options.force) {
      const unavailableSources = config.standards.client?.filter((cs) => {
        const fetched = clientSourceList.find((f) => f.id === cs.id);
        return !fetched;
      }) ?? [];

      if (unavailableSources.length > 0) {
        const names = unavailableSources.map((cs) => cs.id).join(", ");
        throw new ClientStandardsDroppedError(
          `Client source(s) ${names} no longer available. Cannot update without losing client standards.`,
          `Dropped skills: ${droppedClientSkills.join(", ")}`,
        );
      }

      reporter.warn("Warning: Client skills disappeared (detection mismatch):");
      for (const id of droppedClientSkills) {
        reporter.warn(`  - ${id}`);
      }
    }

    const currentSkills = new Set(lock.skills);
    const newSkills = new Set(resolution.skills.map((s) => s.slug));

    const added = resolution.skills.filter((s) => !currentSkills.has(s.slug));
    const removed = lock.skills.filter((id) => !newSkills.has(id));
    const unchanged = resolution.skills.filter((s) => currentSkills.has(s.slug));

    if (added.length === 0 && removed.length === 0) {
      reporter.info("Already up to date.");
      return;
    }

    if (options.dryRun) {
      reporter.info("\nDry run - no changes made.");
      reporter.info(`Would add ${added.length} skills.`);
      reporter.info(`Would remove ${removed.length} skills.`);
      reporter.info(`Would keep ${unchanged.length} skills.`);
      return;
    }

    const newLock = buildLock(codeflexSource, clientSourceList, repositorySourceList, resolution, channel);

    reporter.info("Installing skills...");
    const installResult = await installSkills({
      projectRoot,
      resolvedSkills: resolution.skills,
      sources,
      lock: newLock,
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
      lock: newLock,
      previousProjections: lock.projections,
      previousManagedProjections: lock.managedProjections,
      reporter,
    });

    await saveLock(projectRoot, finalLock);

    const lines = [
      { indent: 0, text: "Update complete!", style: OutputStyle.Success },
      { indent: 0, text: "" },
      { indent: 1, text: `Added: ${added.length}` },
      { indent: 1, text: `Removed: ${removed.length}` },
      { indent: 1, text: `Unchanged: ${unchanged.length}` },
      { indent: 1, text: `Projections: ${topology.targets.length}` },
    ];

    reporter.info(formatHumanReadable(lines));
  } finally {
    await cleanupSources(sources);
  }
}

export function registerUpdateCommand(program: Command): void {
  program
    .command("update")
    .description("Update skills to latest versions")
    .option("--dry-run", "Show what would be done without making changes")
    .option("--channel <channel>", "Release channel (stable or canary)")
    .option("--force", "Allow dropping client standards if they disappear during update")
    .action(async (options: { dryRun?: boolean; channel?: string; force?: boolean }, command: Command) => {
      const reporter = createReporterFromCommand(command);
      const context = await buildContext({ dryRun: options.dryRun });
      await runUpdate(context.projectRoot, { ...options, reporter });
    });
}
