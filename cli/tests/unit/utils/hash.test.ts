import { describe, it, expect } from "vitest";
import { writeFile, mkdtemp, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { sha256File, sha256Content, sha256Directory } from "../../../src/utils/hash";

describe("sha256Content", () => {
  it("returns correct hash for empty string", async () => {
    const hash = await sha256Content("");
    expect(hash).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });

  it("returns correct hash for known input", async () => {
    const hash = await sha256Content("hello");
    expect(hash).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  });
});

describe("sha256File", () => {
  it("returns correct hash for file content", async () => {
    const dir = await mkdtemp(join(tmpdir(), "codeflex-test-"));
    try {
      const filePath = join(dir, "test.txt");
      await writeFile(filePath, "hello", "utf-8");
      const hash = await sha256File(filePath);
      expect(hash).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("sha256Directory", () => {
  it("returns consistent hash for same directory contents", async () => {
    const dir = await mkdtemp(join(tmpdir(), "codeflex-hashdir-test-"));
    try {
      await writeFile(join(dir, "a.txt"), "alpha", "utf-8");
      await writeFile(join(dir, "b.txt"), "beta", "utf-8");

      const hash1 = await sha256Directory(dir);
      const hash2 = await sha256Directory(dir);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns different hash when content changes", async () => {
    const dir = await mkdtemp(join(tmpdir(), "codeflex-hashdir-test-"));
    try {
      await writeFile(join(dir, "file.txt"), "version1", "utf-8");
      const hash1 = await sha256Directory(dir);

      await writeFile(join(dir, "file.txt"), "version2", "utf-8");
      const hash2 = await sha256Directory(dir);

      expect(hash1).not.toBe(hash2);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("includes nested directory contents", async () => {
    const dir = await mkdtemp(join(tmpdir(), "codeflex-hashdir-test-"));
    try {
      await mkdir(join(dir, "sub"));
      await writeFile(join(dir, "sub", "nested.txt"), "nested-content", "utf-8");

      const hash = await sha256Directory(dir);
      expect(hash).toHaveLength(64);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("produces different hashes for ambiguous path/content boundaries", async () => {
    const dir1 = await mkdtemp(join(tmpdir(), "codeflex-hashdir-collision-"));
    const dir2 = await mkdtemp(join(tmpdir(), "codeflex-hashdir-collision-"));
    try {
      await writeFile(join(dir1, "ab"), "cd", "utf-8");
      await writeFile(join(dir2, "a"), "bcd", "utf-8");

      const hash1 = await sha256Directory(dir1);
      const hash2 = await sha256Directory(dir2);
      expect(hash1).not.toBe(hash2);
    } finally {
      await rm(dir1, { recursive: true, force: true });
      await rm(dir2, { recursive: true, force: true });
    }
  });
});
