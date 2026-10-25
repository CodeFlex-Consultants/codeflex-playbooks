import type { Command } from "commander";
import { buildContext } from "./context";
import { formatHumanReadable, type OutputLine } from "./output-formatter";
import { loadConfig, loadLock } from "../config/index";
import { OutputStyle, type EngineeringLock, type EngineeringConfig } from "../types/index";
import { runDetectionPipeline, type DetectionPipelineResult } from "./pipeline";
import { cleanupSources } from "../skills/source-fetcher";
import { createReporterFromCommand, consoleReporter, type Reporter } from "./reporter";
import { requireInitialized, parseChannel } from "./guards";
import { autoDetectHarnesses } from "./harness-autodetect";
import { calculateProjectionTopology, type ProjectionPlan } from "../projection/topology";
import { AGENTS_MD_FILENAME, CLI_NAME } from "../constants";
import { validateAgentsMd, validateBootstrapFiles } from "./validation-helpers";

export interface RunDiffOptions {
  channel?: string;
  reporter?: Reporter;
}

interface FileDiff {
  path: string;
  status: "added" | "modified" | "removed" | "unchanged";
  harness?: string;
}

interface SkillDiff {
  skillId: string;
  status: "added" | "removed" | "unchanged";
}

export async function runDiff(projectRoot: string, options: RunDiffOptions = {}): Promise<void> {
  const reporter = options.reporter ?? consoleReporter;

  const channel = parseChannel(options.channel);

  const [config, lock] = requireInitialized(
    await loadConfig(projectRoot),
    await loadLock(projectRoot),
  );

  let pipeline: DetectionPipelineResult | undefined;
  try {
    pipeline = await runDetectionPipeline(
      { projectRoot, config, channel, reporter },
      autoDetectHarnesses,
    );

    const skillDiffs = computeSkillDiffs(lock.skills, pipeline.resolution.skills);

    const topology = calculateProjectionTopology(pipeline.config.agentHarnesses);

    const fileDiffs = await computeFileDiffs(projectRoot, lock, pipeline.config, topology);

    const hasChanges = skillDiffs.some((s) => s.status !== "unchanged") ||
                       fileDiffs.some((f) => f.status !== "unchanged");

    reporter.info(formatDiffReport(skillDiffs, fileDiffs, hasChanges));
  } finally {
    if (pipeline) {
      await cleanupSources(pipeline.sources);
    }
  }
}

function computeSkillDiffs(
  lockedSkillIds: string[],
  resolvedSkills: readonly { slug: string; crossCutting?: boolean }[],
): SkillDiff[] {
  const currentSkills = new Set(lockedSkillIds);
  const newSkills = new Set(resolvedSkills.map((s) => s.slug));
  const diffs: SkillDiff[] = [];

  for (const skill of resolvedSkills) {
    diffs.push({ skillId: skill.slug, status: currentSkills.has(skill.slug) ? "unchanged" : "added" });
  }

  for (const skillId of lockedSkillIds) {
    if (!newSkills.has(skillId)) {
      diffs.push({ skillId, status: "removed" });
    }
  }

  return diffs;
}

async function computeFileDiffs(
  projectRoot: string,
  lock: EngineeringLock,
  config: EngineeringConfig,
  topology: ProjectionPlan,
): Promise<FileDiff[]> {
  const diffs: FileDiff[] = [];

  const [agentsMdValidation, bootstrapValidations] = await Promise.all([
    validateAgentsMd(projectRoot, lock),
    validateBootstrapFiles(projectRoot, config),
  ]);

  if (!agentsMdValidation.exists) {
    diffs.push({ path: AGENTS_MD_FILENAME, status: "added" });
  } else if (!agentsMdValidation.isCurrent) {
    diffs.push({ path: AGENTS_MD_FILENAME, status: "modified" });
  }

  for (const validation of bootstrapValidations) {
    if (!validation.exists) {
      diffs.push({ path: validation.bootstrapFile, status: "added", harness: validation.harness });
    } else if (!validation.isCurrent) {
      diffs.push({ path: validation.bootstrapFile, status: "modified", harness: validation.harness });
    }
  }

  computeProjectionDiffs(lock, topology, diffs);

  return diffs;
}

function computeProjectionDiffs(
  lock: EngineeringLock,
  topology: ProjectionPlan,
  diffs: FileDiff[],
): void {
  const currentProjections = new Map((lock.projections ?? []).map((p) => [p.path, p]));
  const newProjectionPaths = new Set(topology.targets.map((t) => t.path));

  for (const target of topology.targets) {
    const harnessInfo = target.satisfiesHarnesses.join(", ");
    const current = currentProjections.get(target.path);
    
    if (!current) {
      diffs.push({ path: target.path, status: "added", harness: harnessInfo });
    } else {
      const harnessesChanged = !arraysEqual(current.adapters, target.satisfiesHarnesses);
      diffs.push({ path: target.path, status: harnessesChanged ? "modified" : "unchanged", harness: harnessInfo });
    }
  }

  for (const projPath of currentProjections.keys()) {
    if (!newProjectionPaths.has(projPath)) {
      diffs.push({ path: projPath, status: "removed" });
    }
  }
}

function arraysEqual<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((val, idx) => val === sortedB[idx]);
}

function formatDiffReport(skillDiffs: SkillDiff[], fileDiffs: FileDiff[], hasChanges: boolean): string {
  const lines: OutputLine[] = [];

  if (!hasChanges) {
    lines.push({ indent: 0, text: "No changes detected.", style: OutputStyle.Success });
    lines.push({ indent: 0, text: "" });
    lines.push({ indent: 1, text: "The repository is up to date with the latest standards.", style: OutputStyle.Dim });
    return formatHumanReadable(lines);
  }

  lines.push({ indent: 0, text: "Changes detected:", style: OutputStyle.Bold });
  lines.push({ indent: 0, text: "" });

  const addedSkills = skillDiffs.filter((s) => s.status === "added");
  const removedSkills = skillDiffs.filter((s) => s.status === "removed");

  if (addedSkills.length > 0 || removedSkills.length > 0) {
    lines.push({ indent: 1, text: "Skills:", style: OutputStyle.Bold });

    for (const skill of addedSkills) {
      lines.push({ indent: 2, text: `+ ${skill.skillId}`, style: OutputStyle.Success });
    }

    for (const skill of removedSkills) {
      lines.push({ indent: 2, text: `- ${skill.skillId}`, style: OutputStyle.Error });
    }

    lines.push({ indent: 0, text: "" });
  }

  const addedFiles = fileDiffs.filter((f) => f.status === "added");
  const modifiedFiles = fileDiffs.filter((f) => f.status === "modified");
  const removedFiles = fileDiffs.filter((f) => f.status === "removed");

  if (addedFiles.length > 0 || modifiedFiles.length > 0 || removedFiles.length > 0) {
    lines.push({ indent: 1, text: "Files:", style: OutputStyle.Bold });

    for (const file of addedFiles) {
      const harnessInfo = file.harness ? ` (${file.harness})` : "";
      lines.push({ indent: 2, text: `+ ${file.path}${harnessInfo}`, style: OutputStyle.Success });
    }

    for (const file of modifiedFiles) {
      const harnessInfo = file.harness ? ` (${file.harness})` : "";
      lines.push({ indent: 2, text: `~ ${file.path}${harnessInfo}`, style: OutputStyle.Warning });
    }

    for (const file of removedFiles) {
      const harnessInfo = file.harness ? ` (${file.harness})` : "";
      lines.push({ indent: 2, text: `- ${file.path}${harnessInfo}`, style: OutputStyle.Error });
    }
  }

  lines.push({ indent: 0, text: "" });
  lines.push({ indent: 1, text: `Run '${CLI_NAME} update' to apply these changes.`, style: OutputStyle.Dim });

  return formatHumanReadable(lines);
}

export function registerDiffCommand(program: Command): void {
  program
    .command("diff")
    .description("Show what would change before running update")
    .option("--channel <channel>", "Release channel (stable or canary)")
    .action(async (options: { channel?: string }, command: Command) => {
      const reporter = createReporterFromCommand(command);
      const context = await buildContext({ dryRun: true });
      await runDiff(context.projectRoot, { ...options, reporter });
    });
}
