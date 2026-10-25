import { describe, it, expect } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verifyTrustedRelease } from "../../../src/integrity/release-verifier";
import { sha256Directory } from "../../../src/utils/hash";
import type { StandardsSource, ReleaseManifest } from "../../../src/types/index";
import { mockLock } from "../../fixtures/builders";

function makeSource(overrides?: Partial<StandardsSource>): StandardsSource {
  return {
    type: "codeflex",
    release: "v1.0.0",
    commit: "abc123",
    sha256: "hash123",
    skillsDir: "/tmp/skills",
    ...overrides,
  };
}

describe("verifyTrustedRelease", () => {
  it("returns valid for matching source and lock", async () => {
    const result = await verifyTrustedRelease(makeSource(), mockLock({ sources: { codeflex: { release: "v1.0.0", commit: "abc123", sha256: "hash123" } } }));
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("detects release mismatch", async () => {
    const source = makeSource({ release: "v2.0.0" });
    const result = await verifyTrustedRelease(source, mockLock({ sources: { codeflex: { release: "v1.0.0", commit: "abc123", sha256: "hash123" } } }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Release mismatch"))).toBe(true);
  });

  it("detects commit mismatch", async () => {
    const source = makeSource({ commit: "def456" });
    const result = await verifyTrustedRelease(source, mockLock({ sources: { codeflex: { release: "v1.0.0", commit: "abc123", sha256: "hash123" } } }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Commit mismatch"))).toBe(true);
  });

  it("detects sha256 mismatch", async () => {
    const source = makeSource({ sha256: "wronghash" });
    const result = await verifyTrustedRelease(source, mockLock({ sources: { codeflex: { release: "v1.0.0", commit: "abc123", sha256: "hash123" } } }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("SHA-256 mismatch"))).toBe(true);
  });

  it("skips source validation when lock has no codeflex source", async () => {
    const lock = mockLock({ sources: {} });
    const source = makeSource({ release: "v9.9.9", commit: "zzz", sha256: "nope" });
    const result = await verifyTrustedRelease(source, lock);
    expect(result.valid).toBe(true);
  });

  it("validates manifest attestation is verified", async () => {
    const manifest: ReleaseManifest = {
      release: "v1.0.0",
      commit: "abc123",
      sha256: "hash123",
      branch: "main",
      attestation: {
        type: "sigstore",
        signature: "sig",
        verified: false,
      },
    };

    const result = await verifyTrustedRelease(makeSource(), mockLock({ sources: { codeflex: { release: "v1.0.0", commit: "abc123", sha256: "hash123" } } }), manifest);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("attestation is not verified"))).toBe(true);
  });

  it("passes when manifest attestation is verified", async () => {
    const manifest: ReleaseManifest = {
      release: "v1.0.0",
      commit: "abc123",
      sha256: "hash123",
      branch: "main",
      attestation: {
        type: "sigstore",
        signature: "sig",
        verified: true,
      },
    };

    const result = await verifyTrustedRelease(makeSource(), mockLock({ sources: { codeflex: { release: "v1.0.0", commit: "abc123", sha256: "hash123" } } }), manifest);
    expect(result.valid).toBe(true);
  });

  it("validates pipeline against approved list", async () => {
    const manifest: ReleaseManifest = {
      release: "v1.0.0",
      commit: "abc123",
      sha256: "hash123",
      branch: "main",
      pipeline: {
        id: "untrusted-pipeline",
        runId: "run-1",
      },
    };

    const result = await verifyTrustedRelease(makeSource(), mockLock({ sources: { codeflex: { release: "v1.0.0", commit: "abc123", sha256: "hash123" } } }), manifest, {
      approvedPipelineIds: ["approved-pipeline"],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("not in the approved pipeline list"))).toBe(true);
  });

  it("passes when pipeline is in approved list", async () => {
    const manifest: ReleaseManifest = {
      release: "v1.0.0",
      commit: "abc123",
      sha256: "hash123",
      branch: "main",
      pipeline: {
        id: "approved-pipeline",
        runId: "run-1",
      },
    };

    const result = await verifyTrustedRelease(makeSource(), mockLock({ sources: { codeflex: { release: "v1.0.0", commit: "abc123", sha256: "hash123" } } }), manifest, {
      approvedPipelineIds: ["approved-pipeline"],
    });

    expect(result.valid).toBe(true);
  });

  it("verifies skill content hashes", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "release-verify-test-"));
    try {
      const skillDir = join(tempDir, "skills", "test-skill");
      await mkdir(skillDir, { recursive: true });
      await writeFile(join(skillDir, "SKILL.md"), "# Test", "utf-8");
      await writeFile(join(skillDir, "codeflex.yaml"), "id: test-skill", "utf-8");

      const hash = await sha256Directory(skillDir);

      const source = makeSource({ skillsDir: join(tempDir, "skills") });
      const lock = mockLock({
        sources: { codeflex: { release: "v1.0.0", commit: "abc123", sha256: "hash123" } },
        skills: ["test-skill"],
        skillHashes: { "test-skill": hash },
      });

      const result = await verifyTrustedRelease(source, lock);
      expect(result.valid).toBe(true);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("detects skill hash mismatch", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "release-verify-test-"));
    try {
      const skillDir = join(tempDir, "skills", "test-skill");
      await mkdir(skillDir, { recursive: true });
      await writeFile(join(skillDir, "SKILL.md"), "# Test", "utf-8");
      await writeFile(join(skillDir, "codeflex.yaml"), "id: test-skill", "utf-8");

      const source = makeSource({ skillsDir: join(tempDir, "skills") });
      const lock = mockLock({
        skills: ["test-skill"],
        skillHashes: { "test-skill": "deadbeef" },
      });

      const result = await verifyTrustedRelease(source, lock);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("hash mismatch"))).toBe(true);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("reports error when skill directory does not exist", async () => {
    const source = makeSource({ skillsDir: "/nonexistent/path/12345" });
    const lock = mockLock({ skills: ["missing-skill"] });

    const result = await verifyTrustedRelease(source, lock);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("not found or unreadable"))).toBe(true);
  });

  it("reports error when skill path is not a directory", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "release-verify-test-"));
    try {
      const skillFile = join(tempDir, "skills", "not-a-dir");
      await mkdir(join(tempDir, "skills"), { recursive: true });
      await writeFile(skillFile, "not a directory", "utf-8");

      const source = makeSource({ skillsDir: join(tempDir, "skills") });
      const lock = mockLock({ skills: ["not-a-dir"] });

      const result = await verifyTrustedRelease(source, lock);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("not a directory"))).toBe(true);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("validates manifest schema", async () => {
    const badManifest = { release: 123 } as unknown as ReleaseManifest;

    const result = await verifyTrustedRelease(makeSource(), mockLock({ sources: { codeflex: { release: "v1.0.0", commit: "abc123", sha256: "hash123" } } }), badManifest);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Invalid release manifest schema"))).toBe(true);
  });

  describe("skills nested under category folders", () => {
    async function writeValidSkill(skillDir: string, id: string): Promise<void> {
      await mkdir(skillDir, { recursive: true });
      await writeFile(join(skillDir, "SKILL.md"), ["---", `name: ${id}`, "description: test", "---", "# Test"].join("\n"), "utf-8");
      await writeFile(
        join(skillDir, "codeflex.yaml"),
        [`id: ${id}`, "source: codeflex", "overridePolicy: allowed", "owner:", "  team: test-team"].join("\n"),
        "utf-8",
      );
    }

    it("verifies a skill hash when the skill is nested under a category folder (id != folder name)", async () => {
      const tempDir = await mkdtemp(join(tmpdir(), "release-verify-nested-"));
      try {
        // The skill's id ("backend.dotnet") does not match its on-disk location
        // ("backend/dotnet"), matching the real engineering-skills repo's layout.
        const skillsDir = join(tempDir, "skills");
        const nestedSkillDir = join(skillsDir, "backend", "dotnet");
        await writeValidSkill(nestedSkillDir, "backend.dotnet");

        const hash = await sha256Directory(nestedSkillDir);

        const source = makeSource({ skillsDir });
        const lock = mockLock({
          sources: { codeflex: { release: "v1.0.0", commit: "abc123", sha256: "hash123" } },
          skills: ["backend.dotnet"],
          skillHashes: { "backend.dotnet": hash },
        });

        const result = await verifyTrustedRelease(source, lock);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    it("detects a hash mismatch for a nested skill found via the fallback lookup", async () => {
      const tempDir = await mkdtemp(join(tmpdir(), "release-verify-nested-"));
      try {
        const skillsDir = join(tempDir, "skills");
        const nestedSkillDir = join(skillsDir, "backend", "dotnet");
        await writeValidSkill(nestedSkillDir, "backend.dotnet");

        const source = makeSource({ skillsDir });
        const lock = mockLock({
          skills: ["backend.dotnet"],
          skillHashes: { "backend.dotnet": "deadbeef" },
        });

        const result = await verifyTrustedRelease(source, lock);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes("hash mismatch"))).toBe(true);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    it("reports not found when a skill id has no flat or nested match anywhere in the tree", async () => {
      const tempDir = await mkdtemp(join(tmpdir(), "release-verify-nested-"));
      try {
        const skillsDir = join(tempDir, "skills");
        const nestedSkillDir = join(skillsDir, "backend", "dotnet");
        await writeValidSkill(nestedSkillDir, "backend.dotnet");

        const source = makeSource({ skillsDir });
        const lock = mockLock({ skills: ["frontend.angular"] });

        const result = await verifyTrustedRelease(source, lock);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes("frontend.angular") && e.includes("not found or unreadable"))).toBe(true);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
  });
});
