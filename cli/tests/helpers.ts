import { mkdtemp, rm, cp, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { detectProject } from "../src/detection/index";
import { createDefaultConfig, saveConfig, saveLock } from "../src/config/index";
import { resolveStandards } from "../src/resolution/index";
import { loadSkillsFromSource } from "../src/resolution/skill-loader";
import { installSkills } from "../src/skills/installer";
import { generateProjectionsAndFiles } from "../src/cli/generate-projections";
import { mockLock } from "./fixtures/builders";
import type { StandardsSource } from "../src/types/index";

export const FAKE_HOME_DIRNAME = ".codeflex-test-home";

export function fakeHomeFor(tempDir: string): string {
  return join(tempDir, FAKE_HOME_DIRNAME);
}

export function resolveProjectionPath(targetPath: string, tempDir: string): string {
  if (targetPath.startsWith("~/")) {
    return join(fakeHomeFor(tempDir), targetPath.slice(2));
  }
  return join(tempDir, targetPath);
}

export async function withFakeHome<T>(fakeHome: string, fn: () => Promise<T>): Promise<T> {
  const originalHome = process.env.HOME;
  const originalUserProfile = process.env.USERPROFILE;
  process.env.HOME = fakeHome;
  process.env.USERPROFILE = fakeHome;
  try {
    return await fn();
  } finally {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
    if (originalUserProfile === undefined) {
      delete process.env.USERPROFILE;
    } else {
      process.env.USERPROFILE = originalUserProfile;
    }
  }
}

async function withTempDir<T>(
  fn: (tempDir: string) => Promise<T>,
  options?: { fixtureName?: string },
): Promise<T> {
  const tempDir = await mkdtemp(join(tmpdir(), "codeflex-cli-test-"));
  await mkdir(fakeHomeFor(tempDir), { recursive: true });

  try {
    return await withFakeHome(fakeHomeFor(tempDir), async () => {
      if (options?.fixtureName) {
        const fixturesDir = join(import.meta.dirname, "fixtures");
        const fixturePath = join(fixturesDir, options.fixtureName);
        await cp(fixturePath, tempDir, { recursive: true });
      }
      return await fn(tempDir);
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}

export async function withTempFixture<T>(
  fixtureName: string,
  fn: (tempDir: string) => Promise<T>,
): Promise<T> {
  return withTempDir(fn, { fixtureName });
}

export async function withEmptyTempDir<T>(
  fn: (tempDir: string) => Promise<T>,
): Promise<T> {
  return withTempDir(fn);
}

export async function setupInitializedProject(tempDir: string): Promise<{
  skillIds: string[];
  skillsSourceDir: string;
  config: import("../src/types/index.js").EngineeringConfig;
}> {
  const skillsSourceDir = join(tempDir, ".codeflex", "skills-source", "codeflex");

  const detection = await detectProject(tempDir);
  const config = createDefaultConfig(detection);
  await saveConfig(tempDir, config);

  const codeflexSkills = await loadSkillsFromSource(skillsSourceDir, "codeflex");
  const resolution = await resolveStandards({
    detection,
    config,
    codeflexSkills,
    clientSkills: [],
    repositorySkills: [],
  });

  const lock = mockLock({
    skills: resolution.skills.map((s) => s.slug),
    crossCuttingSkills: resolution.skills.filter((s) => s.crossCutting).map((s) => s.slug),
  });

  const sources: StandardsSource[] = [
    {
      type: "codeflex",
      release: "local",
      commit: "local",
      sha256: "local",
      skillsDir: skillsSourceDir,
    },
  ];

  const installResult = await installSkills({
    projectRoot: tempDir,
    resolvedSkills: resolution.skills,
    sources,
    lock,
  });

  if (installResult.errors.length > 0) {
    throw new Error(`Setup failed: ${installResult.errors.join(", ")}`);
  }

  await saveLock(tempDir, lock);

  const { lock: finalLock } = await generateProjectionsAndFiles({
    projectRoot: tempDir,
    config,
    resolvedSkills: resolution.skills,
    skillIds: resolution.skills.map((s) => s.slug),
    lock,
  });

  await saveLock(tempDir, finalLock);

  return {
    skillIds: resolution.skills.map((s) => s.slug),
    skillsSourceDir,
    config,
  };
}
