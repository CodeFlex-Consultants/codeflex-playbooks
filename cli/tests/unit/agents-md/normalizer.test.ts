import { describe, it, expect } from "vitest";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { normalizeAgentsMd } from "../../../src/agents-md/normalizer";
import { MANAGED_SECTION_START, MANAGED_SECTION_END } from "../../../src/agents-md/markers";
import { generateManagedSection } from "../../../src/agents-md/section-generator";

describe("normalizeAgentsMd", () => {
  it("creates AGENTS.md when it does not exist", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "normalizer-dedicated-"));
    try {
      const result = await normalizeAgentsMd({ projectRoot: tempDir });

      expect(result.action).toBe("created");
      expect(result.newContent).toBeDefined();

      const content = await readFile(join(tempDir, "AGENTS.md"), "utf-8");
      expect(content).toContain(MANAGED_SECTION_START);
      expect(content).toContain(MANAGED_SECTION_END);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("updates existing file without managed section", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "normalizer-dedicated-"));
    try {
      const agentsPath = join(tempDir, "AGENTS.md");
      await writeFile(agentsPath, "# Project\n\nSome content.\n", "utf-8");

      const result = await normalizeAgentsMd({ projectRoot: tempDir });

      expect(result.action).toBe("updated");
      expect(result.previousContent).toContain("# Project");

      const content = await readFile(agentsPath, "utf-8");
      expect(content).toContain("# Project");
      expect(content).toContain(MANAGED_SECTION_START);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("returns unchanged when managed section is current", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "normalizer-dedicated-"));
    try {
      await normalizeAgentsMd({ projectRoot: tempDir });
      const result = await normalizeAgentsMd({ projectRoot: tempDir });

      expect(result.action).toBe("unchanged");
      expect(result.previousContent).toBeDefined();
      expect(result.newContent).toBeUndefined();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("updates when managed section content has changed", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "normalizer-dedicated-"));
    try {
      const agentsPath = join(tempDir, "AGENTS.md");
      const staleSection = `${MANAGED_SECTION_START}\n## Old Section\n\nOld content.\n${MANAGED_SECTION_END}`;
      await writeFile(agentsPath, `# Project\n\n${staleSection}\n`, "utf-8");

      const result = await normalizeAgentsMd({ projectRoot: tempDir });

      expect(result.action).toBe("updated");

      const content = await readFile(agentsPath, "utf-8");
      expect(content).not.toContain("Old Section");
      expect(content).toContain("MANDATORY PRE-FLIGHT");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("deduplicates multiple managed sections", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "normalizer-dedicated-"));
    try {
      const agentsPath = join(tempDir, "AGENTS.md");
      const managedSection = generateManagedSection();
      const content = [
        "# Project",
        "",
        managedSection,
        "",
        "Middle content.",
        "",
        managedSection,
        "",
        "End content.",
      ].join("\n");
      await writeFile(agentsPath, content, "utf-8");

      const result = await normalizeAgentsMd({ projectRoot: tempDir });

      expect(result.action).toBe("deduplicated");

      const fileContent = await readFile(agentsPath, "utf-8");
      const startCount = (fileContent.match(new RegExp(MANAGED_SECTION_START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
      expect(startCount).toBe(1);
      expect(fileContent).toContain("Middle content.");
      expect(fileContent).toContain("End content.");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("adopts legacy section without markers", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "normalizer-dedicated-"));
    try {
      const agentsPath = join(tempDir, "AGENTS.md");
      const legacy = [
        "# Project",
        "",
        "## CodeFlex Engineering Standards",
        "",
        "Old managed content.",
        "",
        "## Other Section",
        "",
        "More content.",
      ].join("\n");
      await writeFile(agentsPath, legacy, "utf-8");

      const result = await normalizeAgentsMd({ projectRoot: tempDir });

      expect(result.action).toBe("updated");

      const content = await readFile(agentsPath, "utf-8");
      expect(content).toContain(MANAGED_SECTION_START);
      expect(content).toContain("## Other Section");
      expect(content).not.toContain("Old managed content.");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("adopts legacy section at end of file", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "normalizer-dedicated-"));
    try {
      const agentsPath = join(tempDir, "AGENTS.md");
      const legacy = [
        "# Project",
        "",
        "## CodeFlex Engineering Standards",
        "",
        "Old content at end.",
      ].join("\n");
      await writeFile(agentsPath, legacy, "utf-8");

      const result = await normalizeAgentsMd({ projectRoot: tempDir });

      expect(result.action).toBe("updated");

      const content = await readFile(agentsPath, "utf-8");
      expect(content).toContain(MANAGED_SECTION_START);
      expect(content).not.toContain("Old content at end.");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("respects dryRun flag for creation", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "normalizer-dedicated-"));
    try {
      const result = await normalizeAgentsMd({ projectRoot: tempDir, dryRun: true });

      expect(result.action).toBe("created");
      expect(result.newContent).toBeDefined();

      let exists = false;
      try {
        await readFile(join(tempDir, "AGENTS.md"));
        exists = true;
      } catch {
        exists = false;
      }
      expect(exists).toBe(false);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("respects dryRun flag for update", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "normalizer-dedicated-"));
    try {
      const agentsPath = join(tempDir, "AGENTS.md");
      await writeFile(agentsPath, "# Existing\n", "utf-8");

      const result = await normalizeAgentsMd({ projectRoot: tempDir, dryRun: true });

      expect(result.action).toBe("updated");

      const content = await readFile(agentsPath, "utf-8");
      expect(content).toBe("# Existing\n");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("preserves content before and after managed section on update", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "normalizer-dedicated-"));
    try {
      const agentsPath = join(tempDir, "AGENTS.md");
      const managedSection = generateManagedSection();
      const content = `# Before\n\n${managedSection}\n\n# After\n`;
      await writeFile(agentsPath, content, "utf-8");

      const staleSection = `${MANAGED_SECTION_START}\n## Stale\n${MANAGED_SECTION_END}`;
      const withStale = `# Before\n\n${staleSection}\n\n# After\n`;
      await writeFile(agentsPath, withStale, "utf-8");

      const result = await normalizeAgentsMd({ projectRoot: tempDir });

      expect(result.action).toBe("updated");

      const fileContent = await readFile(agentsPath, "utf-8");
      expect(fileContent).toContain("# Before");
      expect(fileContent).toContain("# After");
      expect(fileContent).toContain("MANDATORY PRE-FLIGHT");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
