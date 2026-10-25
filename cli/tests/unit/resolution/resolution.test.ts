import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { resolveStandards } from "../../../src/resolution/index";
import { loadSkillsFromSource } from "../../../src/resolution/skill-loader";
import type { DetectionResult, EngineeringConfig } from "../../../src/types/index";

const fixturesDir = join(import.meta.dirname, "../../fixtures/skills");
const codeflexDir = join(fixturesDir, "codeflex");
const clientDir = join(fixturesDir, "client");

function makeConfig(overrides?: Partial<EngineeringConfig>): EngineeringConfig {
  return {
    version: 1,
    autoDetect: true,
    agentHarnesses: ["codex"],
    standards: { codeflex: { enabled: true } },
    include: [],
    exclude: [],
    scopes: {},
    exceptions: [],
    ...overrides,
  };
}

function makeDetection(overrides?: Partial<DetectionResult>): DetectionResult {
  return {
    technologies: [],
    scopes: {},
    capabilities: [],
    ...overrides,
  };
}

describe("resolveStandards — core", () => {
  it("resolves codeflex skills based on detection", async () => {
    const codeflexSkills = await loadSkillsFromSource(codeflexDir, "codeflex");
    const detection = makeDetection({
      technologies: [
        { name: "microsoft.net.sdk", version: "8.0.0", matchedBy: "PackageReference" },
      ],
    });

    const result = await resolveStandards({
      detection,
      config: makeConfig(),
      codeflexSkills,
      clientSkills: [],
      repositorySkills: [],
    });

    const skillIds = result.skills.map((s) => s.id);
    expect(skillIds).toContain("backend.dotnet");
    expect(skillIds).toContain("common.security");
  });

  it("marks skills without install conditions as cross-cutting", async () => {
    const codeflexSkills = await loadSkillsFromSource(codeflexDir, "codeflex");
    const detection = makeDetection({
      technologies: [
        { name: "microsoft.net.sdk", version: "8.0.0", matchedBy: "PackageReference" },
      ],
    });

    const result = await resolveStandards({
      detection,
      config: makeConfig(),
      codeflexSkills,
      clientSkills: [],
      repositorySkills: [],
    });

    const crossCutting = result.skills.filter((s) => s.crossCutting);
    const techSpecific = result.skills.filter((s) => !s.crossCutting);

    expect(crossCutting.map((s) => s.id)).toContain("common.security");
    expect(techSpecific.map((s) => s.id)).toContain("backend.dotnet");
  });

  it("resolves EF Core with dependency on dotnet", async () => {
    const codeflexSkills = await loadSkillsFromSource(codeflexDir, "codeflex");
    const detection = makeDetection({
      technologies: [
        { name: "microsoft.net.sdk", version: "8.0.0", matchedBy: "PackageReference" },
        { name: "microsoft.entityframeworkcore", version: "8.0.2", matchedBy: "PackageReference" },
      ],
    });

    const result = await resolveStandards({
      detection,
      config: makeConfig(),
      codeflexSkills,
      clientSkills: [],
      repositorySkills: [],
    });

    const skillIds = result.skills.map((s) => s.id);
    expect(skillIds).toContain("backend.entity-framework");
    expect(skillIds).toContain("backend.dotnet");
  });

  it("applies client overrides", async () => {
    const codeflexSkills = await loadSkillsFromSource(codeflexDir, "codeflex");
    const clientSkills = await loadSkillsFromSource(clientDir, "client");

    const detection = makeDetection({
      technologies: [
        { name: "microsoft.net.sdk", version: "8.0.0", matchedBy: "PackageReference" },
      ],
    });

    const result = await resolveStandards({
      detection,
      config: makeConfig(),
      codeflexSkills,
      clientSkills,
      repositorySkills: [],
    });

    expect(result.overrides["DOTNET-002"]).toBe("client-dotnet");
  });

  it("includes skills with overridePolicy required in explanation", async () => {
    const codeflexSkills = await loadSkillsFromSource(codeflexDir, "codeflex");
    const detection = makeDetection({
      technologies: [
        { name: "microsoft.net.sdk", version: "8.0.0", matchedBy: "PackageReference" },
      ],
    });

    const result = await resolveStandards({
      detection,
      config: makeConfig(),
      codeflexSkills,
      clientSkills: [],
      repositorySkills: [],
    });

    const securitySkill = result.explanation.find((e) => e.skillId === "common.security");
    expect(securitySkill).toBeDefined();
  });

  it("applies config.exclude", async () => {
    const codeflexSkills = await loadSkillsFromSource(codeflexDir, "codeflex");
    const detection = makeDetection({
      technologies: [
        { name: "microsoft.net.sdk", version: "8.0.0", matchedBy: "PackageReference" },
      ],
    });

    const result = await resolveStandards({
      detection,
      config: makeConfig({ exclude: ["codeflex-dotnet"] }),
      codeflexSkills,
      clientSkills: [],
      repositorySkills: [],
    });

    const skillIds = result.skills.map((s) => s.id);
    expect(skillIds).not.toContain("backend.dotnet");
  });

  it("applies config.include as additive to auto-detected skills", async () => {
    const codeflexSkills = await loadSkillsFromSource(codeflexDir, "codeflex");
    const detection = makeDetection({
      technologies: [
        { name: "microsoft.net.sdk", version: "8.0.0", matchedBy: "PackageReference" },
      ],
    });

    const result = await resolveStandards({
      detection,
      config: makeConfig({ include: ["codeflex-angular"] }),
      codeflexSkills,
      clientSkills: [],
      repositorySkills: [],
    });

    const skillIds = result.skills.map((s) => s.id);
    expect(skillIds).toContain("backend.dotnet");
    expect(skillIds).toContain("common.security");
    expect(skillIds).toContain("frontend.angular");
  });

  it("exclude takes precedence over include", async () => {
    const codeflexSkills = await loadSkillsFromSource(codeflexDir, "codeflex");
    const detection = makeDetection();

    const result = await resolveStandards({
      detection,
      config: makeConfig({
        include: ["codeflex-security"],
        exclude: ["codeflex-security"],
      }),
      codeflexSkills,
      clientSkills: [],
      repositorySkills: [],
    });

    const skillIds = result.skills.map((s) => s.id);
    expect(skillIds).not.toContain("common.security");
  });

  it("includes skills with no rules", async () => {
    const detection = makeDetection();

    const guidanceSkill = {
      id: "codeflex-guidance",
      source: "codeflex" as const,
      manifest: { name: "codeflex-guidance", description: "Guidance only" },
      metadata: {
        id: "codeflex-guidance",
        source: "codeflex" as const,
        overridePolicy: "allowed" as const,
        owner: { team: "codeflex" },
      },
      skillDir: "/tmp/test",
    };

    const result = await resolveStandards({
      detection,
      config: makeConfig(),
      codeflexSkills: [guidanceSkill],
      clientSkills: [],
      repositorySkills: [],
    });

    const skillIds = result.skills.map((s) => s.id);
    expect(skillIds).toContain("codeflex-guidance");
  });

  it("excludes skills whose rules are all excepted", async () => {
    const detection = makeDetection();

    const skill = {
      id: "codeflex-excepted",
      source: "codeflex" as const,
      manifest: { name: "codeflex-excepted", description: "Excepted skill" },
      metadata: {
        id: "codeflex-excepted",
        source: "codeflex" as const,
        overridePolicy: "allowed" as const,
        owner: { team: "codeflex" },
        rules: ["EXC-001"],
      },
      skillDir: "/tmp/test",
    };

    const result = await resolveStandards({
      detection,
      config: makeConfig({
        exceptions: [{ rule: "EXC-001", expires: "2030-01-01" }],
      }),
      codeflexSkills: [skill],
      clientSkills: [],
      repositorySkills: [],
    });

    const skillIds = result.skills.map((s) => s.id);
    expect(skillIds).not.toContain("codeflex-excepted");
  });

  it("handles expired exceptions", async () => {
    const codeflexSkills = await loadSkillsFromSource(codeflexDir, "codeflex");
    const detection = makeDetection({
      technologies: [
        { name: "microsoft.net.sdk", version: "8.0.0", matchedBy: "PackageReference" },
      ],
    });

    const result = await resolveStandards({
      detection,
      config: makeConfig({
        exceptions: [
          { rule: "DOTNET-001", expires: "2020-01-01" },
        ],
      }),
      codeflexSkills,
      clientSkills: [],
      repositorySkills: [],
    });

    expect(result.exceptions.expired).toHaveLength(1);
    expect(result.exceptions.expired[0]?.rule).toBe("DOTNET-001");
  });

  it("applies valid exceptions", async () => {
    const codeflexSkills = await loadSkillsFromSource(codeflexDir, "codeflex");
    const detection = makeDetection({
      technologies: [
        { name: "microsoft.net.sdk", version: "8.0.0", matchedBy: "PackageReference" },
      ],
    });

    const result = await resolveStandards({
      detection,
      config: makeConfig({
        exceptions: [
          { rule: "DOTNET-001", expires: "2030-01-01" },
        ],
      }),
      codeflexSkills,
      clientSkills: [],
      repositorySkills: [],
    });

    expect(result.exceptions.active).toHaveLength(1);
    expect(result.exceptions.active[0]?.rule).toBe("DOTNET-001");
  });

  it("applies scopes from config", async () => {
    const codeflexSkills = await loadSkillsFromSource(codeflexDir, "codeflex");
    const detection = makeDetection({
      technologies: [
        { name: "microsoft.net.sdk", version: "8.0.0", matchedBy: "PackageReference" },
      ],
    });

    const result = await resolveStandards({
      detection,
      config: makeConfig({
        scopes: { "codeflex-dotnet": ["src/backend/**"] },
      }),
      codeflexSkills,
      clientSkills: [],
      repositorySkills: [],
    });

    const dotnetSkill = result.skills.find((s) => s.id === "backend.dotnet");
    expect(dotnetSkill?.scopes).toEqual(["src/backend/**"]);
  });

  it("reports missing dependencies", async () => {
    const codeflexSkills = await loadSkillsFromSource(codeflexDir, "codeflex");
    const detection = makeDetection({
      technologies: [
        { name: "microsoft.entityframeworkcore", version: "8.0.2", matchedBy: "PackageReference" },
      ],
    });

    const result = await resolveStandards({
      detection,
      config: makeConfig(),
      codeflexSkills,
      clientSkills: [],
      repositorySkills: [],
    });

    const skillIds = result.skills.map((s) => s.id);
    expect(skillIds).toContain("backend.entity-framework");
    expect(result.dependencyWarnings).toContain("backend.dotnet");
  });

  it("does not reintroduce an excluded skill via a transitive dependency", async () => {
    const codeflexSkills = await loadSkillsFromSource(codeflexDir, "codeflex");
    const detection = makeDetection({
      technologies: [
        { name: "microsoft.net.sdk", version: "8.0.0", matchedBy: "PackageReference" },
        { name: "microsoft.entityframeworkcore", version: "8.0.2", matchedBy: "PackageReference" },
      ],
    });

    // codeflex-ef-core requires codeflex-dotnet, and both would normally be
    // auto-detected here. Excluding codeflex-dotnet must keep it out of the
    // final resolved set even though codeflex-ef-core still declares it as a
    // hard dependency.
    const result = await resolveStandards({
      detection,
      config: makeConfig({ exclude: ["codeflex-dotnet"] }),
      codeflexSkills,
      clientSkills: [],
      repositorySkills: [],
    });

    const skillIds = result.skills.map((s) => s.id);
    expect(skillIds).toContain("backend.entity-framework");
    expect(skillIds).not.toContain("backend.dotnet");
    expect(result.dependencyWarnings).toContain("backend.dotnet");
  });

  it("generates explanations", async () => {
    const codeflexSkills = await loadSkillsFromSource(codeflexDir, "codeflex");
    const detection = makeDetection({
      technologies: [
        { name: "microsoft.net.sdk", version: "8.0.0", matchedBy: "PackageReference" },
      ],
    });

    const result = await resolveStandards({
      detection,
      config: makeConfig(),
      codeflexSkills,
      clientSkills: [],
      repositorySkills: [],
    });

    expect(result.explanation.length).toBeGreaterThan(0);
    const dotnetExplanation = result.explanation.find((e) => e.skillId === "backend.dotnet");
    expect(dotnetExplanation).toBeDefined();
    expect(dotnetExplanation?.reason).toContain("install conditions");
  });

  it("reports technologies with no matching skill as unmatched", async () => {
    const codeflexSkills = await loadSkillsFromSource(codeflexDir, "codeflex");
    const detection = makeDetection({
      technologies: [
        { name: "microsoft.net.sdk", version: "8.0.0", matchedBy: "PackageReference" },
        { name: "flutter", version: "3.0.0", matchedBy: "pubspec.yaml:flutter" },
        { name: "django", version: "4.0.0", matchedBy: "requirements.txt:django" },
      ],
    });

    const result = await resolveStandards({
      detection,
      config: makeConfig(),
      codeflexSkills,
      clientSkills: [],
      repositorySkills: [],
    });

    const unmatchedNames = result.unmatchedTechnologies.map((t) => t.name);
    expect(unmatchedNames).toContain("flutter");
    expect(unmatchedNames).toContain("django");
    expect(unmatchedNames).not.toContain("microsoft.net.sdk");
  });

  it("returns empty unmatched list when all technologies have skills", async () => {
    const codeflexSkills = await loadSkillsFromSource(codeflexDir, "codeflex");
    const detection = makeDetection({
      technologies: [
        { name: "microsoft.net.sdk", version: "8.0.0", matchedBy: "PackageReference" },
      ],
    });

    const result = await resolveStandards({
      detection,
      config: makeConfig(),
      codeflexSkills,
      clientSkills: [],
      repositorySkills: [],
    });

    expect(result.unmatchedTechnologies).toHaveLength(0);
  });

  it("returns empty unmatched list when no technologies are detected", async () => {
    const codeflexSkills = await loadSkillsFromSource(codeflexDir, "codeflex");
    const detection = makeDetection();

    const result = await resolveStandards({
      detection,
      config: makeConfig(),
      codeflexSkills,
      clientSkills: [],
      repositorySkills: [],
    });

    expect(result.unmatchedTechnologies).toHaveLength(0);
  });

  it("does not count cross-cutting skills as matching a specific technology", async () => {
    const detection = makeDetection({
      technologies: [
        { name: "unknown-framework", version: "1.0.0", matchedBy: "package.json:unknown-framework" },
      ],
    });

    const crossCuttingSkill = {
      id: "codeflex-cross-cutting",
      slug: "codeflex-cross-cutting",
      source: "codeflex" as const,
      manifest: { name: "codeflex-cross-cutting", description: "Cross-cutting" },
      metadata: {
        id: "codeflex-cross-cutting",
        source: "codeflex" as const,
        overridePolicy: "allowed" as const,
        owner: { team: "codeflex" },
      },
      skillDir: "/tmp/test",
    };

    const result = await resolveStandards({
      detection,
      config: makeConfig(),
      codeflexSkills: [crossCuttingSkill],
      clientSkills: [],
      repositorySkills: [],
    });

    const unmatchedNames = result.unmatchedTechnologies.map((t) => t.name);
    expect(unmatchedNames).toContain("unknown-framework");
  });

  it("includes version and matchedBy in unmatched technology entries", async () => {
    const detection = makeDetection({
      technologies: [
        { name: "some-framework", version: "2.5.0", matchedBy: "package.json:some-framework" },
      ],
    });

    const result = await resolveStandards({
      detection,
      config: makeConfig(),
      codeflexSkills: [],
      clientSkills: [],
      repositorySkills: [],
    });

    expect(result.unmatchedTechnologies).toHaveLength(1);
    expect(result.unmatchedTechnologies[0]).toEqual({
      name: "some-framework",
      version: "2.5.0",
      matchedBy: "package.json:some-framework",
    });
  });

  it("matches vitest skill when vitest is detected", async () => {
    const codeflexSkills = await loadSkillsFromSource(codeflexDir, "codeflex");
    const detection = makeDetection({
      technologies: [
        { name: "vitest", version: "5.0.0", matchedBy: "package.json:vitest" },
      ],
      capabilities: ["testing"],
    });

    const result = await resolveStandards({
      detection,
      config: makeConfig(),
      codeflexSkills,
      clientSkills: [],
      repositorySkills: [],
    });

    const skillIds = result.skills.map((s) => s.id);
    expect(skillIds).toContain("common.vitest");
  });

  it("matches jest skill when jest is detected", async () => {
    const codeflexSkills = await loadSkillsFromSource(codeflexDir, "codeflex");
    const detection = makeDetection({
      technologies: [
        { name: "jest", version: "29.0.0", matchedBy: "package.json:jest" },
      ],
      capabilities: ["testing"],
    });

    const result = await resolveStandards({
      detection,
      config: makeConfig(),
      codeflexSkills,
      clientSkills: [],
      repositorySkills: [],
    });

    const skillIds = result.skills.map((s) => s.id);
    expect(skillIds).toContain("common.jest");
  });

  it("matches nextjs skill when next is detected", async () => {
    const codeflexSkills = await loadSkillsFromSource(codeflexDir, "codeflex");
    const detection = makeDetection({
      technologies: [
        { name: "nextjs", version: "14.0.0", matchedBy: "package.json:next" },
      ],
      capabilities: ["frontend", "ssr"],
    });

    const result = await resolveStandards({
      detection,
      config: makeConfig(),
      codeflexSkills,
      clientSkills: [],
      repositorySkills: [],
    });

    const skillIds = result.skills.map((s) => s.id);
    expect(skillIds).toContain("frontend.nextjs");
  });

  it("matches entity-framework-6 skill when EntityFramework is detected", async () => {
    const codeflexSkills = await loadSkillsFromSource(codeflexDir, "codeflex");
    const detection = makeDetection({
      technologies: [
        { name: "entityframework", version: "6.4.4", matchedBy: "Data.csproj:EntityFramework" },
      ],
      capabilities: ["database", "persistence"],
    });

    const result = await resolveStandards({
      detection,
      config: makeConfig(),
      codeflexSkills,
      clientSkills: [],
      repositorySkills: [],
    });

    const skillIds = result.skills.map((s) => s.id);
    expect(skillIds).toContain("backend.entity-framework-6");
  });
});
