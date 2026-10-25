import { describe, it, expect } from "vitest";
import { verifyTrustedRelease } from "../../../src/integrity/release-verifier";
import { verifyLockfileConsistency } from "../../../src/integrity/lockfile-verifier";
import type { StandardsSource, EngineeringLock, EngineeringConfig } from "../../../src/types/index";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sha256Directory } from "../../../src/utils/hash";

describe("verifyTrustedRelease", () => {
  it("should return valid for matching release", async () => {
    const source: StandardsSource = {
      type: "codeflex",
      release: "v1.0.0",
      commit: "abc123",
      sha256: "hash123",
      skillsDir: "/tmp/skills",
    };

    const lock: EngineeringLock = {
      version: 1,
      sources: {
        codeflex: {
          release: "v1.0.0",
          commit: "abc123",
          sha256: "hash123",
        },
      },
      skills: [],
      projections: [],
    };

    const result = await verifyTrustedRelease(source, lock);
    expect(result.valid).toBe(true);
  });

  it("should detect release mismatch", async () => {
    const source: StandardsSource = {
      type: "codeflex",
      release: "v1.0.1",
      commit: "abc123",
      sha256: "hash123",
      skillsDir: "/tmp/skills",
    };

    const lock: EngineeringLock = {
      version: 1,
      sources: {
        codeflex: {
          release: "v1.0.0",
          commit: "abc123",
          sha256: "hash123",
        },
      },
      skills: [],
      projections: [],
    };

    const result = await verifyTrustedRelease(source, lock);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("should verify skill content hashes when skillHashes are provided", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "integrity-hash-test-"));

    try {
      const skillDir = join(tempDir, "skills", "test-skill");
      await mkdir(skillDir, { recursive: true });
      await writeFile(join(skillDir, "SKILL.md"), "# Test Skill", "utf-8");
      await writeFile(join(skillDir, "codeflex.yaml"), "id: test-skill", "utf-8");

      const correctHash = await sha256Directory(skillDir);

      const source: StandardsSource = {
        type: "codeflex",
        release: "v1.0.0",
        commit: "abc123",
        sha256: "hash123",
        skillsDir: join(tempDir, "skills"),
      };

      const lock: EngineeringLock = {
        version: 1,
        sources: {
          codeflex: {
            release: "v1.0.0",
            commit: "abc123",
            sha256: "hash123",
          },
        },
        skills: ["test-skill"],
        skillHashes: {
          "test-skill": correctHash,
        },
        projections: [],
      };

      const result = await verifyTrustedRelease(source, lock);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should fail when skill content hash does not match expected", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "integrity-hash-test-"));

    try {
      const skillDir = join(tempDir, "skills", "test-skill");
      await mkdir(skillDir, { recursive: true });
      await writeFile(join(skillDir, "SKILL.md"), "# Test Skill", "utf-8");
      await writeFile(join(skillDir, "codeflex.yaml"), "id: test-skill", "utf-8");

      const source: StandardsSource = {
        type: "codeflex",
        release: "v1.0.0",
        commit: "abc123",
        sha256: "hash123",
        skillsDir: join(tempDir, "skills"),
      };

      const lock: EngineeringLock = {
        version: 1,
        sources: {
          codeflex: {
            release: "v1.0.0",
            commit: "abc123",
            sha256: "hash123",
          },
        },
        skills: ["test-skill"],
        skillHashes: {
          "test-skill": "deadbeef00000000000000000000000000000000000000000000000000000000",
        },
        projections: [],
      };

      const result = await verifyTrustedRelease(source, lock);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("hash mismatch"))).toBe(true);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe("verifyLockfileConsistency", () => {
  it("should return consistent for valid config and lock", async () => {
    const config: EngineeringConfig = {
      version: 1,
      autoDetect: true,
      agentHarnesses: ["codex", "kilo"],
      standards: { codeflex: { enabled: true } },
      include: [],
      exclude: [],
      scopes: {},
      exceptions: [],
    };

    const lock: EngineeringLock = {
      version: 1,
      sources: {},
      skills: [],
      projections: [
        { adapters: ["agents"], path: ".agents/skills" },
      ],
    };

    const result = await verifyLockfileConsistency(config, lock);
    expect(result.consistent).toBe(true);
  });

  it("should warn about unknown harness", async () => {
    const config: EngineeringConfig = {
      version: 1,
      autoDetect: true,
      agentHarnesses: ["codex"],
      standards: { codeflex: { enabled: true } },
      include: [],
      exclude: [],
      scopes: {},
      exceptions: [],
    };

    const lock: EngineeringLock = {
      version: 1,
      sources: {},
      skills: [],
      projections: [
        { adapters: ["agents"], path: ".agents/skills" },
        { adapters: ["unknown"], path: ".unknown/skills" },
      ],
    };

    const result = await verifyLockfileConsistency(config, lock);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("should error when repository source SHA-256 is missing", async () => {
    const config: EngineeringConfig = {
      version: 1,
      autoDetect: true,
      agentHarnesses: ["codex"],
      standards: {
        codeflex: { enabled: true },
        repository: [{ id: "repo-a", path: "/path/to/repo" }],
      },
      include: [],
      exclude: [],
      scopes: {},
      exceptions: [],
    };

    const lock: EngineeringLock = {
      version: 1,
      sources: {
        repository: [
          { id: "repo-a", path: "/path/to/repo", sha256: "" },
        ],
      },
      skills: [],
      projections: [],
    };

    const result = await verifyLockfileConsistency(config, lock);
    expect(result.consistent).toBe(false);
    expect(result.errors.some((e) => e.includes("repo-a") && e.includes("SHA-256"))).toBe(true);
  });

  it("should pass when repository source has valid SHA-256", async () => {
    const config: EngineeringConfig = {
      version: 1,
      autoDetect: true,
      agentHarnesses: ["codex"],
      standards: {
        codeflex: { enabled: true },
        repository: [{ id: "repo-a", path: "/path/to/repo" }],
      },
      include: [],
      exclude: [],
      scopes: {},
      exceptions: [],
    };

    const lock: EngineeringLock = {
      version: 1,
      sources: {
        repository: [
          { id: "repo-a", path: "/path/to/repo", sha256: "abc123def456" },
        ],
      },
      skills: [],
      projections: [],
    };

    const result = await verifyLockfileConsistency(config, lock);
    expect(result.consistent).toBe(true);
  });

  it("should not warn about normally-detected skills when include has entries (additive, not exhaustive)", async () => {
    const config: EngineeringConfig = {
      version: 1,
      autoDetect: true,
      agentHarnesses: ["codex"],
      standards: { codeflex: { enabled: true } },
      include: ["codeflex-api-design"],
      exclude: [],
      scopes: {},
      exceptions: [],
    };

    const lock: EngineeringLock = {
      version: 1,
      sources: {},
      skills: ["codeflex-dotnet", "codeflex-angular", "codeflex-api-design"],
      projections: [],
    };

    const result = await verifyLockfileConsistency(config, lock);
    expect(result.warnings.some((w) => w.includes("codeflex-dotnet"))).toBe(false);
    expect(result.warnings.some((w) => w.includes("codeflex-angular"))).toBe(false);
  });

  it("should warn when a configured include pattern has no matching locked skill", async () => {
    const config: EngineeringConfig = {
      version: 1,
      autoDetect: true,
      agentHarnesses: ["codex"],
      standards: { codeflex: { enabled: true } },
      include: ["codeflex-api-design"],
      exclude: [],
      scopes: {},
      exceptions: [],
    };

    const lock: EngineeringLock = {
      version: 1,
      sources: {},
      skills: ["codeflex-dotnet", "codeflex-angular"],
      projections: [],
    };

    const result = await verifyLockfileConsistency(config, lock);
    expect(
      result.warnings.some(
        (w) => w.includes("codeflex-api-design") && w.toLowerCase().includes("does not match any locked skill")
      )
    ).toBe(true);
  });
});
