import { describe, it, expect } from "vitest";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
import { withEmptyTempDir } from "../../helpers";
import { ensureAiderReadsAgentsMd, AIDER_CONF_FILENAME } from "../../../src/agents-md/aider-config";

describe("ensureAiderReadsAgentsMd", () => {
  it("creates .aider.conf.yml with read: AGENTS.md when no config exists", async () => {
    await withEmptyTempDir(async (tempDir) => {
      const result = await ensureAiderReadsAgentsMd({ projectRoot: tempDir });

      expect(result.action).toBe("created");

      const content = await readFile(join(tempDir, AIDER_CONF_FILENAME), "utf-8");
      const parsed = parse(content) as { read?: string[] };
      expect(parsed.read).toContain("AGENTS.md");
    });
  });

  it("appends AGENTS.md to an existing read list without dropping other entries", async () => {
    await withEmptyTempDir(async (tempDir) => {
      const confPath = join(tempDir, AIDER_CONF_FILENAME);
      await writeFile(confPath, "read:\n  - CONVENTIONS.md\ndark-mode: true\n", "utf-8");

      const result = await ensureAiderReadsAgentsMd({ projectRoot: tempDir });

      expect(result.action).toBe("updated");

      const content = await readFile(confPath, "utf-8");
      const parsed = parse(content) as { read?: string[]; "dark-mode"?: boolean };
      expect(parsed.read).toContain("CONVENTIONS.md");
      expect(parsed.read).toContain("AGENTS.md");
      expect(parsed["dark-mode"]).toBe(true);
    });
  });

  it("converts a scalar read value into a list before appending AGENTS.md", async () => {
    await withEmptyTempDir(async (tempDir) => {
      const confPath = join(tempDir, AIDER_CONF_FILENAME);
      await writeFile(confPath, "read: CONVENTIONS.md\n", "utf-8");

      const result = await ensureAiderReadsAgentsMd({ projectRoot: tempDir });

      expect(result.action).toBe("updated");

      const content = await readFile(confPath, "utf-8");
      const parsed = parse(content) as { read?: string[] };
      expect(parsed.read).toEqual(["CONVENTIONS.md", "AGENTS.md"]);
    });
  });

  it("is unchanged when AGENTS.md is already listed under read:", async () => {
    await withEmptyTempDir(async (tempDir) => {
      const confPath = join(tempDir, AIDER_CONF_FILENAME);
      await writeFile(confPath, "read:\n  - AGENTS.md\n", "utf-8");

      const result = await ensureAiderReadsAgentsMd({ projectRoot: tempDir });

      expect(result.action).toBe("unchanged");
    });
  });

  it("does not write anything in dry-run mode", async () => {
    await withEmptyTempDir(async (tempDir) => {
      const result = await ensureAiderReadsAgentsMd({ projectRoot: tempDir, dryRun: true });

      expect(result.action).toBe("created");
      await expect(readFile(join(tempDir, AIDER_CONF_FILENAME), "utf-8")).rejects.toThrow();
    });
  });
});
