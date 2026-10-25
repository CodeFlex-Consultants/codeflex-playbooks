import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { readFile, readdir } from "node:fs/promises";
import { pathExists } from "../../src/utils/fs";
import { resolveProjectionPath } from "../cli/cli-helpers";
import { detectProject } from "../../src/detection/index";
import { resolveStandards } from "../../src/resolution/index";
import { loadSkillsFromSource } from "../../src/resolution/skill-loader";
import { saveConfig, createDefaultConfig, saveLock } from "../../src/config/index";
import { installSkills } from "../../src/skills/installer";
import { calculateProjectionTopology } from "../../src/projection/topology";
import { projectSkills } from "../../src/projection/projector";
import { normalizeAgentsMd } from "../../src/agents-md/normalizer";
import { generateClaudeMd } from "../../src/agents-md/bootstrap-generators";
import type { LockedProjection, StandardsSource } from "../../src/types/index";
import { mockLock } from "../fixtures/builders";
import {
  setupProjectContext,
  cleanupProjectContext,
  copyFixtureToProject,
  type TestProjectContext,
} from "./test-setup";

describe("integration: init flow", () => {
  let ctx: TestProjectContext;

  beforeEach(async () => {
    ctx = await setupProjectContext("codeflex-init-test-");
  });

  afterEach(async () => {
    await cleanupProjectContext(ctx);
  });

  describe("greenfield-dotnet-angular", () => {
    beforeEach(async () => {
      await copyFixtureToProject(ctx, "greenfield-dotnet-angular");
    });

    it("creates .codeflex directory with config and lock", async () => {
      const detection = await detectProject(ctx.tempDir);
      const config = createDefaultConfig(detection);
      await saveConfig(ctx.tempDir, config);

      const configExists = await pathExists(join(ctx.tempDir, ".codeflex", "engineering.yaml"));
      expect(configExists).toBe(true);

      await saveLock(ctx.tempDir, mockLock({ skills: [] }));

      const lockExists = await pathExists(join(ctx.tempDir, ".codeflex", "engineering.lock"));
      expect(lockExists).toBe(true);
    });

    it("installs skills to .codeflex/skills/", async () => {
      const detection = await detectProject(ctx.tempDir);
      const config = createDefaultConfig(detection);

      const skillsDir = join(ctx.tempDir, ".codeflex", "skills-source");
      const codeflexSkills = await loadSkillsFromSource(join(skillsDir, "codeflex"), "codeflex");

      const resolution = await resolveStandards({
        detection,
        config,
        codeflexSkills,
        clientSkills: [],
        repositorySkills: [],
      });

      const lock = mockLock({ skills: resolution.skills.map((s) => s.id) });

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
        projectRoot: ctx.tempDir,
        resolvedSkills: resolution.skills,
        sources,
        lock,
      });

      expect(installResult.installed.length).toBeGreaterThan(0);
      expect(installResult.errors).toHaveLength(0);

      const skillsTarget = join(ctx.tempDir, ".codeflex", "skills");
      const installedEntries = await readdir(skillsTarget);
      expect(installedEntries).toContain("codeflex-dotnet");
      expect(installedEntries).toContain("codeflex-angular");
      expect(installedEntries).toContain("codeflex-security");
    });

    it("generates projections for configured harnesses", async () => {
      const detection = await detectProject(ctx.tempDir);
      const config = createDefaultConfig(detection);

      const skillsDir = join(ctx.tempDir, ".codeflex", "skills-source");
      const codeflexSkills = await loadSkillsFromSource(join(skillsDir, "codeflex"), "codeflex");

      const resolution = await resolveStandards({
        detection,
        config,
        codeflexSkills,
        clientSkills: [],
        repositorySkills: [],
      });

      const lock = mockLock({ skills: resolution.skills.map((s) => s.id) });

      const sources: StandardsSource[] = [
        {
          type: "codeflex",
          release: "local",
          commit: "local",
          sha256: "local",
          skillsDir: join(skillsDir, "codeflex"),
        },
      ];

      await installSkills({
        projectRoot: ctx.tempDir,
        resolvedSkills: resolution.skills,
        sources,
        lock,
      });

      const topology = calculateProjectionTopology(config.agentHarnesses);
      const projectionResult = await projectSkills({
        projectRoot: ctx.tempDir,
        plan: topology,
        skills: resolution.skills.map((s) => s.id),
      });

      expect(projectionResult.errors).toHaveLength(0);
      expect(projectionResult.projected).toBeGreaterThan(0);

      for (const target of topology.targets) {
        const targetDir = resolveProjectionPath(target.path, ctx.tempDir);
        const targetExists = await pathExists(targetDir);
        expect(targetExists).toBe(true);
      }
    });

    it("creates AGENTS.md with managed section", async () => {
      const result = await normalizeAgentsMd({ projectRoot: ctx.tempDir });

      expect(result.action).toBe("created");

      const agentsContent = await readFile(join(ctx.tempDir, "AGENTS.md"), "utf-8");
      expect(agentsContent).toContain("<!-- codeflex-engineering-standards:start -->");
      expect(agentsContent).toContain("<!-- codeflex-engineering-standards:end -->");
      expect(agentsContent).toContain("MANDATORY PRE-FLIGHT");
    });

    it("creates CLAUDE.md when claude-code harness is configured", async () => {
      const detection = await detectProject(ctx.tempDir);
      const config = createDefaultConfig(detection);

      expect(config.agentHarnesses).toContain("claude-code");

      const result = await generateClaudeMd({
        projectRoot: ctx.tempDir,
        harnesses: config.agentHarnesses,
      });

      expect(result.action).toBe("created");

      const claudeContent = await readFile(join(ctx.tempDir, "CLAUDE.md"), "utf-8");
      expect(claudeContent).toContain("@AGENTS.md");
    });

    it("runs full init pipeline end-to-end", async () => {
      const detection = await detectProject(ctx.tempDir);
      expect(detection.technologies.length).toBeGreaterThan(0);

      const config = createDefaultConfig(detection);
      await saveConfig(ctx.tempDir, config);

      const skillsDir = join(ctx.tempDir, ".codeflex", "skills-source");
      const codeflexSkills = await loadSkillsFromSource(join(skillsDir, "codeflex"), "codeflex");

      const resolution = await resolveStandards({
        detection,
        config,
        codeflexSkills,
        clientSkills: [],
        repositorySkills: [],
      });

      expect(resolution.skills.length).toBeGreaterThan(0);

      const topology = calculateProjectionTopology(config.agentHarnesses);
      const lockedProjections: LockedProjection[] = topology.targets.map((t) => ({
        adapters: t.satisfiesHarnesses,
        path: t.path,
      }));

      const lock = mockLock({ skills: resolution.skills.map((s) => s.id), projections: lockedProjections });

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
        projectRoot: ctx.tempDir,
        resolvedSkills: resolution.skills,
        sources,
        lock,
      });
      expect(installResult.errors).toHaveLength(0);

      await saveLock(ctx.tempDir, lock);

      await projectSkills({
        projectRoot: ctx.tempDir,
        plan: topology,
        skills: resolution.skills.map((s) => s.id),
      });

      await normalizeAgentsMd({ projectRoot: ctx.tempDir });
      await generateClaudeMd({
        projectRoot: ctx.tempDir,
        harnesses: config.agentHarnesses,
      });

      const agentsExists = await pathExists(join(ctx.tempDir, "AGENTS.md"));
      const claudeExists = await pathExists(join(ctx.tempDir, "CLAUDE.md"));
      const configExists = await pathExists(join(ctx.tempDir, ".codeflex", "engineering.yaml"));
      const lockExists = await pathExists(join(ctx.tempDir, ".codeflex", "engineering.lock"));
      const skillsInstalled = await readdir(join(ctx.tempDir, ".codeflex", "skills"));

      expect(agentsExists).toBe(true);
      expect(claudeExists).toBe(true);
      expect(configExists).toBe(true);
      expect(lockExists).toBe(true);
      expect(skillsInstalled.length).toBeGreaterThan(0);
    });
  });

  describe("existing-client-project", () => {
    beforeEach(async () => {
      await copyFixtureToProject(ctx, "existing-client-project");
    });

    it("installs codeflex skills and applies client overrides", async () => {
      const detection = await detectProject(ctx.tempDir);
      const config = createDefaultConfig(detection);

      const skillsDir = join(ctx.tempDir, ".codeflex", "skills-source");
      const codeflexSkills = await loadSkillsFromSource(join(skillsDir, "codeflex"), "codeflex");
      const clientSkills = await loadSkillsFromSource(join(skillsDir, "client"), "client");

      const resolution = await resolveStandards({
        detection,
        config,
        codeflexSkills,
        clientSkills,
        repositorySkills: [],
      });

      expect(resolution.overrides["DOTNET-002"]).toBe("client-dotnet");

      const lock = mockLock({ skills: resolution.skills.map((s) => s.id) });

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
        projectRoot: ctx.tempDir,
        resolvedSkills: resolution.skills,
        sources,
        lock,
      });

      expect(installResult.errors).toHaveLength(0);

      const installedEntries = await readdir(join(ctx.tempDir, ".codeflex", "skills"));
      expect(installedEntries).toContain("codeflex-dotnet");
      expect(installedEntries).toContain("codeflex-security");
    });
  });
});
