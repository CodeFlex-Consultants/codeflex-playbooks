import { describe, it, expect } from "vitest";
import { resolveStandards } from "../../../src/resolution/index";
import type { DetectionResult, EngineeringConfig } from "../../../src/types/index";

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

describe("resolveStandards — capability filtering", () => {
  it("filters skills by appliesWhen.capabilities when project has matching capabilities", async () => {
    const detection = makeDetection({
      technologies: [
        { name: "postgres", version: "14.0.0", matchedBy: "package.json:pg" },
        { name: "react", version: "18.0.0", matchedBy: "package.json:react" },
      ],
      capabilities: ["database", "persistence", "backend"],
    });

    const dbSkill = {
      id: "codeflex-db",
      source: "codeflex" as const,
      manifest: { name: "codeflex-db", description: "Database skill" },
      metadata: {
        id: "codeflex-db",
        source: "codeflex" as const,
        overridePolicy: "allowed" as const,
        owner: { team: "codeflex" },
        rules: ["DB-001"],
        installWhen: { any: [{ packageReference: { package: "pg", version: ">=0.0.0" } }] },
        appliesWhen: { capabilities: ["database", "persistence"] },
      },
      skillDir: "/tmp/test",
    };

    const frontendSkill = {
      id: "codeflex-frontend",
      source: "codeflex" as const,
      manifest: { name: "codeflex-frontend", description: "Frontend skill" },
      metadata: {
        id: "codeflex-frontend",
        source: "codeflex" as const,
        overridePolicy: "allowed" as const,
        owner: { team: "codeflex" },
        rules: ["FE-001"],
        installWhen: { any: [{ packageReference: { package: "react", version: ">=0.0.0" } }] },
        appliesWhen: { capabilities: ["frontend", "ui"] },
      },
      skillDir: "/tmp/test",
    };

    const result = await resolveStandards({
      detection,
      config: makeConfig(),
      codeflexSkills: [dbSkill, frontendSkill],
      clientSkills: [],
      repositorySkills: [],
    });

    const skillIds = result.skills.map((s) => s.id);
    expect(skillIds).toContain("codeflex-db");
    expect(skillIds).not.toContain("codeflex-frontend");
  });

  it("includes skills with no appliesWhen.capabilities regardless of project capabilities", async () => {
    const detection = makeDetection({
      capabilities: ["database"],
    });

    const universalSkill = {
      id: "codeflex-universal",
      source: "codeflex" as const,
      manifest: { name: "codeflex-universal", description: "Universal skill" },
      metadata: {
        id: "codeflex-universal",
        source: "codeflex" as const,
        overridePolicy: "allowed" as const,
        owner: { team: "codeflex" },
        rules: ["UNI-001"],
      },
      skillDir: "/tmp/test",
    };

    const result = await resolveStandards({
      detection,
      config: makeConfig(),
      codeflexSkills: [universalSkill],
      clientSkills: [],
      repositorySkills: [],
    });

    const skillIds = result.skills.map((s) => s.id);
    expect(skillIds).toContain("codeflex-universal");
  });

  it("excludes skills when no capabilities match", async () => {
    const detection = makeDetection({
      technologies: [
        { name: "docker", version: "20.0.0", matchedBy: "Dockerfile" },
      ],
      capabilities: ["mobile"],
    });

    const cloudSkill = {
      id: "codeflex-cloud",
      source: "codeflex" as const,
      manifest: { name: "codeflex-cloud", description: "Cloud skill" },
      metadata: {
        id: "codeflex-cloud",
        source: "codeflex" as const,
        overridePolicy: "allowed" as const,
        owner: { team: "codeflex" },
        rules: ["CLD-001"],
        installWhen: { any: [{ file: { pattern: "**/Dockerfile" } }] },
        appliesWhen: { capabilities: ["cloud", "infrastructure"] },
      },
      skillDir: "/tmp/test",
    };

    const result = await resolveStandards({
      detection,
      config: makeConfig(),
      codeflexSkills: [cloudSkill],
      clientSkills: [],
      repositorySkills: [],
    });

    const skillIds = result.skills.map((s) => s.id);
    expect(skillIds).not.toContain("codeflex-cloud");
  });
});
