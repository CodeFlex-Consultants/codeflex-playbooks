import { calculateProjectionTopology } from "../projection/topology";
import type { ProjectionPlan } from "../projection/topology";
import { projectSkills } from "../projection/projector";
import { generateScopedRules, cleanStaleScopedRules } from "../projection/scoped-rules";
import { cleanStaleProjections } from "../projection/stale-cleaner";
import { normalizeAgentsMd } from "../agents-md/normalizer";
import { generateAllBootstrapFiles } from "../agents-md/bootstrap-file";
import { ensureAiderReadsAgentsMd } from "../agents-md/aider-config";
import type { EngineeringConfig, EngineeringLock, LockedProjection, ResolvedSkill } from "../types/index";
import { SkillSource, AgentHarness } from "../types/index";
import type { Reporter } from "./reporter";
import { consoleReporter } from "./reporter";

const SCOPED_HARNESSES: readonly AgentHarness[] = [AgentHarness.ClaudeCode, AgentHarness.Kilo, AgentHarness.Copilot, AgentHarness.Cursor, AgentHarness.ZooCode, AgentHarness.Devin, AgentHarness.Cline] as const;

export interface GenerateProjectionsInput {
  projectRoot: string;
  config: EngineeringConfig;
  resolvedSkills: ResolvedSkill[];
  skillIds: string[];
  lock: Omit<EngineeringLock, "projections" | "managedProjections">;
  previousProjections?: LockedProjection[];
  previousManagedProjections?: Record<string, string[]>;
  reporter?: Reporter;
  removeLegacy?: boolean;
}

export interface GenerateProjectionsResult {
  topology: ProjectionPlan;
  errors: string[];
  projections: LockedProjection[];
  managedProjections: Record<string, string[]>;
  lock: EngineeringLock;
}

export async function generateProjectionsAndFiles(input: GenerateProjectionsInput): Promise<GenerateProjectionsResult> {
  const { projectRoot, config, resolvedSkills, skillIds, lock, previousProjections, previousManagedProjections } = input;
  const reporter = input.reporter ?? consoleReporter;
  const allErrors: string[] = [];

  const topology = calculateProjectionTopology(config.agentHarnesses);

  const clientSkillIds = resolvedSkills
    .filter((s) => s.source === SkillSource.Client || s.source === SkillSource.Repository)
    .map((s) => s.slug);

  const cleanResult = await cleanStaleProjections({
    projectRoot,
    projectionPaths: (previousProjections ?? []).map((p) => p.path),
    currentSkills: skillIds,
    clientSkillIds,
    ...(previousManagedProjections ? { previousManagedProjections } : {}),
  });

  if (cleanResult.removed.length > 0) {
    reporter.info(`Cleaned ${cleanResult.removed.length} stale projections`);
  }
  if (cleanResult.errors.length > 0) {
    reporter.error("Errors during stale cleanup:");
    for (const error of cleanResult.errors) {
      reporter.error(`  - ${error}`);
    }
    allErrors.push(...cleanResult.errors);
  }

  reporter.info("Projecting skills...");
  const projectionResult = await projectSkills({
    projectRoot,
    plan: topology,
    skills: skillIds,
  });

  if (projectionResult.errors.length > 0) {
    reporter.error("Errors during projection:");
    for (const error of projectionResult.errors) {
      reporter.error(`  - ${error}`);
    }
    allErrors.push(...projectionResult.errors);
  }

  const scopedHarnesses = config.agentHarnesses.filter((h) =>
    (SCOPED_HARNESSES as readonly AgentHarness[]).includes(h),
  );

  for (const harness of scopedHarnesses) {
    const cleanScopedResult = await cleanStaleScopedRules({
      projectRoot,
      config,
      resolvedSkills,
      harness,
    });

    if (cleanScopedResult.removed.length > 0) {
      reporter.info(`Cleaned ${cleanScopedResult.removed.length} stale scoped rules for ${harness}`);
    }
    if (cleanScopedResult.errors.length > 0) {
      reporter.error(`Errors during stale scoped rules cleanup for ${harness}:`);
      for (const error of cleanScopedResult.errors) {
        reporter.error(`  - ${error}`);
      }
      allErrors.push(...cleanScopedResult.errors);
    }

    const scopedResult = await generateScopedRules({
      projectRoot,
      config,
      resolvedSkills,
      harness,
    });

    if (scopedResult.generated.length > 0) {
      reporter.info(`Generated ${scopedResult.generated.length} scoped rules for ${harness}`);
    }
    if (scopedResult.errors.length > 0) {
      reporter.error(`Errors during scoped rules generation for ${harness}:`);
      for (const error of scopedResult.errors) {
        reporter.error(`  - ${error}`);
      }
      allErrors.push(...scopedResult.errors);
    }
  }

  reporter.info("Updating AGENTS.md...");
  const crossCuttingSlugs = resolvedSkills
    .filter((s) => s.crossCutting)
    .map((s) => s.slug);
  await normalizeAgentsMd({ projectRoot, skillSlugs: skillIds, crossCuttingSlugs });

  reporter.info("Generating harness bootstrap files...");
  await generateAllBootstrapFiles({
    projectRoot,
    harnesses: config.agentHarnesses,
    ...(input.removeLegacy !== undefined ? { removeLegacy: input.removeLegacy } : {}),
  });

  if (config.agentHarnesses.includes(AgentHarness.Aider)) {
    reporter.info("Wiring AGENTS.md into .aider.conf.yml...");
    await ensureAiderReadsAgentsMd({ projectRoot });
  }

  const projections: LockedProjection[] = topology.targets.map((t) => ({
    adapters: t.satisfiesHarnesses,
    path: t.path,
  }));

  const managedProjections: Record<string, string[]> = {};
  for (const target of topology.targets) {
    managedProjections[target.path] = [...skillIds];
  }

  const completeLock: EngineeringLock = {
    ...lock,
    projections,
    managedProjections,
    crossCuttingSkills: crossCuttingSlugs,
  };

  return { topology, errors: allErrors, projections, managedProjections, lock: completeLock };
}
