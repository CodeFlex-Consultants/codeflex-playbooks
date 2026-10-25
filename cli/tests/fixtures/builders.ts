import type { DetectionResult, EngineeringConfig, LoadedSkill, EngineeringLock, ResolvedSkill } from "../../src/types/index";
import { SkillSource, OverridePolicy, AgentHarness } from "../../src/types/index";

export function mockDetection(overrides?: Partial<DetectionResult>): DetectionResult {
  return {
    technologies: [],
    scopes: {},
    capabilities: [],
    ...overrides,
  };
}

export function mockConfig(overrides?: Partial<EngineeringConfig>): EngineeringConfig {
  return {
    version: 1,
    autoDetect: true,
    agentHarnesses: [AgentHarness.Codex],
    standards: { codeflex: { enabled: true } },
    include: [],
    exclude: [],
    scopes: {},
    exceptions: [],
    ...overrides,
  };
}

export function mockLoadedSkill(overrides?: Partial<LoadedSkill>): LoadedSkill {
  return {
    id: "test.skill",
    slug: "test-skill",
    source: SkillSource.CodeFlex,
    manifest: { name: "test-skill", description: "Test skill" },
    metadata: {
      id: "test.skill",
      source: SkillSource.CodeFlex,
      overridePolicy: OverridePolicy.Allowed,
      owner: { team: "test" },
    },
    skillDir: "/tmp/test-skill",
    ...overrides,
  };
}

export function mockLock(overrides?: Partial<EngineeringLock>): EngineeringLock {
  return {
    version: 1,
    sources: {
      codeflex: { release: "local", commit: "local", sha256: "local" },
    },
    skills: [],
    ...overrides,
  };
}

export function mockResolvedSkill(overrides?: Partial<ResolvedSkill>): ResolvedSkill {
  return {
    id: "test.skill",
    slug: "test-skill",
    source: SkillSource.CodeFlex,
    ...overrides,
  };
}
