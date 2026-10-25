import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { resolveStandards } from "../../../src/resolution/index";
import { loadSkillsFromSource } from "../../../src/resolution/skill-loader";
import type { DetectionResult, EngineeringConfig } from "../../../src/types/index";

const fixturesDir = join(import.meta.dirname, "../../fixtures/skills");
const codeflexDir = join(fixturesDir, "codeflex");

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

describe("resolveStandards — override precedence", () => {
  it("non-overridable codeflex wins over overridable client at same rule", async () => {
    const codeflexSkills = await loadSkillsFromSource(codeflexDir, "codeflex");
    const detection = makeDetection({
      technologies: [
        { name: "microsoft.net.sdk", version: "8.0.0", matchedBy: "PackageReference" },
      ],
    });

    const conflictingClientSkill = {
      id: "client-security-override",
      source: "client" as const,
      manifest: { name: "client-security-override", description: "Conflicts with security" },
      metadata: {
        id: "client-security-override",
        source: "client" as const,
        overridePolicy: "allowed" as const,
        owner: { team: "client" },
        rules: ["SEC-001"],
      },
      skillDir: "/tmp/test",
    };

    const result = await resolveStandards({
      detection,
      config: makeConfig(),
      codeflexSkills,
      clientSkills: [conflictingClientSkill],
      repositorySkills: [],
    });

    expect(result.overrides["SEC-001"]).toBe("codeflex-security");
    expect(result.nonOverridableConflicts.find((c) => c.rule === "SEC-001")).toBeUndefined();
  });

  it("reports escalated conflict when two non-overridable skills at same tier collide", async () => {
    const detection = makeDetection();

    const clientA = {
      id: "client-a",
      source: "client" as const,
      manifest: { name: "client-a", description: "Client A" },
      metadata: {
        id: "client-a",
        source: "client" as const,
        overridePolicy: "required" as const,
        owner: { team: "team-a" },
        rules: ["SHARED-RULE"],
      },
      skillDir: "/tmp/test",
    };

    const clientB = {
      id: "client-b",
      source: "client" as const,
      manifest: { name: "client-b", description: "Client B" },
      metadata: {
        id: "client-b",
        source: "client" as const,
        overridePolicy: "required" as const,
        owner: { team: "team-b" },
        rules: ["SHARED-RULE"],
      },
      skillDir: "/tmp/test",
    };

    const result = await resolveStandards({
      detection,
      config: makeConfig(),
      codeflexSkills: [],
      clientSkills: [clientA, clientB],
      repositorySkills: [],
    });

    expect(result.nonOverridableConflicts).toHaveLength(1);
    const conflict = result.nonOverridableConflicts[0]!;
    expect(conflict.rule).toBe("SHARED-RULE");
    expect(conflict.nonOverridable).toBe(true);
    expect(conflict.sources).toContain("client-a");
    expect(conflict.sources).toContain("client-b");
  });

  it("client overridable beats non-overridable repository", async () => {
    const detection = makeDetection();

    const clientSkill = {
      id: "client-rule",
      source: "client" as const,
      manifest: { name: "client-rule", description: "Client" },
      metadata: {
        id: "client-rule",
        source: "client" as const,
        overridePolicy: "allowed" as const,
        owner: { team: "client" },
        rules: ["RULE-X"],
      },
      skillDir: "/tmp/test",
    };

    const repoSkill = {
      id: "repo-rule",
      source: "repository" as const,
      manifest: { name: "repo-rule", description: "Repo" },
      metadata: {
        id: "repo-rule",
        source: "repository" as const,
        overridePolicy: "required" as const,
        owner: { team: "repo" },
        rules: ["RULE-X", "RULE-Y"],
      },
      skillDir: "/tmp/test",
    };

    const result = await resolveStandards({
      detection,
      config: makeConfig(),
      codeflexSkills: [],
      clientSkills: [clientSkill],
      repositorySkills: [repoSkill],
    });

    expect(result.overrides["RULE-X"]).toBe("client-rule");
    const skillIds = result.skills.map((s) => s.id);
    expect(skillIds).toContain("repo-rule");
  });

  it("non-overridable client beats overridable codeflex", async () => {
    const detection = makeDetection({
      technologies: [
        { name: "microsoft.net.sdk", version: "8.0.0", matchedBy: "PackageReference" },
      ],
    });

    const clientSkill = {
      id: "client-non-override",
      source: "client" as const,
      manifest: { name: "client-non-override", description: "Client" },
      metadata: {
        id: "client-non-override",
        source: "client" as const,
        overridePolicy: "required" as const,
        owner: { team: "client" },
        rules: ["DOTNET-001"],
      },
      skillDir: "/tmp/test",
    };

    const codeflexSkills = await loadSkillsFromSource(codeflexDir, "codeflex");

    const result = await resolveStandards({
      detection,
      config: makeConfig(),
      codeflexSkills,
      clientSkills: [clientSkill],
      repositorySkills: [],
    });

    expect(result.overrides["DOTNET-001"]).toBe("client-non-override");
  });

  it("includes repository skills as a precedence layer between client and codeflex", async () => {
    const codeflexSkills = await loadSkillsFromSource(codeflexDir, "codeflex");
    const repositorySkills = await loadSkillsFromSource(
      join(fixturesDir, "repository"),
      "repository"
    );
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
      repositorySkills,
    });

    const skillIds = result.skills.map((s) => s.id);
    expect(skillIds).toContain("repo-dotnet");
    const repoSkill = result.skills.find((s) => s.id === "repo-dotnet");
    expect(repoSkill?.source).toBe("repository");
  });

  it("repository skills override codeflex skills on conflicting rules", async () => {
    const codeflexSkills = await loadSkillsFromSource(codeflexDir, "codeflex");
    const detection = makeDetection({
      technologies: [
        { name: "microsoft.net.sdk", version: "8.0.0", matchedBy: "PackageReference" },
      ],
    });

    const repoSkill = {
      id: "repo-dotnet-override",
      source: "repository" as const,
      manifest: { name: "repo-dotnet-override", description: "Overrides DOTNET-001" },
      metadata: {
        id: "repo-dotnet-override",
        source: "repository" as const,
        overridePolicy: "allowed" as const,
        owner: { team: "repo" },
        rules: ["DOTNET-001"],
        overrides: ["DOTNET-001"],
      },
      skillDir: "/tmp/test",
    };

    const result = await resolveStandards({
      detection,
      config: makeConfig(),
      codeflexSkills,
      clientSkills: [],
      repositorySkills: [repoSkill],
    });

    expect(result.overrides["DOTNET-001"]).toBe("repo-dotnet-override");
  });

  it("client skills take precedence over repository skills", async () => {
    const codeflexSkills = await loadSkillsFromSource(codeflexDir, "codeflex");
    const detection = makeDetection({
      technologies: [
        { name: "microsoft.net.sdk", version: "8.0.0", matchedBy: "PackageReference" },
      ],
    });

    const clientSkill = {
      id: "client-dotnet-custom",
      source: "client" as const,
      manifest: { name: "client-dotnet-custom", description: "Client override" },
      metadata: {
        id: "client-dotnet-custom",
        source: "client" as const,
        overridePolicy: "allowed" as const,
        owner: { team: "client" },
        rules: ["DOTNET-001"],
        overrides: ["DOTNET-001"],
      },
      skillDir: "/tmp/test",
    };

    const repoSkill = {
      id: "repo-dotnet-override",
      source: "repository" as const,
      manifest: { name: "repo-dotnet-override", description: "Repo override" },
      metadata: {
        id: "repo-dotnet-override",
        source: "repository" as const,
        overridePolicy: "allowed" as const,
        owner: { team: "repo" },
        rules: ["DOTNET-001"],
        overrides: ["DOTNET-001"],
      },
      skillDir: "/tmp/test",
    };

    const result = await resolveStandards({
      detection,
      config: makeConfig(),
      codeflexSkills,
      clientSkills: [clientSkill],
      repositorySkills: [repoSkill],
    });

    expect(result.overrides["DOTNET-001"]).toBe("client-dotnet-custom");
  });

  it("nonOverridableRules prevents override of specific rules while allowing others", async () => {
    const detection = makeDetection();

    const codeflexSkill = {
      id: "codeflex-mixed",
      source: "codeflex" as const,
      manifest: { name: "codeflex-mixed", description: "Mixed override policy" },
      metadata: {
        id: "codeflex-mixed",
        source: "codeflex" as const,
        overridePolicy: "allowed" as const,
        owner: { team: "codeflex" },
        rules: ["SEC-001", "SEC-002"],
        nonOverridableRules: ["SEC-001"],
      },
      skillDir: "/tmp/test",
    };

    const clientSkill = {
      id: "client-mixed",
      source: "client" as const,
      manifest: { name: "client-mixed", description: "Client overrides" },
      metadata: {
        id: "client-mixed",
        source: "client" as const,
        overridePolicy: "allowed" as const,
        owner: { team: "client" },
        rules: ["SEC-001", "SEC-002"],
        overrides: ["SEC-001", "SEC-002"],
      },
      skillDir: "/tmp/test",
    };

    const result = await resolveStandards({
      detection,
      config: makeConfig(),
      codeflexSkills: [codeflexSkill],
      clientSkills: [clientSkill],
      repositorySkills: [],
    });

    expect(result.overrides["SEC-001"]).toBe("codeflex-mixed");
    expect(result.overrides["SEC-002"]).toBe("client-mixed");
  });

  it("client cannot override a rule listed in nonOverridableRules", async () => {
    const detection = makeDetection();

    const codeflexSkill = {
      id: "codeflex-secure",
      source: "codeflex" as const,
      manifest: { name: "codeflex-secure", description: "Secure skill" },
      metadata: {
        id: "codeflex-secure",
        source: "codeflex" as const,
        overridePolicy: "allowed" as const,
        owner: { team: "codeflex" },
        rules: ["SEC-001"],
        nonOverridableRules: ["SEC-001"],
      },
      skillDir: "/tmp/test",
    };

    const clientSkill = {
      id: "client-sec-override",
      source: "client" as const,
      manifest: { name: "client-sec-override", description: "Client SEC override" },
      metadata: {
        id: "client-sec-override",
        source: "client" as const,
        overridePolicy: "allowed" as const,
        owner: { team: "client" },
        rules: ["SEC-001"],
        overrides: ["SEC-001"],
      },
      skillDir: "/tmp/test",
    };

    const result = await resolveStandards({
      detection,
      config: makeConfig(),
      codeflexSkills: [codeflexSkill],
      clientSkills: [clientSkill],
      repositorySkills: [],
    });

    expect(result.overrides["SEC-001"]).toBe("codeflex-secure");
    expect(result.nonOverridableConflicts.find((c) => c.rule === "SEC-001")).toBeUndefined();
  });

  it("client can override rules not in nonOverridableRules", async () => {
    const detection = makeDetection();

    const codeflexSkill = {
      id: "codeflex-partial",
      source: "codeflex" as const,
      manifest: { name: "codeflex-partial", description: "Partial non-overridable" },
      metadata: {
        id: "codeflex-partial",
        source: "codeflex" as const,
        overridePolicy: "allowed" as const,
        owner: { team: "codeflex" },
        rules: ["SEC-001", "SEC-002", "SEC-003"],
        nonOverridableRules: ["SEC-001"],
      },
      skillDir: "/tmp/test",
    };

    const clientSkill = {
      id: "client-partial",
      source: "client" as const,
      manifest: { name: "client-partial", description: "Client partial" },
      metadata: {
        id: "client-partial",
        source: "client" as const,
        overridePolicy: "allowed" as const,
        owner: { team: "client" },
        rules: ["SEC-001", "SEC-002", "SEC-003"],
        overrides: ["SEC-001", "SEC-002", "SEC-003"],
      },
      skillDir: "/tmp/test",
    };

    const result = await resolveStandards({
      detection,
      config: makeConfig(),
      codeflexSkills: [codeflexSkill],
      clientSkills: [clientSkill],
      repositorySkills: [],
    });

    expect(result.overrides["SEC-001"]).toBe("codeflex-partial");
    expect(result.overrides["SEC-002"]).toBe("client-partial");
    expect(result.overrides["SEC-003"]).toBe("client-partial");
  });
});
