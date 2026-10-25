import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdtemp, rm, mkdir, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { copyDirectory, pathExists } from "../../src/utils/fs";
import { resolveProjectionPath, fakeHomeFor } from "../cli/cli-helpers";
import { detectProject } from "../../src/detection/index";
import { resolveStandards } from "../../src/resolution/index";
import { loadSkillsFromSource } from "../../src/resolution/skill-loader";
import { saveConfig, createDefaultConfig, saveLock, loadConfig, loadLock } from "../../src/config/index";
import { installSkills } from "../../src/skills/installer";
import { calculateProjectionTopology } from "../../src/projection/topology";
import { projectSkills } from "../../src/projection/projector";
import { normalizeAgentsMd } from "../../src/agents-md/normalizer";
import type { StandardsSource, ResolvedSkill } from "../../src/types/index";
import { mockLock } from "../fixtures/builders";

const fixturesDir = join(import.meta.dirname, "../fixtures");

function fixturePath(name: string): string {
  return join(fixturesDir, name);
}

describe("integration: sync flow", () => {
  let tempDir: string;
  let fakeHome: string;
  let originalHome: string | undefined;
  let originalUserProfile: string | undefined;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "codeflex-sync-test-"));
    fakeHome = fakeHomeFor(tempDir);
    await mkdir(fakeHome, { recursive: true });
    originalHome = process.env.HOME;
    originalUserProfile = process.env.USERPROFILE;
    process.env.HOME = fakeHome;
    process.env.USERPROFILE = fakeHome;
  });

  afterEach(async () => {
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
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("greenfield-dotnet-angular", () => {
    beforeEach(async () => {
      await copyDirectory(fixturePath("greenfield-dotnet-angular"), tempDir);
    });

    it("syncs skills from lockfile to .codeflex/skills/", async () => {
      const detection = await detectProject(tempDir);
      const config = createDefaultConfig(detection);

      const skillsDir = join(tempDir, ".codeflex", "skills-source");
      const codeflexSkills = await loadSkillsFromSource(join(skillsDir, "codeflex"), "codeflex");

      const resolution = await resolveStandards({
        detection,
        config,
        codeflexSkills,
        clientSkills: [],
        repositorySkills: [],
      });

      const lock = mockLock({ skills: resolution.skills.map((s) => s.slug) });

      await saveConfig(tempDir, config);
      await saveLock(tempDir, lock);

      const sources: StandardsSource[] = [
        {
          type: "codeflex",
          release: "local",
          commit: "local",
          sha256: "local",
          skillsDir: join(skillsDir, "codeflex"),
        },
      ];

      const resolvedSkills: ResolvedSkill[] = lock.skills.map((slug) => ({
        id: slug,
        slug,
        source: "codeflex" as const,
      }));

      const installResult = await installSkills({
        projectRoot: tempDir,
        resolvedSkills,
        sources,
        lock,
      });

      expect(installResult.errors).toHaveLength(0);
      expect(installResult.installed.length).toBeGreaterThan(0);

      const installedEntries = await readdir(join(tempDir, ".codeflex", "skills"));
      for (const skillId of lock.skills) {
        expect(installedEntries).toContain(skillId);
      }
    });

    it("regenerates projections from lockfile", async () => {
      const detection = await detectProject(tempDir);
      const config = createDefaultConfig(detection);

      const skillsDir = join(tempDir, ".codeflex", "skills-source");
      const codeflexSkills = await loadSkillsFromSource(join(skillsDir, "codeflex"), "codeflex");

      const resolution = await resolveStandards({
        detection,
        config,
        codeflexSkills,
        clientSkills: [],
        repositorySkills: [],
      });

      const lock = mockLock({ skills: resolution.skills.map((s) => s.slug) });

      await saveConfig(tempDir, config);
      await saveLock(tempDir, lock);

      const sources: StandardsSource[] = [{
        type: "codeflex", release: "local", commit: "local", sha256: "local",
        skillsDir: join(skillsDir, "codeflex"),
      }];

      await installSkills({
        projectRoot: tempDir,
        resolvedSkills: resolution.skills.map((s) => ({ id: s.id, slug: s.slug, source: "codeflex" as const })),
        sources, lock,
      });

      const reloadedConfig = await loadConfig(tempDir);
      const topology = calculateProjectionTopology(reloadedConfig!.agentHarnesses);
      await projectSkills({ projectRoot: tempDir, plan: topology, skills: lock.skills });

      for (const target of topology.targets) {
        const targetDir = resolveProjectionPath(target.path, tempDir);
        expect(await pathExists(targetDir)).toBe(true);
      }
    });

    it("updates AGENTS.md during sync", async () => {
      const result = await normalizeAgentsMd({ projectRoot: tempDir });
      expect(result.action).toBe("created");

      const agentsContent = await readFile(join(tempDir, "AGENTS.md"), "utf-8");
      expect(agentsContent).toContain("MANDATORY PRE-FLIGHT");
    });

    it("produces consistent config and lock after sync", async () => {
      const detection = await detectProject(tempDir);
      const config = createDefaultConfig(detection);

      const skillsDir = join(tempDir, ".codeflex", "skills-source");
      const codeflexSkills = await loadSkillsFromSource(join(skillsDir, "codeflex"), "codeflex");

      const resolution = await resolveStandards({
        detection,
        config,
        codeflexSkills,
        clientSkills: [],
        repositorySkills: [],
      });

      const lock = mockLock({ skills: resolution.skills.map((s) => s.slug) });

      await saveConfig(tempDir, config);
      await saveLock(tempDir, lock);

      const reloadedConfig = await loadConfig(tempDir);
      const reloadedLock = await loadLock(tempDir);

      expect(reloadedConfig).not.toBeNull();
      expect(reloadedLock).not.toBeNull();
      expect(reloadedConfig!.version).toBe(1);
      expect(reloadedLock!.version).toBe(1);
      expect(reloadedLock!.skills).toEqual(lock.skills);
    });
  });

  describe("existing-client-project", () => {
    beforeEach(async () => {
      await copyDirectory(fixturePath("existing-client-project"), tempDir);
    });

    it("syncs codeflex skills from lockfile", async () => {
      const detection = await detectProject(tempDir);
      const config = createDefaultConfig(detection);

      const skillsDir = join(tempDir, ".codeflex", "skills-source");
      const codeflexSkills = await loadSkillsFromSource(join(skillsDir, "codeflex"), "codeflex");
      const clientSkills = await loadSkillsFromSource(join(skillsDir, "client"), "client");

      const resolution = await resolveStandards({
        detection,
        config,
        codeflexSkills,
        clientSkills,
        repositorySkills: [],
      });

      const lock = mockLock({ skills: resolution.skills.map((s) => s.slug) });

      await saveConfig(tempDir, config);
      await saveLock(tempDir, lock);

      const sources: StandardsSource[] = [
        {
          type: "codeflex",
          release: "local",
          commit: "local",
          sha256: "local",
          skillsDir: join(skillsDir, "codeflex"),
        },
      ];

      const resolvedSkills: ResolvedSkill[] = lock.skills.map((slug) => ({
        id: slug,
        slug,
        source: resolution.skills.find((s) => s.slug === slug)?.source ?? "codeflex",
      }));

      const installResult = await installSkills({
        projectRoot: tempDir,
        resolvedSkills,
        sources,
        lock,
      });

      expect(installResult.errors).toHaveLength(0);

      const installedEntries = await readdir(join(tempDir, ".codeflex", "skills"));
      expect(installedEntries).toContain("codeflex-dotnet");
      expect(installedEntries).toContain("codeflex-security");
    });
  });

  describe("monorepo-integration", () => {
    beforeEach(async () => {
      await copyDirectory(fixturePath("monorepo-integration"), tempDir);
    });

    it("syncs all skills and generates projections for all harnesses", async () => {
      const detection = await detectProject(tempDir);
      const config = createDefaultConfig(detection);

      const skillsDir = join(tempDir, ".codeflex", "skills-source");
      const codeflexSkills = await loadSkillsFromSource(join(skillsDir, "codeflex"), "codeflex");

      const resolution = await resolveStandards({
        detection,
        config,
        codeflexSkills,
        clientSkills: [],
        repositorySkills: [],
      });

      const lock = mockLock({ skills: resolution.skills.map((s) => s.slug) });

      await saveConfig(tempDir, config);
      await saveLock(tempDir, lock);

      const sources: StandardsSource[] = [
        {
          type: "codeflex",
          release: "local",
          commit: "local",
          sha256: "local",
          skillsDir: join(skillsDir, "codeflex"),
        },
      ];

      const resolvedSkills: ResolvedSkill[] = lock.skills.map((slug) => ({
        id: slug,
        slug,
        source: "codeflex" as const,
      }));

      const installResult = await installSkills({
        projectRoot: tempDir,
        resolvedSkills,
        sources,
        lock,
      });

      expect(installResult.errors).toHaveLength(0);

      const topology = calculateProjectionTopology(config.agentHarnesses);
      const projectionResult = await projectSkills({
        projectRoot: tempDir,
        plan: topology,
        skills: lock.skills,
      });

      expect(projectionResult.errors).toHaveLength(0);

      for (const target of topology.targets) {
        const targetDir = resolveProjectionPath(target.path, tempDir);
        expect(await pathExists(targetDir)).toBe(true);

        const entries = await readdir(targetDir);
        for (const skillId of lock.skills) {
          expect(entries).toContain(skillId);
        }
      }
    });
  });
});
