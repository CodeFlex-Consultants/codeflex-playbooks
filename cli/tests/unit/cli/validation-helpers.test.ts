import { describe, it, expect } from "vitest";
import { findMissingSkills, getAllLockedSkills } from "../../../src/cli/validation-helpers";
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

describe("getAllLockedSkills", () => {
  it("returns only lock.skills when crossCuttingSkills is undefined", () => {
    const lock = makeLock({ skills: ["codeflex-dotnet"] });

    const result = getAllLockedSkills(lock);

    expect(result).toEqual(["codeflex-dotnet"]);
  });

  it("returns combined skills when crossCuttingSkills is present", () => {
    const lock = makeLock({
      skills: ["codeflex-dotnet"],
      crossCuttingSkills: ["codeflex-code-craftsmanship"],
    });

    const result = getAllLockedSkills(lock);

    expect(result).toEqual(["codeflex-dotnet", "codeflex-code-craftsmanship"]);
  });

  it("returns empty array when both are empty", () => {
    const lock = makeLock({ skills: [], crossCuttingSkills: [] });

    const result = getAllLockedSkills(lock);

    expect(result).toEqual([]);
  });
});

describe("findMissingSkills", () => {
  it("returns empty array when all skills are installed", () => {
    const lock = makeLock({
      skills: ["codeflex-dotnet"],
      crossCuttingSkills: ["codeflex-code-craftsmanship"],
    });
    const canonicalStore = makeCanonicalStore(["codeflex-dotnet", "codeflex-code-craftsmanship"]);

    const missing = findMissingSkills(lock, canonicalStore);

    expect(missing).toEqual([]);
  });

  it("returns skills from lock.skills that are not installed", () => {
    const lock = makeLock({ skills: ["codeflex-dotnet", "codeflex-angular"] });
    const canonicalStore = makeCanonicalStore(["codeflex-dotnet"]);

    const missing = findMissingSkills(lock, canonicalStore);

    expect(missing).toEqual(["codeflex-angular"]);
  });

  it("returns skills from lock.crossCuttingSkills that are not installed", () => {
    const lock = makeLock({
      skills: ["codeflex-dotnet"],
      crossCuttingSkills: ["codeflex-code-craftsmanship", "codeflex-no-magic-strings"],
    });
    const canonicalStore = makeCanonicalStore(["codeflex-dotnet", "codeflex-code-craftsmanship"]);

    const missing = findMissingSkills(lock, canonicalStore);

    expect(missing).toEqual(["codeflex-no-magic-strings"]);
  });

  it("returns all locked skills when store is empty", () => {
    const lock = makeLock({
      skills: ["codeflex-dotnet"],
      crossCuttingSkills: ["codeflex-code-craftsmanship"],
    });
    const canonicalStore = makeCanonicalStore([]);

    const missing = findMissingSkills(lock, canonicalStore);

    expect(missing).toEqual(["codeflex-dotnet", "codeflex-code-craftsmanship"]);
  });
});
