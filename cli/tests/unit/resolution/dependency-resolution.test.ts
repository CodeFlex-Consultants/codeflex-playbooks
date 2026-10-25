import { describe, it, expect } from "vitest";
import { resolveDependencies } from "../../../src/resolution/dependency-resolver";
import type { DetectionResult, LoadedSkill } from "../../../src/types/index";

function makeLoadedSkill(id: string, requires?: string[], installWhen?: { any: { packageReference?: { package: string; version: string }; file?: { pattern: string } }[] }): LoadedSkill {
  return {
    id,
    source: "codeflex",
    manifest: { name: id, description: id },
    metadata: {
      id,
      source: "codeflex",
      overridePolicy: "allowed",
      owner: { team: "codeflex" },
      requires,
      installWhen,
    },
    skillDir: "/tmp/test",
  };
}

describe("resolveDependencies", () => {
  it("resolves transitive dependencies via queue", () => {
    const skills: LoadedSkill[] = [
      makeLoadedSkill("a", ["b"]),
      makeLoadedSkill("b", ["c"]),
      makeLoadedSkill("c"),
    ];

    const resolved = new Set<string>(["a"]);
    const detection: DetectionResult = { technologies: [], scopes: {}, capabilities: [] };

    const result = resolveDependencies(skills, resolved, detection);

    expect(result.added).toContain("b");
    expect(result.added).toContain("c");
    expect(resolved.has("b")).toBe(true);
    expect(resolved.has("c")).toBe(true);
  });

  it("reports missing transitive dependencies", () => {
    const skills: LoadedSkill[] = [
      makeLoadedSkill("a", ["b"]),
      makeLoadedSkill("b", ["missing-dep"]),
    ];

    const resolved = new Set<string>(["a"]);
    const detection: DetectionResult = { technologies: [], scopes: {}, capabilities: [] };

    const result = resolveDependencies(skills, resolved, detection);

    expect(result.added).toContain("b");
    expect(result.missing).toContain("missing-dep");
  });

  it("does not duplicate already resolved skills", () => {
    const skills: LoadedSkill[] = [
      makeLoadedSkill("a", ["b"]),
      makeLoadedSkill("b"),
    ];

    const resolved = new Set<string>(["a", "b"]);
    const detection: DetectionResult = { technologies: [], scopes: {}, capabilities: [] };

    const result = resolveDependencies(skills, resolved, detection);

    expect(result.added).toHaveLength(0);
    expect(result.missing).toHaveLength(0);
  });

  it("does not reintroduce an excluded skill as a transitive dependency", () => {
    const skills: LoadedSkill[] = [
      makeLoadedSkill("a", ["b"]),
      makeLoadedSkill("b"),
    ];

    const resolved = new Set<string>(["a"]);
    const detection: DetectionResult = { technologies: [], scopes: {}, capabilities: [] };

    const result = resolveDependencies(skills, resolved, detection, ["b"]);

    expect(result.added).not.toContain("b");
    expect(resolved.has("b")).toBe(false);
    expect(result.missing).toContain("b");
  });

  it("reports an excluded dependency as missing even when the skill would otherwise resolve", () => {
    const skills: LoadedSkill[] = [
      makeLoadedSkill("a", ["b"]),
      makeLoadedSkill("b", ["c"]),
      makeLoadedSkill("c"),
    ];

    const resolved = new Set<string>(["a"]);
    const detection: DetectionResult = { technologies: [], scopes: {}, capabilities: [] };

    // "c" is a transitive dependency of "b" (a hard requires edge from a
    // non-excluded skill). Excluding it must not silently drop the
    // requirement or silently satisfy it — it should surface as missing.
    const result = resolveDependencies(skills, resolved, detection, ["c"]);

    expect(result.added).toContain("b");
    expect(resolved.has("b")).toBe(true);
    expect(resolved.has("c")).toBe(false);
    expect(result.missing).toContain("c");
  });
});
