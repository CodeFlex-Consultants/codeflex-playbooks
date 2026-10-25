import { describe, it, expect } from "vitest";
import { mkdtemp, rm, mkdir, writeFile, readFile, readdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { swapDirectory } from "../../../src/skills/swap";

describe("swapDirectory", () => {
  it("swaps temp to target when target does not exist", async () => {
    const base = await mkdtemp(join(tmpdir(), "swap-dedicated-"));
    const tempDir = join(base, "temp");
    const targetDir = join(base, "target");

    try {
      await mkdir(tempDir);
      await writeFile(join(tempDir, "file.txt"), "content", "utf-8");

      await swapDirectory(tempDir, targetDir);

      const content = await readFile(join(targetDir, "file.txt"), "utf-8");
      expect(content).toBe("content");

      const tempExists = await stat(tempDir).then(() => true, () => false);
      expect(tempExists).toBe(false);
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it("replaces existing target with temp contents", async () => {
    const base = await mkdtemp(join(tmpdir(), "swap-dedicated-"));
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
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it("restores target from backup when rename temp to target fails", async () => {
    const base = await mkdtemp(join(tmpdir(), "swap-dedicated-"));
    const tempDir = join(base, "nonexistent-temp");
    const targetDir = join(base, "target");

    try {
      await mkdir(targetDir);
      await writeFile(join(targetDir, "original.txt"), "original", "utf-8");

      try {
        await swapDirectory(tempDir, targetDir);
      } catch {
        // expected
      }

      const content = await readFile(join(targetDir, "original.txt"), "utf-8");
      expect(content).toBe("original");
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it("leaves no backup directory after successful swap", async () => {
    const base = await mkdtemp(join(tmpdir(), "swap-dedicated-"));
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

  it("preserves multiple files in temp directory", async () => {
    const base = await mkdtemp(join(tmpdir(), "swap-dedicated-"));
    const tempDir = join(base, "temp");
    const targetDir = join(base, "target");

    try {
      await mkdir(tempDir);
      await writeFile(join(tempDir, "a.txt"), "aaa", "utf-8");
      await writeFile(join(tempDir, "b.txt"), "bbb", "utf-8");
      await mkdir(join(tempDir, "subdir"));
      await writeFile(join(tempDir, "subdir", "c.txt"), "ccc", "utf-8");

      await swapDirectory(tempDir, targetDir);

      expect(await readFile(join(targetDir, "a.txt"), "utf-8")).toBe("aaa");
      expect(await readFile(join(targetDir, "b.txt"), "utf-8")).toBe("bbb");
      expect(await readFile(join(targetDir, "subdir", "c.txt"), "utf-8")).toBe("ccc");
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it("throws when temp directory does not exist and no target to restore", async () => {
    const base = await mkdtemp(join(tmpdir(), "swap-dedicated-"));
    const tempDir = join(base, "nonexistent-temp");
    const targetDir = join(base, "nonexistent-target");

    try {
      await expect(swapDirectory(tempDir, targetDir)).rejects.toThrow();
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });
});
