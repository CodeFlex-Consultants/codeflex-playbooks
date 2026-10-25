import { describe, it, expect } from "vitest";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { normalizeGlobalAgentsMd } from "../../../src/agents-md/global-normalizer";
import { MANAGED_SECTION_START, MANAGED_SECTION_END } from "../../../src/agents-md/markers";
import { generateGlobalManagedSection } from "../../../src/agents-md/global-section-generator";

describe("normalizeGlobalAgentsMd", () => {
  it("creates ~/.agents/AGENTS.md when it does not exist", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "global-normalizer-"));
    try {
      const result = await normalizeGlobalAgentsMd({ baseDir: tempDir });

      expect(result.action).toBe("created");
      expect(result.newContent).toBeDefined();

      const content = await readFile(join(tempDir, ".agents", "AGENTS.md"), "utf-8");
      expect(content).toContain(MANAGED_SECTION_START);
      expect(content).toContain(MANAGED_SECTION_END);
      expect(content).toContain("GLOBAL CODEFLEX ENGINEERING STANDARDS");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("updates existing file without managed section", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "global-normalizer-"));
    try {
      const agentsDir = join(tempDir, ".agents");
      const agentsPath = join(agentsDir, "AGENTS.md");
      const { mkdir } = await import("node:fs/promises");
      await mkdir(agentsDir, { recursive: true });
      await writeFile(agentsPath, "# Global Config\n\nSome content.\n", "utf-8");

      const result = await normalizeGlobalAgentsMd({ baseDir: tempDir });

      expect(result.action).toBe("updated");
      expect(result.previousContent).toContain("# Global Config");

      const content = await readFile(agentsPath, "utf-8");
      expect(content).toContain("# Global Config");
      expect(content).toContain(MANAGED_SECTION_START);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("returns unchanged when managed section is current", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "global-normalizer-"));
    try {
      await normalizeGlobalAgentsMd({ baseDir: tempDir });
      const result = await normalizeGlobalAgentsMd({ baseDir: tempDir });

      expect(result.action).toBe("unchanged");
      expect(result.previousContent).toBeDefined();
      expect(result.newContent).toBeUndefined();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("updates when managed section content has changed", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "global-normalizer-"));
    try {
      const agentsDir = join(tempDir, ".agents");
      const agentsPath = join(agentsDir, "AGENTS.md");
      const { mkdir } = await import("node:fs/promises");
      await mkdir(agentsDir, { recursive: true });
      
      const staleSection = `${MANAGED_SECTION_START}\n## Old Section\n\nOld content.\n${MANAGED_SECTION_END}`;
      await writeFile(agentsPath, `# Global\n\n${staleSection}\n`, "utf-8");

      const result = await normalizeGlobalAgentsMd({ baseDir: tempDir });

      expect(result.action).toBe("updated");

      const content = await readFile(agentsPath, "utf-8");
      expect(content).not.toContain("Old Section");
      expect(content).toContain("GLOBAL CODEFLEX ENGINEERING STANDARDS");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("deduplicates multiple managed sections", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "global-normalizer-"));
    try {
      const agentsDir = join(tempDir, ".agents");
      const agentsPath = join(agentsDir, "AGENTS.md");
      const { mkdir } = await import("node:fs/promises");
      await mkdir(agentsDir, { recursive: true });
      
      const managedSection = generateGlobalManagedSection();
      const content = [
        "# Global",
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

      const result = await normalizeGlobalAgentsMd({ baseDir: tempDir });

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

  it("respects dryRun flag for creation", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "global-normalizer-"));
    try {
      const result = await normalizeGlobalAgentsMd({ baseDir: tempDir, dryRun: true });

      expect(result.action).toBe("created");
      expect(result.newContent).toBeDefined();

      let exists = false;
      try {
        await readFile(join(tempDir, ".agents", "AGENTS.md"));
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
    const tempDir = await mkdtemp(join(tmpdir(), "global-normalizer-"));
    try {
      const agentsDir = join(tempDir, ".agents");
      const agentsPath = join(agentsDir, "AGENTS.md");
      const { mkdir } = await import("node:fs/promises");
      await mkdir(agentsDir, { recursive: true });
      await writeFile(agentsPath, "# Existing\n", "utf-8");

      const result = await normalizeGlobalAgentsMd({ baseDir: tempDir, dryRun: true });

      expect(result.action).toBe("updated");

      const content = await readFile(agentsPath, "utf-8");
      expect(content).toBe("# Existing\n");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("includes cross-cutting skills when provided", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "global-normalizer-"));
    try {
      const result = await normalizeGlobalAgentsMd({
        baseDir: tempDir,
        crossCuttingSlugs: ["codeflex-security", "codeflex-code-craftsmanship"],
      });

      expect(result.action).toBe("created");

      const content = await readFile(join(tempDir, ".agents", "AGENTS.md"), "utf-8");
      expect(content).toContain("`codeflex-security`");
      expect(content).toContain("`codeflex-code-craftsmanship`");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("preserves content before and after managed section on update", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "global-normalizer-"));
    try {
      const agentsDir = join(tempDir, ".agents");
      const agentsPath = join(agentsDir, "AGENTS.md");
      const { mkdir } = await import("node:fs/promises");
      await mkdir(agentsDir, { recursive: true });
      
      const managedSection = generateGlobalManagedSection();
      const content = `# Before\n\n${managedSection}\n\n# After\n`;
      await writeFile(agentsPath, content, "utf-8");

      const staleSection = `${MANAGED_SECTION_START}\n## Stale\n${MANAGED_SECTION_END}`;
      const withStale = `# Before\n\n${staleSection}\n\n# After\n`;
      await writeFile(agentsPath, withStale, "utf-8");

      const result = await normalizeGlobalAgentsMd({ baseDir: tempDir });

      expect(result.action).toBe("updated");

      const fileContent = await readFile(agentsPath, "utf-8");
      expect(fileContent).toContain("# Before");
      expect(fileContent).toContain("# After");
      expect(fileContent).toContain("GLOBAL CODEFLEX ENGINEERING STANDARDS");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe("edge cases", () => {
    it("handles malformed markers (start without end)", async () => {
      const tempDir = await mkdtemp(join(tmpdir(), "global-normalizer-"));
      try {
        const agentsDir = join(tempDir, ".agents");
        const agentsPath = join(agentsDir, "AGENTS.md");
        const { mkdir } = await import("node:fs/promises");
        await mkdir(agentsDir, { recursive: true });

        const content = `# Global\n\n${MANAGED_SECTION_START}\n## Incomplete section\nSome content without end marker.\n`;
        await writeFile(agentsPath, content, "utf-8");

        const result = await normalizeGlobalAgentsMd({ baseDir: tempDir });

        expect(result.action).toBe("updated");

        const fileContent = await readFile(agentsPath, "utf-8");
        expect(fileContent).toContain("GLOBAL CODEFLEX ENGINEERING STANDARDS");
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    it("handles orphaned end marker", async () => {
      const tempDir = await mkdtemp(join(tmpdir(), "global-normalizer-"));
      try {
        const agentsDir = join(tempDir, ".agents");
        const agentsPath = join(agentsDir, "AGENTS.md");
        const { mkdir } = await import("node:fs/promises");
        await mkdir(agentsDir, { recursive: true });

        const content = `# Global\n\nSome content.\n${MANAGED_SECTION_END}\nMore content.\n`;
        await writeFile(agentsPath, content, "utf-8");

        const result = await normalizeGlobalAgentsMd({ baseDir: tempDir });

        expect(result.action).toBe("updated");

        const fileContent = await readFile(agentsPath, "utf-8");
        expect(fileContent).toContain("GLOBAL CODEFLEX ENGINEERING STANDARDS");
        expect(fileContent).toContain("More content.");
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    it("handles inverted marker order (end before start)", async () => {
      const tempDir = await mkdtemp(join(tmpdir(), "global-normalizer-"));
      try {
        const agentsDir = join(tempDir, ".agents");
        const agentsPath = join(agentsDir, "AGENTS.md");
        const { mkdir } = await import("node:fs/promises");
        await mkdir(agentsDir, { recursive: true });

        const content = `# Global\n\n${MANAGED_SECTION_END}\nMiddle.\n${MANAGED_SECTION_START}\n## Section\nContent.\n`;
        await writeFile(agentsPath, content, "utf-8");

        const result = await normalizeGlobalAgentsMd({ baseDir: tempDir });

        expect(result.action).toBe("updated");

        const fileContent = await readFile(agentsPath, "utf-8");
        expect(fileContent).toContain("GLOBAL CODEFLEX ENGINEERING STANDARDS");
        expect(fileContent).toContain("# Global");
        expect(fileContent).toContain("Middle.");
        expect(fileContent).toContain("## Section");
        expect(fileContent).toContain("Content.");
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    it("deduplicates 3+ duplicate sections", async () => {
      const tempDir = await mkdtemp(join(tmpdir(), "global-normalizer-"));
      try {
        const agentsDir = join(tempDir, ".agents");
        const agentsPath = join(agentsDir, "AGENTS.md");
        const { mkdir } = await import("node:fs/promises");
        await mkdir(agentsDir, { recursive: true });

        const managedSection = generateGlobalManagedSection();
        const content = [
          "# Global",
          "",
          managedSection,
          "",
          "Content 1.",
          "",
          managedSection,
          "",
          "Content 2.",
          "",
          managedSection,
          "",
          "Content 3.",
        ].join("\n");
        await writeFile(agentsPath, content, "utf-8");

        const result = await normalizeGlobalAgentsMd({ baseDir: tempDir });

        expect(result.action).toBe("deduplicated");

        const fileContent = await readFile(agentsPath, "utf-8");
        const startCount = (fileContent.match(new RegExp(MANAGED_SECTION_START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
        expect(startCount).toBe(1);
        expect(fileContent).toContain("Content 1.");
        expect(fileContent).toContain("Content 2.");
        expect(fileContent).toContain("Content 3.");
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    it("handles empty file", async () => {
      const tempDir = await mkdtemp(join(tmpdir(), "global-normalizer-"));
      try {
        const agentsDir = join(tempDir, ".agents");
        const agentsPath = join(agentsDir, "AGENTS.md");
        const { mkdir } = await import("node:fs/promises");
        await mkdir(agentsDir, { recursive: true });

        await writeFile(agentsPath, "", "utf-8");

        const result = await normalizeGlobalAgentsMd({ baseDir: tempDir });

        expect(["created", "updated"]).toContain(result.action);

        const fileContent = await readFile(agentsPath, "utf-8");
        expect(fileContent).toContain("GLOBAL CODEFLEX ENGINEERING STANDARDS");
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    it("handles file with only whitespace", async () => {
      const tempDir = await mkdtemp(join(tmpdir(), "global-normalizer-"));
      try {
        const agentsDir = join(tempDir, ".agents");
        const agentsPath = join(agentsDir, "AGENTS.md");
        const { mkdir } = await import("node:fs/promises");
        await mkdir(agentsDir, { recursive: true });

        await writeFile(agentsPath, "   \n\n  \n", "utf-8");

        const result = await normalizeGlobalAgentsMd({ baseDir: tempDir });

        expect(result.action).toBe("updated");

        const fileContent = await readFile(agentsPath, "utf-8");
        expect(fileContent).toContain("GLOBAL CODEFLEX ENGINEERING STANDARDS");
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
  });
});
