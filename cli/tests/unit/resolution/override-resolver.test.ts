import { describe, it, expect } from "vitest";
import { resolveOverrides } from "../../../src/resolution/override-resolver";
import type { LoadedSkill } from "../../../src/types/index";
import { OverridePolicy, SkillSource } from "../../../src/types/index";

function makeSkill(overrides?: Partial<LoadedSkill> & { rules?: string[]; overridePolicy?: OverridePolicy; nonOverridableRules?: string[]; overridesRules?: string[] }): LoadedSkill {
  const id = overrides?.id ?? "test-skill";
  const source = overrides?.source ?? SkillSource.CodeFlex;
  return {
    id,
    source,
    manifest: overrides?.manifest ?? { name: id, description: id },
    metadata: {
      id,
      source,
      overridePolicy: overrides?.overridePolicy ?? OverridePolicy.Allowed,
      nonOverridableRules: overrides?.nonOverridableRules,
      owner: { team: "test" },
      rules: overrides?.rules,
      overrides: overrides?.overridesRules,
    },
    skillDir: overrides?.skillDir ?? "/tmp/test",
  };
}

describe("resolveOverrides", () => {
  it("returns empty result for empty skills array", () => {
    const result = resolveOverrides([]);
    expect(result.overrides.size).toBe(0);
    expect(result.conflicts).toHaveLength(0);
  });

  it("returns empty result when skills have no rules", () => {
    const skills = [makeSkill({ id: "a" }), makeSkill({ id: "b" })];
    const result = resolveOverrides(skills);
    expect(result.overrides.size).toBe(0);
    expect(result.conflicts).toHaveLength(0);
  });

  it("returns empty result when no rules overlap", () => {
    const skills = [
      makeSkill({ id: "a", rules: ["RULE-A"] }),
      makeSkill({ id: "b", rules: ["RULE-B"] }),
    ];
    const result = resolveOverrides(skills);
    expect(result.overrides.size).toBe(0);
    expect(result.conflicts).toHaveLength(0);
  });

  it("client overrides codeflex for same rule", () => {
    const skills = [
      makeSkill({ id: "codeflex-skill", source: SkillSource.CodeFlex, rules: ["RULE-1"] }),
      makeSkill({ id: "client-skill", source: SkillSource.Client, rules: ["RULE-1"] }),
    ];
    const result = resolveOverrides(skills);
    expect(result.overrides.get("RULE-1")).toBe("client-skill");
    expect(result.conflicts).toHaveLength(0);
  });

  it("repository overrides codeflex for same rule", () => {
    const skills = [
      makeSkill({ id: "codeflex-skill", source: SkillSource.CodeFlex, rules: ["RULE-1"] }),
      makeSkill({ id: "repo-skill", source: SkillSource.Repository, rules: ["RULE-1"] }),
    ];
    const result = resolveOverrides(skills);
    expect(result.overrides.get("RULE-1")).toBe("repo-skill");
  });

  it("client overrides repository for same rule", () => {
    const skills = [
      makeSkill({ id: "repo-skill", source: SkillSource.Repository, rules: ["RULE-1"] }),
      makeSkill({ id: "client-skill", source: SkillSource.Client, rules: ["RULE-1"] }),
    ];
    const result = resolveOverrides(skills);
    expect(result.overrides.get("RULE-1")).toBe("client-skill");
  });

  it("non-overridable codeflex rule cannot be overridden by client", () => {
    const skills = [
      makeSkill({
        id: "codeflex-skill",
        source: SkillSource.CodeFlex,
        rules: ["RULE-1"],
        overridePolicy: OverridePolicy.Required,
      }),
      makeSkill({
        id: "client-skill",
        source: SkillSource.Client,
        rules: ["RULE-1"],
      }),
    ];
    const result = resolveOverrides(skills);
    expect(result.overrides.get("RULE-1")).toBe("codeflex-skill");
    expect(result.conflicts).toHaveLength(0);
  });

  it("nonOverridableRules prevents override of specific rules", () => {
    const skills = [
      makeSkill({
        id: "codeflex-skill",
        source: SkillSource.CodeFlex,
        rules: ["RULE-A", "RULE-B"],
        nonOverridableRules: ["RULE-A"],
      }),
      makeSkill({
        id: "client-skill",
        source: SkillSource.Client,
        rules: ["RULE-A", "RULE-B"],
      }),
    ];
    const result = resolveOverrides(skills);
    expect(result.overrides.get("RULE-A")).toBe("codeflex-skill");
    expect(result.overrides.get("RULE-B")).toBe("client-skill");
  });

  it("reports conflict when two non-overridable skills at same tier collide", () => {
    const skills = [
      makeSkill({
        id: "client-a",
        source: SkillSource.Client,
        rules: ["SHARED-RULE"],
        overridePolicy: OverridePolicy.Required,
      }),
      makeSkill({
        id: "client-b",
        source: SkillSource.Client,
        rules: ["SHARED-RULE"],
        overridePolicy: OverridePolicy.Required,
      }),
    ];
    const result = resolveOverrides(skills);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]!.rule).toBe("SHARED-RULE");
    expect(result.conflicts[0]!.nonOverridable).toBe(true);
    expect(result.conflicts[0]!.resolved).toBe(false);
  });

  it("resolves via metadata.overrides field", () => {
    const skills = [
      makeSkill({
        id: "codeflex-skill",
        source: SkillSource.CodeFlex,
        rules: ["RULE-1"],
      }),
      makeSkill({
        id: "repo-skill",
        source: SkillSource.Repository,
        rules: ["RULE-1"],
        overridesRules: ["RULE-1"],
      }),
    ];
    const result = resolveOverrides(skills);
    expect(result.overrides.get("RULE-1")).toBe("repo-skill");
  });

  it("reports unresolved conflict when same-tier skills overlap without override", () => {
    const skills = [
      makeSkill({
        id: "client-a",
        source: SkillSource.Client,
        rules: ["RULE-1"],
      }),
      makeSkill({
        id: "client-b",
        source: SkillSource.Client,
        rules: ["RULE-1"],
      }),
    ];
    const result = resolveOverrides(skills);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]!.rule).toBe("RULE-1");
    expect(result.conflicts[0]!.nonOverridable).toBe(false);
    expect(result.conflicts[0]!.resolved).toBe(false);
  });

  it("handles multiple rules across multiple skills", () => {
    const skills = [
      makeSkill({
        id: "codeflex-skill",
        source: SkillSource.CodeFlex,
        rules: ["RULE-A", "RULE-B", "RULE-C"],
      }),
      makeSkill({
        id: "client-skill",
        source: SkillSource.Client,
        rules: ["RULE-A", "RULE-B"],
      }),
    ];
    const result = resolveOverrides(skills);
    expect(result.overrides.get("RULE-A")).toBe("client-skill");
    expect(result.overrides.get("RULE-B")).toBe("client-skill");
    expect(result.overrides.has("RULE-C")).toBe(false);
  });

  it("non-overridable codeflex at tier 1 beats non-overridable client at tier 2", () => {
    const skills = [
      makeSkill({
        id: "codeflex-skill",
        source: SkillSource.CodeFlex,
        rules: ["RULE-1"],
        overridePolicy: OverridePolicy.Required,
      }),
      makeSkill({
        id: "client-skill",
        source: SkillSource.Client,
        rules: ["RULE-1"],
        overridePolicy: OverridePolicy.Required,
      }),
    ];
    const result = resolveOverrides(skills);
    expect(result.overrides.get("RULE-1")).toBe("codeflex-skill");
    expect(result.conflicts).toHaveLength(0);
  });
});
