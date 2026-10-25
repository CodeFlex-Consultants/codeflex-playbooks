import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { readFile, readdir } from "node:fs/promises";
import { pathExists } from "../../src/utils/fs";
import { resolveProjectionPath } from "../cli/cli-helpers";
import { loadConfig, loadLock } from "../../src/config/index";
import {
  setupProjectContext,
  cleanupProjectContext,
  copyFixtureToProject,
  runFullInit,
  type TestProjectContext,
} from "./test-setup";

describe("end-to-end evaluation", () => {
  let ctx: TestProjectContext;

  beforeEach(async () => {
    ctx = await setupProjectContext("codeflex-eval-test-");
  });

  afterEach(async () => {
    await cleanupProjectContext(ctx);
  });

  describe("scenario 1: greenfield .NET + Angular", () => {
    beforeEach(async () => {
      await copyFixtureToProject(ctx, "greenfield-dotnet-angular");
    });

    it("resolves correct skills for detected technologies", async () => {
      const { resolution } = await runFullInit(ctx);
      const skillIds = resolution.skills.map((s) => s.id);

      expect(skillIds).toContain("codeflex-dotnet");
      expect(skillIds).toContain("codeflex-angular");
      expect(skillIds).toContain("codeflex-security");
    });

    it("does not resolve skills for undetected technologies", async () => {
      const { resolution } = await runFullInit(ctx);
      const skillIds = resolution.skills.map((s) => s.id);

      expect(skillIds).not.toContain("codeflex-azure");
      expect(skillIds).not.toContain("codeflex-mobile");
    });

    it("creates valid engineering.yaml config", async () => {
      await runFullInit(ctx);

      const config = await loadConfig(ctx.tempDir);
      expect(config).not.toBeNull();
      expect(config!.version).toBe(1);
      expect(config!.standards.codeflex.enabled).toBe(true);
      expect(config!.agentHarnesses.length).toBeGreaterThan(0);
    });

    it("creates valid engineering.lock lockfile", async () => {
      await runFullInit(ctx);

      const lock = await loadLock(ctx.tempDir);
      expect(lock).not.toBeNull();
      expect(lock!.version).toBe(1);
      expect(lock!.skills.length).toBeGreaterThan(0);
      expect(lock!.sources.codeflex).toBeDefined();
    });

    it("installs all resolved skills to canonical store", async () => {
      const { resolution } = await runFullInit(ctx);

      const installedEntries = await readdir(join(ctx.tempDir, ".codeflex", "skills"));
      for (const skill of resolution.skills) {
        expect(installedEntries).toContain(skill.id);
      }
    });

    it("creates AGENTS.md with managed section markers", async () => {
      await runFullInit(ctx);

      const agentsContent = await readFile(join(ctx.tempDir, "AGENTS.md"), "utf-8");
      expect(agentsContent).toContain("<!-- codeflex-engineering-standards:start -->");
      expect(agentsContent).toContain("<!-- codeflex-engineering-standards:end -->");
      expect(agentsContent).toContain("MANDATORY PRE-FLIGHT");
    });

    it("creates CLAUDE.md referencing AGENTS.md", async () => {
      await runFullInit(ctx);

      const claudeContent = await readFile(join(ctx.tempDir, "CLAUDE.md"), "utf-8");
      expect(claudeContent).toContain("@AGENTS.md");
    });

    it("generates harness-specific projections for all configured harnesses", async () => {
      const { config, topology, projectionResult } = await runFullInit(ctx);

      expect(projectionResult.errors).toHaveLength(0);
      expect(projectionResult.projected).toBeGreaterThan(0);

      for (const target of topology.targets) {
        const targetDir = resolveProjectionPath(target.path, ctx.tempDir);
        expect(await pathExists(targetDir)).toBe(true);

        const entries = await readdir(targetDir);
        expect(entries.length).toBeGreaterThan(0);
      }

      expect(config.agentHarnesses).toContain("codex");
      expect(config.agentHarnesses).toContain("claude-code");
    });

    it("produces no install errors", async () => {
      const { installResult } = await runFullInit(ctx);
      expect(installResult.errors).toHaveLength(0);
    });

    it("produces no resolution conflicts", async () => {
      const { resolution } = await runFullInit(ctx);
      expect(resolution.conflicts).toHaveLength(0);
      expect(resolution.nonOverridableConflicts).toHaveLength(0);
    });
  });

  describe("scenario 2: existing client project", () => {
    beforeEach(async () => {
      await copyFixtureToProject(ctx, "existing-client-project");
    });

    it("applies client overrides to CodeFlex defaults", async () => {
      const { resolution } = await runFullInit(ctx, { clientSkillsDir: "client" });

      expect(Object.keys(resolution.overrides).length).toBeGreaterThan(0);
      expect(resolution.overrides["DOTNET-002"]).toBe("client-dotnet");
    });

    it("records resolved overrides in lockfile", async () => {
      await runFullInit(ctx, { clientSkillsDir: "client" });

      const lock = await loadLock(ctx.tempDir);
      expect(lock).not.toBeNull();
      expect(lock!.resolvedOverrides).toBeDefined();
      expect(lock!.resolvedOverrides!["DOTNET-002"]).toBe("client-dotnet");
    });

    it("installs codeflex skills alongside client overrides", async () => {
      await runFullInit(ctx, { clientSkillsDir: "client" });

      const installedEntries = await readdir(join(ctx.tempDir, ".codeflex", "skills"));
      expect(installedEntries).toContain("codeflex-dotnet");
      expect(installedEntries).toContain("codeflex-security");
    });

    it("creates valid config and lock", async () => {
      await runFullInit(ctx, { clientSkillsDir: "client" });

      const config = await loadConfig(ctx.tempDir);
      const lock = await loadLock(ctx.tempDir);

      expect(config).not.toBeNull();
      expect(lock).not.toBeNull();
      expect(config!.standards.codeflex.enabled).toBe(true);
      expect(lock!.skills.length).toBeGreaterThan(0);
    });

    it("creates AGENTS.md with managed section", async () => {
      await runFullInit(ctx, { clientSkillsDir: "client" });

      const agentsContent = await readFile(join(ctx.tempDir, "AGENTS.md"), "utf-8");
      expect(agentsContent).toContain("<!-- codeflex-engineering-standards:start -->");
    });

    it("generates projections for configured harnesses", async () => {
      const { topology, projectionResult } = await runFullInit(ctx, { clientSkillsDir: "client" });

      expect(projectionResult.errors).toHaveLength(0);

      for (const target of topology.targets) {
        expect(await pathExists(resolveProjectionPath(target.path, ctx.tempDir))).toBe(true);
      }
    });
  });

  describe("scenario 3: conflicting standards", () => {
    beforeEach(async () => {
      await copyFixtureToProject(ctx, "conflicting-standards");
    });

    it("resolves SEC-001 conflict in favor of codeflex-security", async () => {
      const { resolution } = await runFullInit(ctx, { clientSkillsDir: "client" });

      expect(resolution.overrides["SEC-001"]).toBe("codeflex-security");
    });

    it("excludes overridden skill from final resolved set", async () => {
      const { resolution } = await runFullInit(ctx, { clientSkillsDir: "client" });
      const skillIds = resolution.skills.map((s) => s.id);

      expect(skillIds).not.toContain("codeflex-security");
      expect(skillIds).toContain("codeflex-dotnet");
    });

    it("reports conflicts with source information", async () => {
      const { resolution } = await runFullInit(ctx, { clientSkillsDir: "client" });

      for (const conflict of resolution.conflicts) {
        expect(conflict.rule).toBeDefined();
        expect(conflict.sources.length).toBeGreaterThan(0);
      }
    });

    it("still creates config and lock artifacts", async () => {
      await runFullInit(ctx, { clientSkillsDir: "client" });

      expect(await pathExists(join(ctx.tempDir, ".codeflex", "engineering.yaml"))).toBe(true);
      expect(await pathExists(join(ctx.tempDir, ".codeflex", "engineering.lock"))).toBe(true);
    });

    it("detects .NET and ASP.NET Core technologies", async () => {
      const { detection } = await runFullInit(ctx, { clientSkillsDir: "client" });
      const techNames = detection.technologies.map((t) => t.name);

      expect(techNames).toContain("dotnet");
      expect(techNames).toContain("aspnet-core");
    });
  });

  describe("scenario 4: monorepo", () => {
    beforeEach(async () => {
      await copyFixtureToProject(ctx, "monorepo-integration");
    });

    it("resolves skills for all detected technologies", async () => {
      const { resolution } = await runFullInit(ctx);
      const skillIds = resolution.skills.map((s) => s.id);

      expect(skillIds).toContain("codeflex-dotnet");
      expect(skillIds).toContain("codeflex-angular");
      expect(skillIds).toContain("codeflex-security");
    });

    it("detects multiple technologies with correct scopes", async () => {
      const { detection } = await runFullInit(ctx);
      const techNames = detection.technologies.map((t) => t.name);

      expect(techNames).toContain("dotnet");
      expect(techNames).toContain("angular");
      expect(techNames).toContain("react-native");
      expect(techNames).toContain("entity-framework-core");
    });

    it("applies per-skill scopes from detection", async () => {
      const { config } = await runFullInit(ctx);

      expect(Object.keys(config.scopes).length).toBeGreaterThan(0);
    });

    it("installs all resolved skills to canonical store", async () => {
      const { resolution } = await runFullInit(ctx);

      const installedEntries = await readdir(join(ctx.tempDir, ".codeflex", "skills"));
      for (const skill of resolution.skills) {
        expect(installedEntries).toContain(skill.id);
      }
    });

    it("generates projections with skills for all harnesses", async () => {
      const { topology, projectionResult, resolution } = await runFullInit(ctx);

      expect(projectionResult.errors).toHaveLength(0);

      for (const target of topology.targets) {
        const targetDir = resolveProjectionPath(target.path, ctx.tempDir);
        expect(await pathExists(targetDir)).toBe(true);

        const entries = await readdir(targetDir);
        for (const skill of resolution.skills) {
          expect(entries).toContain(skill.id);
        }
      }
    });

    it("creates AGENTS.md and CLAUDE.md", async () => {
      await runFullInit(ctx);

      expect(await pathExists(join(ctx.tempDir, "AGENTS.md"))).toBe(true);
      expect(await pathExists(join(ctx.tempDir, "CLAUDE.md"))).toBe(true);

      const agentsContent = await readFile(join(ctx.tempDir, "AGENTS.md"), "utf-8");
      expect(agentsContent).toContain("<!-- codeflex-engineering-standards:start -->");
    });

    it("produces no install or projection errors", async () => {
      const { installResult, projectionResult } = await runFullInit(ctx);

      expect(installResult.errors).toHaveLength(0);
      expect(projectionResult.errors).toHaveLength(0);
    });

    it("creates valid lockfile with all skills and projections", async () => {
      const { resolution, topology } = await runFullInit(ctx);

      const lock = await loadLock(ctx.tempDir);
      expect(lock).not.toBeNull();
      expect(lock!.skills.length).toBe(resolution.skills.length);
      expect(lock!.projections.length).toBe(topology.targets.length);
    });
  });
});
