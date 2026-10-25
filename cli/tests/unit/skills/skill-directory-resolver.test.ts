import { describe, it, expect } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SkillDirectoryResolver } from "../../../src/skills/skill-directory-resolver";
import { SkillSource } from "../../../src/types/index";

async function writeValidSkill(skillDir: string, id: string): Promise<void> {
  await mkdir(skillDir, { recursive: true });
  await writeFile(join(skillDir, "SKILL.md"), ["---", `name: ${id}`, "description: test", "---", "# Test"].join("\n"), "utf-8");
  await writeFile(
    join(skillDir, "codeflex.yaml"),
    [`id: ${id}`, "source: codeflex", "overridePolicy: allowed", "owner:", "  team: test-team"].join("\n"),
    "utf-8",
  );
}

describe("SkillDirectoryResolver", () => {
  it("finds a skill at the flat path without scanning", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "skill-dir-resolver-"));
    try {
      const flatDir = join(baseDir, "flat-skill");
      await writeValidSkill(flatDir, "flat-skill");

      const resolver = new SkillDirectoryResolver();
      const found = await resolver.find(baseDir, "flat-skill", SkillSource.CodeFlex);

      expect(found).toBe(flatDir);
    } finally {
      await rm(baseDir, { recursive: true, force: true });
    }
  });

  it("falls back to a recursive scan for a skill nested under a category folder", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "skill-dir-resolver-"));
    try {
      const nestedDir = join(baseDir, "backend", "dotnet");
      await writeValidSkill(nestedDir, "backend.dotnet");

      const resolver = new SkillDirectoryResolver();
      const found = await resolver.find(baseDir, "backend.dotnet", SkillSource.CodeFlex);

      expect(found).toBe(nestedDir);
    } finally {
      await rm(baseDir, { recursive: true, force: true });
    }
  });

  it("returns undefined when a skill isn't found flatly or via the nested scan", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "skill-dir-resolver-"));
    try {
      await writeValidSkill(join(baseDir, "backend", "dotnet"), "backend.dotnet");

      const resolver = new SkillDirectoryResolver();
      const found = await resolver.find(baseDir, "frontend.angular", SkillSource.CodeFlex);

      expect(found).toBeUndefined();
    } finally {
      await rm(baseDir, { recursive: true, force: true });
    }
  });

  it("returns the flat path even when it isn't a directory, leaving that judgment to the caller", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "skill-dir-resolver-"));
    try {
      await mkdir(baseDir, { recursive: true });
      const filePath = join(baseDir, "not-a-dir");
      await writeFile(filePath, "not a directory", "utf-8");

      const resolver = new SkillDirectoryResolver();
      const found = await resolver.find(baseDir, "not-a-dir", SkillSource.CodeFlex);

      expect(found).toBe(filePath);
    } finally {
      await rm(baseDir, { recursive: true, force: true });
    }
  });

  it("does not trust a flat directory that shares a skill's id but isn't actually it", async () => {
    // An unrelated directory (e.g. a stray leftover from a repo layout migration, or a hand-
    // placed folder) happens to be named identically to a dotted skill id. Without an
    // identity check, this would silently shadow the real, correctly nested skill.
    const baseDir = await mkdtemp(join(tmpdir(), "skill-dir-resolver-"));
    try {
      const impostorDir = join(baseDir, "backend.dotnet");
      await mkdir(impostorDir, { recursive: true });
      await writeFile(join(impostorDir, "SKILL.md"), "# Not actually backend.dotnet", "utf-8");
      await writeFile(join(impostorDir, "codeflex.yaml"), "id: something-else-entirely", "utf-8");

      const realDir = join(baseDir, "backend", "dotnet");
      await writeValidSkill(realDir, "backend.dotnet");

      const resolver = new SkillDirectoryResolver();
      const found = await resolver.find(baseDir, "backend.dotnet", SkillSource.CodeFlex);

      expect(found).toBe(realDir);
    } finally {
      await rm(baseDir, { recursive: true, force: true });
    }
  });

  it("does not trust a flat directory with no codeflex.yaml at all, even if its name matches", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "skill-dir-resolver-"));
    try {
      const impostorDir = join(baseDir, "backend.dotnet");
      await mkdir(impostorDir, { recursive: true });
      await writeFile(join(impostorDir, "README.md"), "just a stray folder", "utf-8");

      const realDir = join(baseDir, "backend", "dotnet");
      await writeValidSkill(realDir, "backend.dotnet");

      const resolver = new SkillDirectoryResolver();
      const found = await resolver.find(baseDir, "backend.dotnet", SkillSource.CodeFlex);

      expect(found).toBe(realDir);
    } finally {
      await rm(baseDir, { recursive: true, force: true });
    }
  });

  it("memoizes the recursive scan across multiple lookups against the same skillsDir", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "skill-dir-resolver-"));
    try {
      await writeValidSkill(join(baseDir, "backend", "dotnet"), "backend.dotnet");
      await writeValidSkill(join(baseDir, "frontend", "angular"), "frontend.angular");

      const resolver = new SkillDirectoryResolver();
      const first = await resolver.find(baseDir, "backend.dotnet", SkillSource.CodeFlex);
      const second = await resolver.find(baseDir, "frontend.angular", SkillSource.CodeFlex);

      expect(first).toBe(join(baseDir, "backend", "dotnet"));
      expect(second).toBe(join(baseDir, "frontend", "angular"));
    } finally {
      await rm(baseDir, { recursive: true, force: true });
    }
  });
});
