import { describe, it, expect } from "vitest";
import { findOrphanedSkills } from "../../../src/cli/doctor-checks";
import type { EngineeringLock } from "../../../src/types/index";
import type { SkillDirectory } from "../../../src/skills/canonical-store";

function makeLock(overrides: Partial<EngineeringLock> = {}): EngineeringLock {
  return {
    version: 1,
    resolvedAt: "2026-01-01T00:00:00.000Z",
    skills: [],
    ...overrides,
  } as EngineeringLock;
}

function makeCanonicalStore(skillIds: string[]): Map<string, SkillDirectory> {
  const store = new Map<string, SkillDirectory>();
  for (const id of skillIds) {
    store.set(id, { dirPath: `/codeflex/skills/${id}` } as SkillDirectory);
  }
  return store;
}

describe("findOrphanedSkills", () => {
  it("does not flag skills present only in lock.skills", () => {
    const lock = makeLock({ skills: ["codeflex-dotnet"] });
    const canonicalStore = makeCanonicalStore(["codeflex-dotnet"]);

    const orphaned = findOrphanedSkills(lock, canonicalStore);

    expect(orphaned).toEqual([]);
  });

  it("does not flag skills present only in lock.crossCuttingSkills", () => {
    const lock = makeLock({ skills: [], crossCuttingSkills: ["codeflex-code-craftsmanship"] });
    const canonicalStore = makeCanonicalStore(["codeflex-code-craftsmanship"]);

    const orphaned = findOrphanedSkills(lock, canonicalStore);

    expect(orphaned).toEqual([]);
  });

  it("flags skills absent from both lock.skills and lock.crossCuttingSkills", () => {
    const lock = makeLock({ skills: ["codeflex-dotnet"], crossCuttingSkills: ["codeflex-code-craftsmanship"] });
    const canonicalStore = makeCanonicalStore(["codeflex-dotnet", "codeflex-code-craftsmanship", "stale-skill"]);

    const orphaned = findOrphanedSkills(lock, canonicalStore);

    expect(orphaned).toEqual([{ id: "stale-skill", dirPath: "/codeflex/skills/stale-skill" }]);
  });
});
