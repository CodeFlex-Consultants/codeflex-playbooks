import { describe, it, expect } from "vitest";
import { readCanonicalStore, writeCanonicalStore } from "../../../src/skills/canonical-store";
import { swapDirectory } from "../../../src/skills/swap";
import { installSkills } from "../../../src/skills/installer";
import { mkdtemp, rm, mkdir, writeFile, readdir, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ResolvedSkill, StandardsSource, EngineeringLock } from "../../../src/types/index";
import { isWindows } from "../../../src/utils/platform";

describe("canonical-store", () => {
  it("should write and read skills", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "canonical-test-"));

    try {
      const skills = new Map([
        [
          "test-skill",
          {
            files: new Map([
              ["SKILL.md", "# Test Skill"],
              ["codeflex.yaml", "id: test-skill"],
            ]),
          },
        ],
      ]);

      await writeCanonicalStore(tempDir, skills);
      const result = await readCanonicalStore(tempDir);

      expect(result.size).toBe(1);
      expect(result.has("test-skill")).toBe(true);

      const skill = result.get("test-skill");
      expect(skill?.files).toContain("SKILL.md");
      expect(skill?.files).toContain("codeflex.yaml");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should return empty map for missing directory", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "canonical-test-"));

    try {
      const result = await readCanonicalStore(tempDir);
      expect(result.size).toBe(0);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should skip unreadable skill directories", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "canonical-test-"));

    try {
      const skillsDir = join(tempDir, ".codeflex", "skills");
      await mkdir(skillsDir, { recursive: true });

      const readableSkill = join(skillsDir, "readable-skill");
      await mkdir(readableSkill);
      await writeFile(join(readableSkill, "SKILL.md"), "# Readable", "utf-8");

      const unreadableSkill = join(skillsDir, "unreadable-skill");
      await mkdir(unreadableSkill);
      await writeFile(join(unreadableSkill, "SKILL.md"), "# Unreadable", "utf-8");

      if (!isWindows) {
        // On Unix systems, make the directory unreadable
        await import("node:fs/promises").then(({ chmod }) => chmod(unreadableSkill, 0o000));
      }

      const result = await readCanonicalStore(tempDir);

      if (isWindows) {
        // On Windows, chmod 0o000 doesn't make directories unreadable,
        // so both skills will be readable
        expect(result.size).toBe(2);
        expect(result.has("readable-skill")).toBe(true);
        expect(result.has("unreadable-skill")).toBe(true);
      } else {
        // On Unix systems, the unreadable skill should be skipped
        expect(result.size).toBe(1);
        expect(result.has("readable-skill")).toBe(true);
        expect(result.has("unreadable-skill")).toBe(false);
      }
    } finally {
      if (!isWindows) {
        await import("node:fs/promises").then(({ chmod }) => 
          chmod(join(tempDir, ".codeflex", "skills", "unreadable-skill"), 0o755).catch(() => {})
        );
      }
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe("swapDirectory", () => {
  it("should swap temp directory to target when no target exists", async () => {
    const base = await mkdtemp(join(tmpdir(), "swap-test-"));
    const tempDir = join(base, "temp");
    const targetDir = join(base, "target");

    try {
      await mkdir(tempDir);
      await writeFile(join(tempDir, "file.txt"), "new-content", "utf-8");

      await swapDirectory(tempDir, targetDir);

      const content = await readFile(join(targetDir, "file.txt"), "utf-8");
      expect(content).toBe("new-content");

      const entries = await readdir(base);
      expect(entries).not.toContain("temp");
      expect(entries).not.toContain("target.bak");
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it("should replace existing target with temp contents", async () => {
    const base = await mkdtemp(join(tmpdir(), "swap-test-"));
    const tempDir = join(base, "temp");
    const targetDir = join(base, "target");

    try {
      await mkdir(tempDir);
      await writeFile(join(tempDir, "new.txt"), "new", "utf-8");

      await mkdir(targetDir);
      await writeFile(join(targetDir, "old.txt"), "old", "utf-8");

      await swapDirectory(tempDir, targetDir);

      const content = await readFile(join(targetDir, "new.txt"), "utf-8");
      expect(content).toBe("new");

      const entries = await readdir(targetDir);
      expect(entries).not.toContain("old.txt");
      expect(entries).not.toContain("temp");

      const backupExists = await stat(join(base, "target.bak")).then(() => true, () => false);
      expect(backupExists).toBe(false);
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it("should restore from backup if rename temp to target fails", async () => {
    const base = await mkdtemp(join(tmpdir(), "swap-test-"));
    const tempDir = join(base, "nonexistent-temp");
    const targetDir = join(base, "target");

    try {
      await mkdir(targetDir);
      await writeFile(join(targetDir, "original.txt"), "original", "utf-8");

      try {
        await swapDirectory(tempDir, targetDir);
      } catch {
        // expected to fail since tempDir doesn't exist
      }

      const targetExists = await stat(targetDir).then(() => true, () => false);
      expect(targetExists).toBe(true);

      const content = await readFile(join(targetDir, "original.txt"), "utf-8");
      expect(content).toBe("original");
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it("should leave no backup directory after successful swap", async () => {
    const base = await mkdtemp(join(tmpdir(), "swap-test-"));
    const tempDir = join(base, "temp");
    const targetDir = join(base, "target");

    try {
      await mkdir(tempDir);
      await writeFile(join(tempDir, "data.txt"), "data", "utf-8");

      await mkdir(targetDir);
      await writeFile(join(targetDir, "stale.txt"), "stale", "utf-8");

      await swapDirectory(tempDir, targetDir);

      const entries = await readdir(base);
      expect(entries.filter((e) => e.endsWith(".bak"))).toHaveLength(0);
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });
});

describe("installSkills", () => {
  it("should track removed skills that were in targetDir but not in resolved", async () => {
    const base = await mkdtemp(join(tmpdir(), "installer-test-"));
    const sourceDir = join(base, "source");
    const projectRoot = base;

    try {
      const sourceSkillDir = join(sourceDir, "new-skill");
      await mkdir(sourceSkillDir, { recursive: true });
      await writeFile(join(sourceSkillDir, "SKILL.md"), "# New Skill", "utf-8");
      await writeFile(join(sourceSkillDir, "codeflex.yaml"), "id: new-skill", "utf-8");

      const targetDir = join(projectRoot, ".codeflex", "skills");
      await mkdir(targetDir, { recursive: true });
      await mkdir(join(targetDir, "stale-skill"), { recursive: true });
      await writeFile(join(targetDir, "stale-skill", "SKILL.md"), "# Stale", "utf-8");

      const resolvedSkills: ResolvedSkill[] = [
        { id: "new-skill", slug: "new-skill", source: "codeflex" },
      ];

      const sources: StandardsSource[] = [
        { type: "codeflex", sha256: "hash", skillsDir: sourceDir },
      ];

      const lock: EngineeringLock = {
        version: 1,
        sources: {},
        skills: ["new-skill"],
        projections: [],
      };

      const result = await installSkills({
        projectRoot,
        resolvedSkills,
        sources,
        lock,
      });

      expect(result.installed).toContain("new-skill");
      expect(result.removed).toContain("stale-skill");
      expect(result.removed).not.toContain("new-skill");
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it("should not report removed skills when targetDir did not exist", async () => {
    const base = await mkdtemp(join(tmpdir(), "installer-test-"));
    const sourceDir = join(base, "source");
    const projectRoot = base;

    try {
      const sourceSkillDir = join(sourceDir, "new-skill");
      await mkdir(sourceSkillDir, { recursive: true });
      await writeFile(join(sourceSkillDir, "SKILL.md"), "# New Skill", "utf-8");
      await writeFile(join(sourceSkillDir, "codeflex.yaml"), "id: new-skill", "utf-8");

      const resolvedSkills: ResolvedSkill[] = [
        { id: "new-skill", slug: "new-skill", source: "codeflex" },
      ];

      const sources: StandardsSource[] = [
        { type: "codeflex", sha256: "hash", skillsDir: sourceDir },
      ];

      const lock: EngineeringLock = {
        version: 1,
        sources: {},
        skills: ["new-skill"],
        projections: [],
      };

      const result = await installSkills({
        projectRoot,
        resolvedSkills,
        sources,
        lock,
      });

      expect(result.installed).toContain("new-skill");
      expect(result.removed).toHaveLength(0);
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it("should match skills to correct source when multiple sources of same type exist", async () => {
    const base = await mkdtemp(join(tmpdir(), "installer-test-"));
    const client1Dir = join(base, "client1");
    const client2Dir = join(base, "client2");
    const projectRoot = base;

    try {
      const client1SkillDir = join(client1Dir, "client-alpha-dotnet");
      await mkdir(client1SkillDir, { recursive: true });
      await writeFile(join(client1SkillDir, "SKILL.md"), "# Client Alpha Skill", "utf-8");
      await writeFile(join(client1SkillDir, "codeflex.yaml"), "id: client-alpha-dotnet", "utf-8");

      const client2SkillDir = join(client2Dir, "client-beta-dotnet");
      await mkdir(client2SkillDir, { recursive: true });
      await writeFile(join(client2SkillDir, "SKILL.md"), "# Client Beta Skill", "utf-8");
      await writeFile(join(client2SkillDir, "codeflex.yaml"), "id: client-beta-dotnet", "utf-8");

      const resolvedSkills: ResolvedSkill[] = [
        { id: "client-alpha-dotnet", slug: "client-alpha-dotnet", source: "client", sourceId: "client-alpha" },
        { id: "client-beta-dotnet", slug: "client-beta-dotnet", source: "client", sourceId: "client-beta" },
      ];

      const sources: StandardsSource[] = [
        { type: "client", id: "client-alpha", sha256: "hash1", skillsDir: client1Dir },
        { type: "client", id: "client-beta", sha256: "hash2", skillsDir: client2Dir },
      ];

      const lock: EngineeringLock = {
        version: 1,
        sources: {},
        skills: ["client-alpha-dotnet", "client-beta-dotnet"],
        projections: [],
      };

      const result = await installSkills({
        projectRoot,
        resolvedSkills,
        sources,
        lock,
      });

      expect(result.installed).toContain("client-alpha-dotnet");
      expect(result.installed).toContain("client-beta-dotnet");
      expect(result.errors).toHaveLength(0);

      const targetDir = join(projectRoot, ".codeflex", "skills");
      const alphaContent = await readFile(join(targetDir, "client-alpha-dotnet", "SKILL.md"), "utf-8");
      expect(alphaContent).toBe("# Client Alpha Skill");

      const betaContent = await readFile(join(targetDir, "client-beta-dotnet", "SKILL.md"), "utf-8");
      expect(betaContent).toBe("# Client Beta Skill");
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it("should report error when skill source ID does not match any source", async () => {
    const base = await mkdtemp(join(tmpdir(), "installer-test-"));
    const client1Dir = join(base, "client1");
    const projectRoot = base;

    try {
      const client1SkillDir = join(client1Dir, "client-alpha-dotnet");
      await mkdir(client1SkillDir, { recursive: true });
      await writeFile(join(client1SkillDir, "SKILL.md"), "# Client Alpha Skill", "utf-8");
      await writeFile(join(client1SkillDir, "codeflex.yaml"), "id: client-alpha-dotnet", "utf-8");

      const resolvedSkills: ResolvedSkill[] = [
        { id: "client-alpha-dotnet", slug: "client-alpha-dotnet", source: "client", sourceId: "client-alpha" },
        { id: "client-gamma-dotnet", slug: "client-gamma-dotnet", source: "client", sourceId: "client-gamma" },
      ];

      const sources: StandardsSource[] = [
        { type: "client", id: "client-alpha", sha256: "hash1", skillsDir: client1Dir },
      ];

      const lock: EngineeringLock = {
        version: 1,
        sources: {},
        skills: ["client-alpha-dotnet", "client-gamma-dotnet"],
        projections: [],
      };

      const result = await installSkills({
        projectRoot,
        resolvedSkills,
        sources,
        lock,
      });

      expect(result.installed).toContain("client-alpha-dotnet");
      expect(result.errors.some((e) => e.includes("client-gamma-dotnet"))).toBe(true);
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it("installs from skill.skillDir directly when set, bypassing skillsDir/<id> path reconstruction", async () => {
    const base = await mkdtemp(join(tmpdir(), "installer-test-"));
    const projectRoot = base;

    try {
      // The skill's id ("backend.dotnet") deliberately does not match its actual on-disk
      // location (nested under a category folder, as in the real engineering-skills repo),
      // so join(source.skillsDir, skill.id) would resolve to a directory that doesn't exist.
      const sourceDir = join(base, "source");
      const nestedSkillDir = join(sourceDir, "backend", "dotnet");
      await mkdir(nestedSkillDir, { recursive: true });
      await writeFile(join(nestedSkillDir, "SKILL.md"), "# Dotnet Skill", "utf-8");
      await writeFile(join(nestedSkillDir, "codeflex.yaml"), "id: backend.dotnet", "utf-8");

      const resolvedSkills: ResolvedSkill[] = [
        { id: "backend.dotnet", slug: "backend.dotnet", source: "codeflex", skillDir: nestedSkillDir },
      ];

      const sources: StandardsSource[] = [
        { type: "codeflex", sha256: "hash", skillsDir: sourceDir },
      ];

      const lock: EngineeringLock = {
        version: 1,
        sources: {},
        skills: ["backend.dotnet"],
        projections: [],
      };

      const result = await installSkills({ projectRoot, resolvedSkills, sources, lock });

      expect(result.errors).toHaveLength(0);
      expect(result.installed).toContain("backend.dotnet");

      const installedContent = await readFile(
        join(projectRoot, ".codeflex", "skills", "backend.dotnet", "SKILL.md"),
        "utf-8",
      );
      expect(installedContent).toBe("# Dotnet Skill");
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it("falls back to skillsDir/<id> reconstruction when skill.skillDir is not set", async () => {
    const base = await mkdtemp(join(tmpdir(), "installer-test-"));
    const projectRoot = base;

    try {
      const sourceDir = join(base, "source");
      const flatSkillDir = join(sourceDir, "flat-skill");
      await mkdir(flatSkillDir, { recursive: true });
      await writeFile(join(flatSkillDir, "SKILL.md"), "# Flat Skill", "utf-8");
      await writeFile(join(flatSkillDir, "codeflex.yaml"), "id: flat-skill", "utf-8");

      const resolvedSkills: ResolvedSkill[] = [
        { id: "flat-skill", slug: "flat-skill", source: "codeflex" },
      ];

      const sources: StandardsSource[] = [
        { type: "codeflex", sha256: "hash", skillsDir: sourceDir },
      ];

      const lock: EngineeringLock = {
        version: 1,
        sources: {},
        skills: ["flat-skill"],
        projections: [],
      };

      const result = await installSkills({ projectRoot, resolvedSkills, sources, lock });

      expect(result.errors).toHaveLength(0);
      expect(result.installed).toContain("flat-skill");
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it("falls back to a nested-tree scan when skill.skillDir is not set and the flat path doesn't exist", async () => {
    // Reproduces sync's "missing skills, re-fetch from upstream" path: sync reconstructs
    // ResolvedSkill[] purely from the lock's skill ids (no skillDir), so if the re-fetched
    // source nests skills under category folders (as the real engineering-skills repo
    // does), installSkills must still be able to locate and install them.
    const base = await mkdtemp(join(tmpdir(), "installer-test-"));
    const projectRoot = base;

    try {
      const sourceDir = join(base, "source");
      const nestedSkillDir = join(sourceDir, "backend", "dotnet");
      await mkdir(nestedSkillDir, { recursive: true });
      await writeFile(
        join(nestedSkillDir, "SKILL.md"),
        ["---", "name: backend.dotnet", "description: test", "---", "# Dotnet Skill"].join("\n"),
        "utf-8",
      );
      await writeFile(
        join(nestedSkillDir, "codeflex.yaml"),
        ["id: backend.dotnet", "source: codeflex", "overridePolicy: allowed", "owner:", "  team: test-team"].join("\n"),
        "utf-8",
      );

      const resolvedSkills: ResolvedSkill[] = [
        { id: "backend.dotnet", slug: "backend.dotnet", source: "codeflex" },
      ];

      const sources: StandardsSource[] = [
        { type: "codeflex", sha256: "hash", skillsDir: sourceDir },
      ];

      const lock: EngineeringLock = {
        version: 1,
        sources: {},
        skills: ["backend.dotnet"],
        projections: [],
      };

      const result = await installSkills({ projectRoot, resolvedSkills, sources, lock });

      expect(result.errors).toHaveLength(0);
      expect(result.installed).toContain("backend.dotnet");

      const installedContent = await readFile(
        join(projectRoot, ".codeflex", "skills", "backend.dotnet", "SKILL.md"),
        "utf-8",
      );
      expect(installedContent).toContain("# Dotnet Skill");
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });
});
