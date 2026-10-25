import { describe, it, expect } from "vitest";
import { buildLock } from "../../../src/config/lockfile-builder";
import { SkillSource, ReleaseChannel } from "../../../src/types/index";
import type { StandardsSource } from "../../../src/types/index";
import type { ResolutionResult } from "../../../src/types/index";

function makeCodeFlexSource(overrides: Partial<StandardsSource> = {}): StandardsSource {
  return {
    type: SkillSource.CodeFlex,
    release: "v1.0.0",
    commit: "abc123",
    sha256: "codeflex-hash",
    skillsDir: "/tmp/codeflex",
    ...overrides,
  };
}

function makeResolution(overrides: Partial<ResolutionResult> = {}): ResolutionResult {
  return {
    skills: [
      { id: "codeflex.dotnet", slug: "codeflex-dotnet", source: SkillSource.CodeFlex },
      { id: "client.api", slug: "client-api", source: SkillSource.Client },
    ],
    conflicts: [],
    nonOverridableConflicts: [],
    overrides: { "RULE-1": "codeflex-dotnet" },
    exceptions: { active: [], expired: [] },
    dependencyWarnings: [],
    explanation: [],
    ...overrides,
  };
}

describe("buildLock", () => {
  it("constructs correct lock from sources and resolution", () => {
    const codeflex = makeCodeFlexSource();
    const clients: StandardsSource[] = [
      { type: SkillSource.Client, id: "client-a", sha256: "client-hash", skillsDir: "/tmp/client" },
    ];
    const repos: StandardsSource[] = [
      { type: SkillSource.Repository, id: "repo-a", sha256: "repo-hash", skillsDir: "/tmp/repo" },
    ];
    const resolution = makeResolution();

    const lock = buildLock(codeflex, clients, repos, resolution);

    expect(lock.version).toBe(1);
    expect(lock.sources.codeflex?.release).toBe("v1.0.0");
    expect(lock.sources.codeflex?.commit).toBe("abc123");
    expect(lock.sources.codeflex?.sha256).toBe("codeflex-hash");
    expect(lock.sources.client).toHaveLength(1);
    expect(lock.sources.client?.[0]?.id).toBe("client-a");
    expect(lock.sources.client?.[0]?.sha256).toBe("client-hash");
    expect(lock.sources.repository).toHaveLength(1);
    expect(lock.sources.repository?.[0]?.id).toBe("repo-a");
    expect(lock.sources.repository?.[0]?.path).toBe("/tmp/repo");
    expect(lock.skills).toEqual(["codeflex-dotnet", "client-api"]);
    expect(lock.skillSources).toEqual({
      "codeflex-dotnet": SkillSource.CodeFlex,
      "client-api": SkillSource.Client,
    });
    expect(lock.resolvedOverrides).toEqual({ "RULE-1": "codeflex-dotnet" });
  });

  it("includes channel when provided", () => {
    const codeflex = makeCodeFlexSource();
    const resolution = makeResolution({ skills: [] });

    const lock = buildLock(codeflex, [], [], resolution, ReleaseChannel.Canary);

    expect(lock.sources.codeflex?.channel).toBe(ReleaseChannel.Canary);
  });

  it("omits channel when not provided", () => {
    const codeflex = makeCodeFlexSource();
    const resolution = makeResolution({ skills: [] });

    const lock = buildLock(codeflex, [], [], resolution);

    expect(lock.sources.codeflex?.channel).toBeUndefined();
  });

  it("defaults release to local when missing", () => {
    const codeflex = makeCodeFlexSource({ release: undefined });
    const resolution = makeResolution({ skills: [] });

    const lock = buildLock(codeflex, [], [], resolution);

    expect(lock.sources.codeflex?.release).toBe("local");
  });
});
