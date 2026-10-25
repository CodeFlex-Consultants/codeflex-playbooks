import { join } from "node:path";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { copyDirectory } from "../../src/utils/fs";
import { detectProject } from "../../src/detection/index";
import { resolveStandards } from "../../src/resolution/index";
import { loadSkillsFromSource } from "../../src/resolution/skill-loader";
import { saveConfig, createDefaultConfig, saveLock } from "../../src/config/index";
import { installSkills } from "../../src/skills/installer";
import type { InstallResult } from "../../src/skills/installer";
import { calculateProjectionTopology } from "../../src/projection/topology";
import type { ProjectionPlan } from "../../src/projection/topology";
import { projectSkills } from "../../src/projection/projector";
import type { ProjectSkillsResult } from "../../src/projection/projector";
import { normalizeAgentsMd } from "../../src/agents-md/normalizer";
import { generateClaudeMd } from "../../src/agents-md/bootstrap-generators";
import type {
  DetectionResult,
  EngineeringConfig,
  ResolutionResult,
  EngineeringLock,
  LockedProjection,
  StandardsSource,
} from "../../src/types/index";
import { mockLock } from "../fixtures/builders";
import { fakeHomeFor } from "../helpers";

const fixturesDir = join(import.meta.dirname, "../fixtures");

export function fixturePath(name: string): string {
  return join(fixturesDir, name);
}

export interface TestProjectContext {
  tempDir: string;
  fakeHome: string;
  originalHome: string | undefined;
  originalUserProfile: string | undefined;
}

export async function setupProjectContext(prefix: string = "codeflex-test-"): Promise<TestProjectContext> {
  const tempDir = await mkdtemp(join(tmpdir(), prefix));
  const fakeHome = fakeHomeFor(tempDir);
  await mkdir(fakeHome, { recursive: true });
  const originalHome = process.env.HOME;
  const originalUserProfile = process.env.USERPROFILE;
  process.env.HOME = fakeHome;
  process.env.USERPROFILE = fakeHome;
  return { tempDir, fakeHome, originalHome, originalUserProfile };
}

export async function cleanupProjectContext(ctx: TestProjectContext): Promise<void> {
  if (ctx.originalHome === undefined) {
    delete process.env.HOME;
  } else {
    process.env.HOME = ctx.originalHome;
  }
  if (ctx.originalUserProfile === undefined) {
    delete process.env.USERPROFILE;
  } else {
    process.env.USERPROFILE = ctx.originalUserProfile;
  }
  await rm(ctx.tempDir, { recursive: true, force: true });
}

export async function copyFixtureToProject(ctx: TestProjectContext, fixtureName: string): Promise<void> {
  await copyDirectory(fixturePath(fixtureName), ctx.tempDir);
}

export interface FullInitResult {
  detection: DetectionResult;
  config: EngineeringConfig;
  resolution: ResolutionResult;
  topology: ProjectionPlan;
  lock: EngineeringLock;
  installResult: InstallResult;
  projectionResult: ProjectSkillsResult;
}

export async function runFullInit(
  ctx: TestProjectContext,
  options?: { clientSkillsDir?: string },
): Promise<FullInitResult> {
  const { tempDir } = ctx;

  const detection = await detectProject(tempDir);

  const config = createDefaultConfig(detection);
  await saveConfig(tempDir, config);

  const skillsDir = join(tempDir, ".codeflex", "skills-source");
  const codeflexSkills = await loadSkillsFromSource(join(skillsDir, "codeflex"), "codeflex");
  const clientSkills = options?.clientSkillsDir
    ? await loadSkillsFromSource(join(skillsDir, "client"), "client")
    : [];

  const resolution = await resolveStandards({
    detection,
    config,
    codeflexSkills,
    clientSkills,
    repositorySkills: [],
  });

  const topology = calculateProjectionTopology(config.agentHarnesses);
  const lockedProjections: LockedProjection[] = topology.targets.map((t) => ({
    adapters: t.satisfiesHarnesses,
    path: t.path,
  }));

  const lock = mockLock({
    skills: resolution.skills.map((s) => s.id),
    projections: lockedProjections,
    resolvedOverrides: Object.keys(resolution.overrides).length > 0 ? resolution.overrides : undefined,
  });

  const sources: StandardsSource[] = [
    {
      type: "codeflex",
      release: "local",
      commit: "local",
      sha256: "local",
      skillsDir: join(skillsDir, "codeflex"),
    },
  ];

  const installResult = await installSkills({
    projectRoot: tempDir,
    resolvedSkills: resolution.skills,
    sources,
    lock,
  });

  if (installResult.errors.length > 0) {
    throw new Error(`Init failed: ${installResult.errors.join(", ")}`);
  }

  await saveLock(tempDir, lock);

  const projectionResult = await projectSkills({
    projectRoot: tempDir,
    plan: topology,
    skills: resolution.skills.map((s) => s.id),
  });

  await normalizeAgentsMd({ projectRoot: tempDir });

  await generateClaudeMd({
    projectRoot: tempDir,
    harnesses: config.agentHarnesses,
  });

  return { detection, config, resolution, topology, lock, installResult, projectionResult };
}
