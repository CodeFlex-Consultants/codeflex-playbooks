import { describe, it, expect } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSkillsFromSource, loadSkillsFromSourceWithDiagnostics } from "../../../src/resolution/skill-loader";

async function createSkillDir(
  baseDir: string,
  skillName: string,
  skillMd: string,
  codeflexYaml: string,
): Promise<void> {
  const skillDir = join(baseDir, skillName);
  await mkdir(skillDir, { recursive: true });
  await writeFile(join(skillDir, "SKILL.md"), skillMd, "utf-8");
  await writeFile(join(skillDir, "codeflex.yaml"), codeflexYaml, "utf-8");
}

const validSkillMd = [
  "---",
  "name: test-skill",
  "description: A test skill",
  "---",
  "# Test Skill",
  "",
  "Instructions here.",
].join("\n");

const validCodeflexYaml = [
  "id: test-skill",
  "source: codeflex",
  "overridePolicy: allowed",
  "owner:",
  "  team: test-team",
  "rules:",
  "  - TEST-001",
].join("\n");

describe("loadSkillsFromSource", () => {
  it("loads a valid skill from a directory", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "skill-loader-test-"));
    try {
      await createSkillDir(baseDir, "test-skill", validSkillMd, validCodeflexYaml);

      const skills = await loadSkillsFromSource(baseDir, "codeflex");

      expect(skills).toHaveLength(1);
      expect(skills[0]!.id).toBe("test-skill");
      expect(skills[0]!.source).toBe("codeflex");
      expect(skills[0]!.manifest.name).toBe("test-skill");
      expect(skills[0]!.manifest.description).toBe("A test skill");
      expect(skills[0]!.metadata.rules).toEqual(["TEST-001"]);
    } finally {
      await rm(baseDir, { recursive: true, force: true });
    }
  });

  it("returns empty array for non-existent directory", async () => {
    const skills = await loadSkillsFromSource("/nonexistent/path/12345", "codeflex");
    expect(skills).toHaveLength(0);
  });

  it("skips files in the source directory", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "skill-loader-test-"));
    try {
      await writeFile(join(baseDir, "README.md"), "# Not a skill", "utf-8");

      const skills = await loadSkillsFromSource(baseDir, "codeflex");
      expect(skills).toHaveLength(0);
    } finally {
      await rm(baseDir, { recursive: true, force: true });
    }
  });

  it("skips directories without SKILL.md", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "skill-loader-test-"));
    try {
      const skillDir = join(baseDir, "incomplete-skill");
      await mkdir(skillDir);
      await writeFile(join(skillDir, "codeflex.yaml"), validCodeflexYaml, "utf-8");

      const skills = await loadSkillsFromSource(baseDir, "codeflex");
      expect(skills).toHaveLength(0);
    } finally {
      await rm(baseDir, { recursive: true, force: true });
    }
  });

  it("skips directories without codeflex.yaml", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "skill-loader-test-"));
    try {
      const skillDir = join(baseDir, "incomplete-skill");
      await mkdir(skillDir);
      await writeFile(join(skillDir, "SKILL.md"), validSkillMd, "utf-8");

      const skills = await loadSkillsFromSource(baseDir, "codeflex");
      expect(skills).toHaveLength(0);
    } finally {
      await rm(baseDir, { recursive: true, force: true });
    }
  });

  it("loads multiple skills from a directory", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "skill-loader-test-"));
    try {
      const yaml1 = validCodeflexYaml;
      const yaml2 = validCodeflexYaml.replace("test-skill", "second-skill").replace("TEST-001", "TEST-002");
      const md2 = validSkillMd.replace("test-skill", "second-skill").replace("A test skill", "Second skill");

      await createSkillDir(baseDir, "skill-a", validSkillMd, yaml1);
      await createSkillDir(baseDir, "skill-b", md2, yaml2);

      const skills = await loadSkillsFromSource(baseDir, "codeflex");
      expect(skills).toHaveLength(2);

      const ids = skills.map((s) => s.id).sort();
      expect(ids).toEqual(["second-skill", "test-skill"]);
    } finally {
      await rm(baseDir, { recursive: true, force: true });
    }
  });

  it("skips skills with invalid frontmatter in SKILL.md", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "skill-loader-test-"));
    try {
      const badMd = "No frontmatter here\nJust plain text";
      await createSkillDir(baseDir, "bad-skill", badMd, validCodeflexYaml);

      const skills = await loadSkillsFromSource(baseDir, "codeflex");
      expect(skills).toHaveLength(0);
    } finally {
      await rm(baseDir, { recursive: true, force: true });
    }
  });

  it("skips skills with invalid codeflex.yaml schema", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "skill-loader-test-"));
    try {
      const badYaml = "id: test\nmissing_required_fields: true";
      await createSkillDir(baseDir, "bad-yaml-skill", validSkillMd, badYaml);

      const skills = await loadSkillsFromSource(baseDir, "codeflex");
      expect(skills).toHaveLength(0);
    } finally {
      await rm(baseDir, { recursive: true, force: true });
    }
  });

  it("preserves the source parameter in loaded skills", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "skill-loader-test-"));
    try {
      await createSkillDir(baseDir, "test-skill", validSkillMd, validCodeflexYaml);

      const codeflexSkills = await loadSkillsFromSource(baseDir, "codeflex");
      expect(codeflexSkills[0]!.source).toBe("codeflex");

      const clientSkills = await loadSkillsFromSource(baseDir, "client");
      expect(clientSkills[0]!.source).toBe("client");
    } finally {
      await rm(baseDir, { recursive: true, force: true });
    }
  });

  it("sets skillDir to the full path of the skill directory", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "skill-loader-test-"));
    try {
      await createSkillDir(baseDir, "test-skill", validSkillMd, validCodeflexYaml);

      const skills = await loadSkillsFromSource(baseDir, "codeflex");
      expect(skills[0]!.skillDir).toBe(join(baseDir, "test-skill"));
    } finally {
      await rm(baseDir, { recursive: true, force: true });
    }
  });

  it("handles empty source directory", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "skill-loader-test-"));
    try {
      const skills = await loadSkillsFromSource(baseDir, "codeflex");
      expect(skills).toHaveLength(0);
    } finally {
      await rm(baseDir, { recursive: true, force: true });
    }
  });
});

describe("loadSkillsFromSourceWithDiagnostics", () => {
  it("returns diagnostics for missing SKILL.md or codeflex.yaml", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "skill-loader-diag-test-"));
    try {
      const skillDir = join(baseDir, "incomplete-skill");
      await mkdir(skillDir);
      await writeFile(join(skillDir, "SKILL.md"), validSkillMd, "utf-8");

      const result = await loadSkillsFromSourceWithDiagnostics(baseDir, "codeflex");

      expect(result.skills).toHaveLength(0);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]!.code).toBe("SKILL_MISSING_FILES");
      expect(result.diagnostics[0]!.message).toContain("incomplete-skill");
    } finally {
      await rm(baseDir, { recursive: true, force: true });
    }
  });

  it("returns diagnostics for invalid frontmatter", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "skill-loader-diag-test-"));
    try {
      const badMd = "No frontmatter here\nJust plain text";
      await createSkillDir(baseDir, "bad-frontmatter", badMd, validCodeflexYaml);

      const result = await loadSkillsFromSourceWithDiagnostics(baseDir, "codeflex");

      expect(result.skills).toHaveLength(0);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]!.code).toBe("SKILL_INVALID_FRONTMATTER");
    } finally {
      await rm(baseDir, { recursive: true, force: true });
    }
  });

  it("returns diagnostics for invalid codeflex.yaml", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "skill-loader-diag-test-"));
    try {
      const badYaml = "id: test\nmissing_required_fields: true";
      await createSkillDir(baseDir, "bad-yaml", validSkillMd, badYaml);

      const result = await loadSkillsFromSourceWithDiagnostics(baseDir, "codeflex");

      expect(result.skills).toHaveLength(0);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]!.code).toBe("SKILL_INVALID_MANIFEST");
    } finally {
      await rm(baseDir, { recursive: true, force: true });
    }
  });

  it("returns no diagnostics for valid skills", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "skill-loader-diag-test-"));
    try {
      await createSkillDir(baseDir, "valid-skill", validSkillMd, validCodeflexYaml);

      const result = await loadSkillsFromSourceWithDiagnostics(baseDir, "codeflex");

      expect(result.skills).toHaveLength(1);
      expect(result.diagnostics).toHaveLength(0);
    } finally {
      await rm(baseDir, { recursive: true, force: true });
    }
  });
});
