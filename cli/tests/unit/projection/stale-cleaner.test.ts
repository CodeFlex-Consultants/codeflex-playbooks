import { describe, it, expect } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanStaleProjections } from "../../../src/projection/stale-cleaner";

describe("cleanStaleProjections", () => {
  it("removes stale entries identified via managedProjections, even with non-conventional names", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "stale-cleaner-test-"));
    try {
      const projectionDir = join(tempDir, ".agents", "skills");
      await mkdir(join(projectionDir, "acme-widgets"), { recursive: true });
      await writeFile(join(projectionDir, "acme-widgets", "SKILL.md"), "# Widgets", "utf-8");

      const result = await cleanStaleProjections({
        projectRoot: tempDir,
        projectionPaths: [".agents/skills"],
        currentSkills: [],
        previousManagedProjections: { ".agents/skills": ["acme-widgets"] },
      });

      expect(result.removed).toEqual([".agents/skills/acme-widgets"]);
      expect(result.errors).toHaveLength(0);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("does not remove a non-conventionally-named entry that is not in managedProjections", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "stale-cleaner-test-"));
    try {
      const projectionDir = join(tempDir, ".agents", "skills");
      await mkdir(join(projectionDir, "user-notes"), { recursive: true });

      const result = await cleanStaleProjections({
        projectRoot: tempDir,
        projectionPaths: [".agents/skills"],
        currentSkills: [],
        previousManagedProjections: { ".agents/skills": [] },
      });

      expect(result.removed).toHaveLength(0);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("falls back to prefix heuristic when managedProjections is absent (backward compatibility)", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "stale-cleaner-test-"));
    try {
      const projectionDir = join(tempDir, ".agents", "skills");
      await mkdir(join(projectionDir, "codeflex-dotnet"), { recursive: true });
      await mkdir(join(projectionDir, "client-custom"), { recursive: true });
      await mkdir(join(projectionDir, "user-notes"), { recursive: true });

      const result = await cleanStaleProjections({
        projectRoot: tempDir,
        projectionPaths: [".agents/skills"],
        currentSkills: [],
        clientSkillIds: ["client-custom"],
      });

      expect(result.removed).toContain(".agents/skills/codeflex-dotnet");
      expect(result.removed).toContain(".agents/skills/client-custom");
      expect(result.removed).not.toContain(".agents/skills/user-notes");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("keeps entries still present in currentSkills even if managed", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "stale-cleaner-test-"));
    try {
      const projectionDir = join(tempDir, ".agents", "skills");
      await mkdir(join(projectionDir, "acme-widgets"), { recursive: true });

      const result = await cleanStaleProjections({
        projectRoot: tempDir,
        projectionPaths: [".agents/skills"],
        currentSkills: ["acme-widgets"],
        previousManagedProjections: { ".agents/skills": ["acme-widgets"] },
      });

      expect(result.removed).toHaveLength(0);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
