import { describe, it, expect, vi } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { homedir } from "node:os";
import { join } from "node:path";
import { verifyProjection } from "../../../src/integrity/projection-verifier";
import { mockLock } from "../../fixtures/builders";

vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return {
    ...actual,
    homedir: vi.fn(actual.homedir),
  };
});

const mockHomedir = vi.mocked(homedir);

/**
 * Creates an isolated temp project dir plus a fake home directory, and points
 * `os.homedir()` at the fake home for the duration of the test. All `~/...`
 * projection paths under test resolve inside this fake home, never the real
 * developer machine home directory.
 */
async function withFakeHome<T>(
  fn: (dirs: { tempDir: string; fakeHome: string }) => Promise<T>
): Promise<T> {
  const tempDir = await mkdtemp(join(tmpdir(), "proj-verify-test-"));
  const fakeHome = join(tempDir, "fake-home");
  await mkdir(fakeHome, { recursive: true });
  mockHomedir.mockReturnValue(fakeHome);

  try {
    return await fn({ tempDir, fakeHome });
  } finally {
    mockHomedir.mockReset();
    await rm(tempDir, { recursive: true, force: true });
  }
}

describe("verifyProjection", () => {
  it("returns inSync when no projections and no skills", async () => {
    await withFakeHome(async ({ tempDir }) => {
      const result = await verifyProjection(tempDir, mockLock());
      expect(result.inSync).toBe(true);
      expect(result.stale).toHaveLength(0);
      expect(result.missing).toHaveLength(0);
      expect(result.unexpected).toHaveLength(0);
    });
  });

  it("reports missing projections", async () => {
    await withFakeHome(async ({ tempDir }) => {
      const lock = mockLock({
        skills: ["codeflex-dotnet"],
        projections: [{ adapters: ["agents"], path: "~/.agents/skills" }],
      });

      const result = await verifyProjection(tempDir, lock);

      expect(result.inSync).toBe(false);
      expect(result.missing).toHaveLength(1);
      expect(result.missing[0]!.skill).toBe("codeflex-dotnet");
      expect(result.missing[0]!.path).toBe("~/.agents/skills");
    });
  });

  it("reports inSync when projection matches canonical", async () => {
    await withFakeHome(async ({ tempDir, fakeHome }) => {
      const canonicalDir = join(tempDir, ".codeflex", "skills", "codeflex-dotnet");
      const projectionDir = join(fakeHome, ".agents", "skills", "codeflex-dotnet");

      await mkdir(canonicalDir, { recursive: true });
      await writeFile(join(canonicalDir, "SKILL.md"), "# Skill", "utf-8");

      await mkdir(projectionDir, { recursive: true });
      await writeFile(join(projectionDir, "SKILL.md"), "# Skill", "utf-8");

      const lock = mockLock({
        skills: ["codeflex-dotnet"],
        projections: [{ adapters: ["agents"], path: "~/.agents/skills" }],
      });

      const result = await verifyProjection(tempDir, lock);

      expect(result.inSync).toBe(true);
      expect(result.stale).toHaveLength(0);
      expect(result.missing).toHaveLength(0);
    });
  });

  it("reports stale projection when content differs", async () => {
    await withFakeHome(async ({ tempDir, fakeHome }) => {
      const canonicalDir = join(tempDir, ".codeflex", "skills", "codeflex-dotnet");
      const projectionDir = join(fakeHome, ".agents", "skills", "codeflex-dotnet");

      await mkdir(canonicalDir, { recursive: true });
      await writeFile(join(canonicalDir, "SKILL.md"), "# Updated Skill", "utf-8");

      await mkdir(projectionDir, { recursive: true });
      await writeFile(join(projectionDir, "SKILL.md"), "# Old Skill", "utf-8");

      const lock = mockLock({
        skills: ["codeflex-dotnet"],
        projections: [{ adapters: ["agents"], path: "~/.agents/skills" }],
      });

      const result = await verifyProjection(tempDir, lock);

      expect(result.inSync).toBe(false);
      expect(result.stale).toHaveLength(1);
      expect(result.stale[0]!.skill).toBe("codeflex-dotnet");
      expect(result.stale[0]!.reason).toBe("content_mismatch");
    });
  });

  it("reports unexpected skills in projection directory", async () => {
    await withFakeHome(async ({ tempDir, fakeHome }) => {
      const projectionDir = join(fakeHome, ".agents", "skills");
      await mkdir(join(projectionDir, "codeflex-stale"), { recursive: true });
      await writeFile(join(projectionDir, "codeflex-stale", "SKILL.md"), "# Stale", "utf-8");

      const lock = mockLock({
        skills: [],
        projections: [{ adapters: ["agents"], path: "~/.agents/skills" }],
      });

      const result = await verifyProjection(tempDir, lock);

      expect(result.inSync).toBe(false);
      expect(result.unexpected).toHaveLength(1);
      expect(result.unexpected[0]).toContain("codeflex-stale");
    });
  });

  it("does not report unexpected for non-codeflex prefixed entries", async () => {
    await withFakeHome(async ({ tempDir, fakeHome }) => {
      const projectionDir = join(fakeHome, ".agents", "skills");
      await mkdir(join(projectionDir, "custom-file"), { recursive: true });

      const lock = mockLock({
        skills: [],
        projections: [{ adapters: ["agents"], path: "~/.agents/skills" }],
      });

      const result = await verifyProjection(tempDir, lock);

      expect(result.unexpected).toHaveLength(0);
      expect(result.inSync).toBe(true);
    });
  });

  it("handles multiple projections", async () => {
    await withFakeHome(async ({ tempDir }) => {
      const lock = mockLock({
        skills: ["codeflex-dotnet"],
        projections: [
          { adapters: ["agents"], path: "~/.agents/skills" },
          { adapters: ["claude"], path: "~/.claude/skills" },
        ],
      });

      const result = await verifyProjection(tempDir, lock);

      expect(result.missing).toHaveLength(2);
    });
  });

  it("detects unexpected entries with client- and repo- prefixes", async () => {
    await withFakeHome(async ({ tempDir, fakeHome }) => {
      const projectionDir = join(fakeHome, ".agents", "skills");
      await mkdir(join(projectionDir, "client-custom"), { recursive: true });
      await mkdir(join(projectionDir, "repo-local"), { recursive: true });

      const lock = mockLock({
        skills: [],
        projections: [{ adapters: ["agents"], path: "~/.agents/skills" }],
      });

      const result = await verifyProjection(tempDir, lock);

      expect(result.unexpected).toHaveLength(2);
    });
  });

  it("uses managedProjections to detect unexpected non-conventionally-named skills", async () => {
    await withFakeHome(async ({ tempDir, fakeHome }) => {
      const projectionDir = join(fakeHome, ".agents", "skills");
      await mkdir(join(projectionDir, "acme-widgets"), { recursive: true });
      await writeFile(join(projectionDir, "acme-widgets", "SKILL.md"), "# Widgets", "utf-8");

      const lock = mockLock({
        skills: [],
        projections: [{ adapters: ["agents"], path: "~/.agents/skills" }],
        managedProjections: { "~/.agents/skills": ["acme-widgets"] },
      });

      const result = await verifyProjection(tempDir, lock);

      expect(result.unexpected).toHaveLength(1);
      expect(result.unexpected[0]).toContain("acme-widgets");
    });
  });

  it("does not flag unmanaged non-conventionally-named entries as unexpected when managedProjections is present", async () => {
    await withFakeHome(async ({ tempDir, fakeHome }) => {
      const projectionDir = join(fakeHome, ".agents", "skills");
      await mkdir(join(projectionDir, "user-notes"), { recursive: true });

      const lock = mockLock({
        skills: [],
        projections: [{ adapters: ["agents"], path: "~/.agents/skills" }],
        managedProjections: { "~/.agents/skills": [] },
      });

      const result = await verifyProjection(tempDir, lock);

      expect(result.unexpected).toHaveLength(0);
      expect(result.inSync).toBe(true);
    });
  });
});
