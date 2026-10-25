import { describe, it, expect } from "vitest";
import * as api from "../../../src/index";

describe("programmatic API", () => {
  it("exports detection functions", () => {
    expect(api.detectProject).toBeTypeOf("function");
  });

  it("exports resolution functions", () => {
    expect(api.resolveStandards).toBeTypeOf("function");
    expect(api.loadSkillsFromSource).toBeTypeOf("function");
  });

  it("exports skill installation functions", () => {
    expect(api.installSkills).toBeTypeOf("function");
    expect(api.fetchCodeFlexSource).toBeTypeOf("function");
    expect(api.fetchClientSource).toBeTypeOf("function");
    expect(api.readCanonicalStore).toBeTypeOf("function");
    expect(api.writeCanonicalStore).toBeTypeOf("function");
    expect(api.swapDirectory).toBeTypeOf("function");
  });

  it("exports projection functions", () => {
    expect(api.calculateProjectionTopology).toBeTypeOf("function");
    expect(api.projectSkills).toBeTypeOf("function");
    expect(api.cleanStaleProjections).toBeTypeOf("function");
    expect(api.generateScopedRules).toBeTypeOf("function");
    expect(api.calculateScopedRules).toBeTypeOf("function");
    expect(api.HARNESS_REGISTRY).toBeDefined();
  });

  it("exports config functions", () => {
    expect(api.loadConfig).toBeTypeOf("function");
    expect(api.saveConfig).toBeTypeOf("function");
    expect(api.loadLock).toBeTypeOf("function");
    expect(api.saveLock).toBeTypeOf("function");
    expect(api.createDefaultConfig).toBeTypeOf("function");
    expect(api.codeflexDir).toBeTypeOf("function");
    expect(api.skillsDir).toBeTypeOf("function");
  });

  it("exports agents-md functions", () => {
    expect(api.normalizeAgentsMd).toBeTypeOf("function");
    expect(api.generateClaudeMd).toBeTypeOf("function");
    expect(api.generateManagedSection).toBeTypeOf("function");
    expect(api.MANAGED_SECTION_START).toBeTypeOf("string");
    expect(api.MANAGED_SECTION_END).toBeTypeOf("string");
  });

  it("exports integrity functions", () => {
    expect(api.verifyTrustedRelease).toBeTypeOf("function");
    expect(api.verifyLockfileConsistency).toBeTypeOf("function");
    expect(api.verifyProjection).toBeTypeOf("function");
  });

  it("exports error classes", () => {
    expect(api.CodeFlexError).toBeTypeOf("function");
    expect(api.ConfigValidationError).toBeTypeOf("function");
    expect(api.LockfileMissingError).toBeTypeOf("function");
    expect(api.IntegrityError).toBeTypeOf("function");
    expect(api.ResolutionConflictError).toBeTypeOf("function");
    expect(api.SourceFetchError).toBeTypeOf("function");
    expect(api.ClientStandardsDroppedError).toBeTypeOf("function");
  });
});
