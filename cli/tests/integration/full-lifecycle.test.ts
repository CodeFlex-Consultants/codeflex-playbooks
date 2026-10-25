import { describe, it, expect, vi, beforeEach } from "vitest";
import { join } from "node:path";
import { readdir, rm, cp, readFile } from "node:fs/promises";
import { runCli, withTempFixture, resolveProjectionPath } from "../cli/cli-helpers";
import { pathExists } from "../../src/utils/fs";
import { loadConfig, loadLock, saveConfig } from "../../src/config/index";

vi.mock("../../src/skills/source-fetcher.js", () => ({
  fetchCodeFlexSource: vi.fn(async () => ({
    source: {
      type: "codeflex" as const,
      release: "local",
      commit: "local",
      sha256: "local",
      skillsDir: "",
    },
    warnings: [],
  })),
  fetchClientSource: vi.fn(async () => ({
    type: "client" as const,
    id: "local",
    sha256: "local",
    skillsDir: "",
  })),
  cleanupSources: vi.fn(async () => {}),
}));

vi.mock("../../src/detection/harness/index.js", () => ({
  detectHarnesses: vi.fn(async () => []),
}));

import { fetchCodeFlexSource } from "../../src/skills/source-fetcher";

const mockedFetchCodeFlexSource = vi.mocked(fetchCodeFlexSource);

/**
 * The greenfield-dotnet-angular fixture ships with `.codeflex/skills-source` already
 * present (used as the "downloaded" skills source in other tests), but for a true
 * lifecycle test we need to start from a project with no `.codeflex` at all. This
 * mirrors `prepareGreenfieldDir` in cli/tests/cli/init.test.ts: it stashes the
 * skills-source directory outside `.codeflex` so it can still be referenced by the
 * mocked fetcher, then removes `.codeflex` so the fixture looks greenfield.
 */
async function prepareGreenfieldDir(tempDir: string): Promise<string> {
  const originalSkillsSource = join(tempDir, ".codeflex", "skills-source");
  const savedSkillsSource = join(tempDir, "_skills-source");
  await cp(originalSkillsSource, savedSkillsSource, { recursive: true });
  await rm(join(tempDir, ".codeflex"), { recursive: true, force: true });
  return join(savedSkillsSource, "codeflex");
}

function mockSourceOnce(
  skillsSourceDir: string,
  overrides: Partial<{ release: string; commit: string; sha256: string }> = {},
) {
  mockedFetchCodeFlexSource.mockResolvedValueOnce({
    source: {
      type: "codeflex" as const,
      release: overrides.release ?? "local",
      commit: overrides.commit ?? "local",
      sha256: overrides.sha256 ?? "local",
      skillsDir: skillsSourceDir,
    },
    warnings: [],
  });
}

/**
 * Harness auto-detection is exercised in depth by cli/tests/cli/sync.test.ts and
 * update.test.ts. It is orthogonal to the lifecycle behaviors this suite verifies
 * (config/lock/skill-store/projection/AGENTS.md consistency across init -> sync ->
 * update -> check), and the module-level `detectHarnesses` mock here always
 * returns `[]`, which would otherwise cause every subsequent `sync`/`update` run to
 * strip all configured harnesses and their projections out from under us. Disabling
 * autoDetect after init keeps agentHarnesses (and thus projections) stable across
 * the rest of the lifecycle.
 */
async function disableHarnessAutoDetect(tempDir: string): Promise<void> {
  const config = await loadConfig(tempDir);
  if (!config) throw new Error("Expected config to exist after init");
  await saveConfig(tempDir, { ...config, autoDetect: false });
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("integration: full lifecycle (init -> sync -> update -> check)", () => {
  beforeEach(() => {
    mockedFetchCodeFlexSource.mockReset();
  });

  it("runs the complete lifecycle keeping state consistent at every step", async () => {
    await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
      const skillsSourceDir = await prepareGreenfieldDir(tempDir);

      // ---- 1. init ----
      mockSourceOnce(skillsSourceDir);

      const initResult = await runCli(["init"], tempDir);
      expect(initResult.exitCode).toBe(0);
      expect(initResult.stdout).toContain("Initialization complete!");

      expect(await pathExists(join(tempDir, ".codeflex", "engineering.yaml"))).toBe(true);
      expect(await pathExists(join(tempDir, ".codeflex", "engineering.lock"))).toBe(true);

      await disableHarnessAutoDetect(tempDir);

      const configAfterInit = await loadConfig(tempDir);
      const lockAfterInit = await loadLock(tempDir);
      expect(configAfterInit).not.toBeNull();
      expect(lockAfterInit).not.toBeNull();
      expect(lockAfterInit!.skills.length).toBeGreaterThan(0);

      const installedSkillsAfterInit = await readdir(join(tempDir, ".codeflex", "skills"));
      expect(installedSkillsAfterInit).toContain("codeflex-dotnet");
      expect(installedSkillsAfterInit).toContain("codeflex-angular");
      expect(installedSkillsAfterInit).toContain("codeflex-security");

      const agentsContentAfterInit = await readFile(join(tempDir, "AGENTS.md"), "utf-8");
      expect(countOccurrences(agentsContentAfterInit, "<!-- codeflex-engineering-standards:start -->")).toBe(1);
      expect(countOccurrences(agentsContentAfterInit, "<!-- codeflex-engineering-standards:end -->")).toBe(1);
      expect(agentsContentAfterInit).toContain("MANDATORY PRE-FLIGHT");

      expect(await pathExists(resolveProjectionPath("~/.agents/skills", tempDir))).toBe(true);
      expect(await pathExists(resolveProjectionPath("~/.claude/skills", tempDir))).toBe(true);

      const agentsSkillsAfterInit = await readdir(resolveProjectionPath("~/.agents/skills", tempDir));
      for (const skillId of lockAfterInit!.skills) {
        expect(agentsSkillsAfterInit).toContain(skillId);
      }

      // ---- 2. sync (immediately after init) ----
      const syncResult = await runCli(["sync"], tempDir);
      expect(syncResult.exitCode).toBe(0);
      expect(syncResult.stdout).toContain("Sync complete!");
      expect(syncResult.stdout).toContain(`Skills synced: ${lockAfterInit!.skills.length}`);

      const configAfterSync = await loadConfig(tempDir);
      const lockAfterSync = await loadLock(tempDir);
      expect(lockAfterSync!.skills).toEqual(lockAfterInit!.skills);
      expect(configAfterSync!.version).toBe(configAfterInit!.version);

      const agentsContentAfterSync = await readFile(join(tempDir, "AGENTS.md"), "utf-8");
      expect(countOccurrences(agentsContentAfterSync, "<!-- codeflex-engineering-standards:start -->")).toBe(1);
      expect(countOccurrences(agentsContentAfterSync, "<!-- codeflex-engineering-standards:end -->")).toBe(1);
      expect(agentsContentAfterSync).toContain("MANDATORY PRE-FLIGHT");

      expect(await pathExists(resolveProjectionPath("~/.agents/skills", tempDir))).toBe(true);
      expect(await pathExists(resolveProjectionPath("~/.claude/skills", tempDir))).toBe(true);

      // ---- 3. update (safe no-op on unchanged inputs) ----
      // Realistic "newer revision available" simulation would require mocking
      // fetchCodeFlexSource with a genuinely different skill set on disk, which the
      // installed fixture doesn't provide. We instead verify the two behaviors we
      // *can* assert deterministically without deeper source-fetcher mocking:
      // (a) an unchanged source is reported as already up to date and leaves the
      //     lockfile untouched, and (b) a changed source sha still recalculates and
      //     produces a consistent, non-empty lockfile referencing the same skill set
      //     (since the underlying skills-source content on disk is unchanged).
      mockSourceOnce(skillsSourceDir);
      const updateNoopResult = await runCli(["update"], tempDir);
      expect(updateNoopResult.exitCode).toBe(0);
      expect(updateNoopResult.stdout).toContain("Already up to date.");

      const lockAfterNoopUpdate = await loadLock(tempDir);
      expect(lockAfterNoopUpdate!.skills).toEqual(lockAfterSync!.skills);

      mockSourceOnce(skillsSourceDir, { release: "local-v2", commit: "local-v2", sha256: "new-sha256" });
      const updateResult = await runCli(["update"], tempDir);
      expect(updateResult.exitCode).toBe(0);
      expect(updateResult.stdout).toContain("Resolving standards...");

      const lockAfterUpdate = await loadLock(tempDir);
      expect(lockAfterUpdate).not.toBeNull();
      expect(lockAfterUpdate!.skills.length).toBeGreaterThan(0);
      expect(lockAfterUpdate!.skills.sort()).toEqual(lockAfterSync!.skills.sort());

      // ---- 4. check (should pass cleanly) ----
      const checkResult = await runCli(["check"], tempDir);
      expect(checkResult.exitCode).toBe(0);
      expect(checkResult.stdout).toContain("Check passed!");
      expect(checkResult.stdout).toContain("Skills:");
      expect(checkResult.stdout).toContain("Projections:");
      expect(checkResult.stdout).toContain("AGENTS.md:");
    });
  });

  it("does not duplicate AGENTS.md managed sections or projected skills on repeated init --force", async () => {
    await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
      const skillsSourceDir = await prepareGreenfieldDir(tempDir);

      mockSourceOnce(skillsSourceDir);
      const firstInit = await runCli(["init"], tempDir);
      expect(firstInit.exitCode).toBe(0);

      const lockAfterFirstInit = await loadLock(tempDir);

      mockSourceOnce(skillsSourceDir);
      const secondInit = await runCli(["init", "--force"], tempDir);
      expect(secondInit.exitCode).toBe(0);
      expect(secondInit.stdout).toContain("Reinitializing");

      await disableHarnessAutoDetect(tempDir);

      const agentsContent = await readFile(join(tempDir, "AGENTS.md"), "utf-8");
      expect(countOccurrences(agentsContent, "<!-- codeflex-engineering-standards:start -->")).toBe(1);
      expect(countOccurrences(agentsContent, "<!-- codeflex-engineering-standards:end -->")).toBe(1);

      const lockAfterSecondInit = await loadLock(tempDir);
      expect(lockAfterSecondInit!.skills.sort()).toEqual(lockAfterFirstInit!.skills.sort());

      const installedSkillsAfterSecondInit = await readdir(join(tempDir, ".codeflex", "skills"));
      expect(installedSkillsAfterSecondInit.sort()).toEqual(lockAfterSecondInit!.skills.sort());

      const agentsSkills = await readdir(resolveProjectionPath("~/.agents/skills", tempDir));
      const uniqueAgentsSkills = new Set(agentsSkills);
      expect(agentsSkills.length).toBe(uniqueAgentsSkills.size);
      for (const skillId of lockAfterSecondInit!.skills) {
        expect(agentsSkills).toContain(skillId);
      }

      const checkResult = await runCli(["check"], tempDir);
      expect(checkResult.exitCode).toBe(0);
      expect(checkResult.stdout).toContain("Check passed!");
    });
  });

  it("sync restores a manually deleted projection directory from .codeflex/skills/ without altering the lockfile", async () => {
    await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
      const skillsSourceDir = await prepareGreenfieldDir(tempDir);

      mockSourceOnce(skillsSourceDir);
      const initResult = await runCli(["init"], tempDir);
      expect(initResult.exitCode).toBe(0);

      await disableHarnessAutoDetect(tempDir);

      const lockBeforeDeletion = await loadLock(tempDir);
      const projectionDir = resolveProjectionPath("~/.agents/skills", tempDir);
      expect(await pathExists(projectionDir)).toBe(true);

      await rm(projectionDir, { recursive: true, force: true });
      expect(await pathExists(projectionDir)).toBe(false);

      const syncResult = await runCli(["sync"], tempDir);
      expect(syncResult.exitCode).toBe(0);
      expect(syncResult.stdout).toContain("Sync complete!");

      expect(await pathExists(projectionDir)).toBe(true);
      const restoredEntries = await readdir(projectionDir);
      for (const skillId of lockBeforeDeletion!.skills) {
        expect(restoredEntries).toContain(skillId);
      }

      const lockAfterSync = await loadLock(tempDir);
      expect(lockAfterSync!.skills).toEqual(lockBeforeDeletion!.skills);

      const checkResult = await runCli(["check"], tempDir);
      expect(checkResult.exitCode).toBe(0);
      expect(checkResult.stdout).toContain("Check passed!");
    });
  });
});
