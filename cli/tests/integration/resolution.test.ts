import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { detectProject } from "../../src/detection/index";
import { resolveStandards } from "../../src/resolution/index";
import { loadSkillsFromSource } from "../../src/resolution/skill-loader";
import type { EngineeringConfig } from "../../src/types/index";

const fixturesDir = join(import.meta.dirname, "../fixtures");

function fixturePath(name: string): string {
  return join(fixturesDir, name);
}

function makeConfig(overrides?: Partial<EngineeringConfig>): EngineeringConfig {
  return {
    version: 1,
    autoDetect: true,
    agentHarnesses: ["codex", "claude-code", "opencode", "kilo"],
    standards: { codeflex: { enabled: true } },
    include: [],
    exclude: [],
    scopes: {},
    exceptions: [],
    ...overrides,
  };
}

describe("integration: resolution with fixtures", () => {
  describe("greenfield-dotnet-angular", () => {
    it("resolves codeflex-dotnet, codeflex-angular, and codeflex-security", async () => {
      const skillsDir = join(fixturePath("greenfield-dotnet-angular"), ".codeflex", "skills-source");
      const codeflexSkills = await loadSkillsFromSource(join(skillsDir, "codeflex"), "codeflex");
      const detection = await detectProject(fixturePath("greenfield-dotnet-angular"));

      const result = await resolveStandards({
        detection,
        config: makeConfig(),
        codeflexSkills,
        clientSkills: [],
        repositorySkills: [],
      });

      const skillIds = result.skills.map((s) => s.id);
      expect(skillIds).toContain("codeflex-dotnet");
      expect(skillIds).toContain("codeflex-angular");
      expect(skillIds).toContain("codeflex-security");
    });

    it("includes codeflex-security because overridePolicy is required", async () => {
      const skillsDir = join(fixturePath("greenfield-dotnet-angular"), ".codeflex", "skills-source");
      const codeflexSkills = await loadSkillsFromSource(join(skillsDir, "codeflex"), "codeflex");
      const detection = await detectProject(fixturePath("greenfield-dotnet-angular"));

      const result = await resolveStandards({
        detection,
        config: makeConfig(),
        codeflexSkills,
        clientSkills: [],
        repositorySkills: [],
      });

      const securitySkill = result.skills.find((s) => s.id === "codeflex-security");
      expect(securitySkill).toBeDefined();
      expect(securitySkill?.source).toBe("codeflex");
    });

    it("generates explanations for all resolved skills", async () => {
      const skillsDir = join(fixturePath("greenfield-dotnet-angular"), ".codeflex", "skills-source");
      const codeflexSkills = await loadSkillsFromSource(join(skillsDir, "codeflex"), "codeflex");
      const detection = await detectProject(fixturePath("greenfield-dotnet-angular"));

      const result = await resolveStandards({
        detection,
        config: makeConfig(),
        codeflexSkills,
        clientSkills: [],
        repositorySkills: [],
      });

      expect(result.explanation.length).toBeGreaterThanOrEqual(3);
      const dotnetExplanation = result.explanation.find((e) => e.skillId === "codeflex-dotnet");
      expect(dotnetExplanation).toBeDefined();
      expect(dotnetExplanation?.reason).toContain("install conditions");
    });
  });

  describe("existing-client-project", () => {
    it("applies client overrides for DOTNET-002", async () => {
      const skillsDir = join(fixturePath("existing-client-project"), ".codeflex", "skills-source");
      const codeflexSkills = await loadSkillsFromSource(join(skillsDir, "codeflex"), "codeflex");
      const clientSkills = await loadSkillsFromSource(join(skillsDir, "client"), "client");
      const detection = await detectProject(fixturePath("existing-client-project"));

      const result = await resolveStandards({
        detection,
        config: makeConfig(),
        codeflexSkills,
        clientSkills,
        repositorySkills: [],
      });

      expect(result.overrides["DOTNET-002"]).toBe("client-dotnet");
    });

    it("still includes codeflex-security as non-overridable", async () => {
      const skillsDir = join(fixturePath("existing-client-project"), ".codeflex", "skills-source");
      const codeflexSkills = await loadSkillsFromSource(join(skillsDir, "codeflex"), "codeflex");
      const clientSkills = await loadSkillsFromSource(join(skillsDir, "client"), "client");
      const detection = await detectProject(fixturePath("existing-client-project"));

      const result = await resolveStandards({
        detection,
        config: makeConfig(),
        codeflexSkills,
        clientSkills,
        repositorySkills: [],
      });

      const skillIds = result.skills.map((s) => s.id);
      expect(skillIds).toContain("codeflex-security");
    });

    it("includes codeflex-dotnet in resolved skills", async () => {
      const skillsDir = join(fixturePath("existing-client-project"), ".codeflex", "skills-source");
      const codeflexSkills = await loadSkillsFromSource(join(skillsDir, "codeflex"), "codeflex");
      const clientSkills = await loadSkillsFromSource(join(skillsDir, "client"), "client");
      const detection = await detectProject(fixturePath("existing-client-project"));

      const result = await resolveStandards({
        detection,
        config: makeConfig(),
        codeflexSkills,
        clientSkills,
        repositorySkills: [],
      });

      const skillIds = result.skills.map((s) => s.id);
      expect(skillIds).toContain("codeflex-dotnet");
    });
  });

  describe("conflicting-standards", () => {
    it("reports overrides for SEC-001", async () => {
      const skillsDir = join(fixturePath("conflicting-standards"), ".codeflex", "skills-source");
      const codeflexSkills = await loadSkillsFromSource(join(skillsDir, "codeflex"), "codeflex");
      const clientSkills = await loadSkillsFromSource(join(skillsDir, "client"), "client");
      const detection = await detectProject(fixturePath("conflicting-standards"));

      const result = await resolveStandards({
        detection,
        config: makeConfig(),
        codeflexSkills,
        clientSkills,
        repositorySkills: [],
      });

      expect(result.overrides["SEC-001"]).toBeDefined();
    });

    it("includes codeflex-dotnet in resolved skills", async () => {
      const skillsDir = join(fixturePath("conflicting-standards"), ".codeflex", "skills-source");
      const codeflexSkills = await loadSkillsFromSource(join(skillsDir, "codeflex"), "codeflex");
      const clientSkills = await loadSkillsFromSource(join(skillsDir, "client"), "client");
      const detection = await detectProject(fixturePath("conflicting-standards"));

      const result = await resolveStandards({
        detection,
        config: makeConfig(),
        codeflexSkills,
        clientSkills,
        repositorySkills: [],
      });

      const skillIds = result.skills.map((s) => s.id);
      expect(skillIds).toContain("codeflex-dotnet");
    });
  });

  describe("monorepo-integration", () => {
    it("resolves skills for all detected technologies", async () => {
      const skillsDir = join(fixturePath("monorepo-integration"), ".codeflex", "skills-source");
      const codeflexSkills = await loadSkillsFromSource(join(skillsDir, "codeflex"), "codeflex");
      const detection = await detectProject(fixturePath("monorepo-integration"));

      const result = await resolveStandards({
        detection,
        config: makeConfig(),
        codeflexSkills,
        clientSkills: [],
        repositorySkills: [],
      });

      const skillIds = result.skills.map((s) => s.id);
      expect(skillIds).toContain("codeflex-dotnet");
      expect(skillIds).toContain("codeflex-angular");
      expect(skillIds).toContain("codeflex-security");
    });

    it("resolves dotnet skill for detected dotnet technology", async () => {
      const skillsDir = join(fixturePath("monorepo-integration"), ".codeflex", "skills-source");
      const codeflexSkills = await loadSkillsFromSource(join(skillsDir, "codeflex"), "codeflex");
      const detection = await detectProject(fixturePath("monorepo-integration"));

      const result = await resolveStandards({
        detection,
        config: makeConfig(),
        codeflexSkills,
        clientSkills: [],
        repositorySkills: [],
      });

      const skillIds = result.skills.map((s) => s.id);
      expect(skillIds).toContain("codeflex-dotnet");
      expect(result.dependencyWarnings).not.toContain("codeflex-dotnet");
    });

    it("applies scopes from config to resolved skills", async () => {
      const skillsDir = join(fixturePath("monorepo-integration"), ".codeflex", "skills-source");
      const codeflexSkills = await loadSkillsFromSource(join(skillsDir, "codeflex"), "codeflex");
      const detection = await detectProject(fixturePath("monorepo-integration"));

      const config = makeConfig({ scopes: { "codeflex-dotnet": ["src/backend/**"] } });

      const result = await resolveStandards({
        detection,
        config,
        codeflexSkills,
        clientSkills: [],
        repositorySkills: [],
      });

      const dotnetSkill = result.skills.find((s) => s.id === "codeflex-dotnet");
      expect(dotnetSkill?.scopes).toBeDefined();
      expect(dotnetSkill?.scopes).toEqual(["src/backend/**"]);
    });
  });
});
