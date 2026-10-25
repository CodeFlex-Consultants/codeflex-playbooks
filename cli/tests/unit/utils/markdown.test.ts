import { describe, it, expect } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isRuleId, extractRuleText, loadSkillMd } from "../../../src/utils/markdown";

describe("isRuleId", () => {
  it("matches valid rule IDs", () => {
    expect(isRuleId("DOTNET-001")).toBe(true);
    expect(isRuleId("API-42")).toBe(true);
    expect(isRuleId("X-1")).toBe(true);
    expect(isRuleId("ABC123-99")).toBe(true);
  });

  it("rejects invalid rule IDs", () => {
    expect(isRuleId("")).toBe(false);
    expect(isRuleId("lowercase-1")).toBe(false);
    expect(isRuleId("123-1")).toBe(false);
    expect(isRuleId("NODASH")).toBe(false);
    expect(isRuleId("-123")).toBe(false);
    expect(isRuleId("A-")).toBe(false);
  });
});

describe("extractRuleText", () => {
  it("extracts text under matching heading", () => {
    const content = [
      "# Skills",
      "",
      "## DOTNET-001 Naming",
      "",
      "Use PascalCase for classes.",
      "Use camelCase for methods.",
    ].join("\n");

    const result = extractRuleText(content, "DOTNET-001");
    expect(result).toContain("Use PascalCase for classes.");
    expect(result).toContain("Use camelCase for methods.");
  });

  it("stops at same-level heading", () => {
    const content = [
      "## DOTNET-001 First",
      "",
      "Content for first rule.",
      "",
      "## DOTNET-002 Second",
      "",
      "Content for second rule.",
    ].join("\n");

    const result = extractRuleText(content, "DOTNET-001");
    expect(result).toContain("Content for first rule.");
    expect(result).not.toContain("DOTNET-002");
    expect(result).not.toContain("Content for second rule.");
  });

  it("returns empty string when rule not found", () => {
    const content = "## OTHER-001\n\nSome text.";
    const result = extractRuleText(content, "DOTNET-999");
    expect(result).toBe("");
  });

  it("includes sub-headings within the rule section", () => {
    const content = [
      "## API-10 Endpoint Design",
      "",
      "General guidance.",
      "",
      "### Naming Conventions",
      "",
      "Use plural nouns.",
      "",
      "## API-11 Other",
    ].join("\n");

    const result = extractRuleText(content, "API-10");
    expect(result).toContain("General guidance.");
    expect(result).toContain("### Naming Conventions");
    expect(result).toContain("Use plural nouns.");
    expect(result).not.toContain("API-11");
  });
});

describe("loadSkillMd", () => {
  it("returns content when file exists", async () => {
    const dir = await mkdtemp(join(tmpdir(), "markdown-test-"));
    try {
      await writeFile(join(dir, "SKILL.md"), "# Test Skill\n\nDescription.", "utf-8");
      const result = await loadSkillMd(dir);
      expect(result).toContain("# Test Skill");
      expect(result).toContain("Description.");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns undefined when file missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "markdown-test-"));
    try {
      const result = await loadSkillMd(dir);
      expect(result).toBeUndefined();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
