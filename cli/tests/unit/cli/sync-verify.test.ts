import { describe, it, expect } from "vitest";
import { verifyClientSourceHashes, verifyRepositorySourceHashes } from "../../../src/integrity/source-hash-verifier";
import { IntegrityError } from "../../../src/utils/errors";
import type { StandardsSource, EngineeringLock } from "../../../src/types/index";
import { SkillSource } from "../../../src/types/index";
describe("verifyClientSourceHashes", () => {
  it("passes when all client source hashes match", () => {
    const sources: StandardsSource[] = [
      {
        type: SkillSource.Client,
        id: "client-alpha",
        sha256: "abc123",
        skillsDir: "/path/to/client-alpha",
      },
    ];

    const lock: EngineeringLock = {
      version: 1,
      sources: {
        codeflex: { release: "1.0.0", commit: "abc", sha256: "def" },
        client: [
          { id: "client-alpha", source: "/path/to/client-alpha", sha256: "abc123" },
        ],
      },
      skills: ["client-alpha-dotnet"],
      projections: [],
    };

    expect(() => verifyClientSourceHashes(sources, lock)).not.toThrow();
  });

  it("throws IntegrityError when SHA-256 mismatch", () => {
    const sources: StandardsSource[] = [
      {
        type: SkillSource.Client,
        id: "client-alpha",
        sha256: "abc123",
        skillsDir: "/path/to/client-alpha",
      },
    ];

    const lock: EngineeringLock = {
      version: 1,
      sources: {
        codeflex: { release: "1.0.0", commit: "abc", sha256: "def" },
        client: [
          { id: "client-alpha", source: "/path/to/client-alpha", sha256: "different-hash" },
        ],
      },
      skills: ["client-alpha-dotnet"],
      projections: [],
    };

    try {
      verifyClientSourceHashes(sources, lock);
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(IntegrityError);
      const integrityError = error as IntegrityError;
      expect(integrityError.detail).toContain("SHA-256 mismatch");
      expect(integrityError.detail).toContain("client-alpha");
    }
  });

  it("throws IntegrityError when client source not found", () => {
    const sources: StandardsSource[] = [];

    const lock: EngineeringLock = {
      version: 1,
      sources: {
        codeflex: { release: "1.0.0", commit: "abc", sha256: "def" },
        client: [
          { id: "client-alpha", source: "/path/to/client-alpha", sha256: "abc123" },
        ],
      },
      skills: ["client-alpha-dotnet"],
      projections: [],
    };

    try {
      verifyClientSourceHashes(sources, lock);
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(IntegrityError);
      const integrityError = error as IntegrityError;
      expect(integrityError.detail).toContain("not found in resolved sources");
      expect(integrityError.detail).toContain("client-alpha");
    }
  });

  it("passes when no client sources in lock", () => {
    const sources: StandardsSource[] = [];

    const lock: EngineeringLock = {
      version: 1,
      sources: {
        codeflex: { release: "1.0.0", commit: "abc", sha256: "def" },
      },
      skills: ["codeflex-dotnet"],
      projections: [],
    };

    expect(() => verifyClientSourceHashes(sources, lock)).not.toThrow();
  });

  it("validates multiple client sources and reports all errors", () => {
    const sources: StandardsSource[] = [
      {
        type: SkillSource.Client,
        id: "client-alpha",
        sha256: "abc123",
        skillsDir: "/path/to/client-alpha",
      },
      {
        type: SkillSource.Client,
        id: "client-beta",
        sha256: "def456",
        skillsDir: "/path/to/client-beta",
      },
    ];

    const lock: EngineeringLock = {
      version: 1,
      sources: {
        codeflex: { release: "1.0.0", commit: "abc", sha256: "def" },
        client: [
          { id: "client-alpha", source: "/path/to/client-alpha", sha256: "wrong-hash" },
          { id: "client-beta", source: "/path/to/client-beta", sha256: "also-wrong" },
        ],
      },
      skills: ["client-alpha-dotnet", "client-beta-angular"],
      projections: [],
    };

    try {
      verifyClientSourceHashes(sources, lock);
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(IntegrityError);
      const integrityError = error as IntegrityError;
      expect(integrityError.detail).toContain("client-alpha");
      expect(integrityError.detail).toContain("client-beta");
    }
  });
});

describe("verifyRepositorySourceHashes", () => {
  it("passes when all repository source hashes match", async () => {
    const sources: StandardsSource[] = [
      {
        type: SkillSource.Repository,
        id: "repo-alpha",
        sha256: "abc123",
        skillsDir: "/path/to/repo-alpha",
      },
    ];

    const lock: EngineeringLock = {
      version: 1,
      sources: {
        codeflex: { release: "1.0.0", commit: "abc", sha256: "def" },
        repository: [
          { id: "repo-alpha", path: "/path/to/repo-alpha", sha256: "abc123" },
        ],
      },
      skills: ["repo-alpha-skill"],
      projections: [],
    };

    await expect(verifyRepositorySourceHashes(sources, lock, "/project")).resolves.not.toThrow();
  });

  it("throws IntegrityError when SHA-256 mismatch", async () => {
    const sources: StandardsSource[] = [
      {
        type: SkillSource.Repository,
        id: "repo-alpha",
        sha256: "abc123",
        skillsDir: "/path/to/repo-alpha",
      },
    ];

    const lock: EngineeringLock = {
      version: 1,
      sources: {
        codeflex: { release: "1.0.0", commit: "abc", sha256: "def" },
        repository: [
          { id: "repo-alpha", path: "/path/to/repo-alpha", sha256: "different-hash" },
        ],
      },
      skills: ["repo-alpha-skill"],
      projections: [],
    };

    try {
      await verifyRepositorySourceHashes(sources, lock, "/project");
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(IntegrityError);
      const integrityError = error as IntegrityError;
      expect(integrityError.detail).toContain("SHA-256 mismatch");
      expect(integrityError.detail).toContain("repo-alpha");
    }
  });

  it("passes when no repository sources in lock", async () => {
    const sources: StandardsSource[] = [];

    const lock: EngineeringLock = {
      version: 1,
      sources: {
        codeflex: { release: "1.0.0", commit: "abc", sha256: "def" },
      },
      skills: ["codeflex-skill"],
      projections: [],
    };

    await expect(verifyRepositorySourceHashes(sources, lock, "/project")).resolves.not.toThrow();
  });
});
