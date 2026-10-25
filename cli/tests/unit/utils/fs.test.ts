import { describe, it, expect, afterEach } from "vitest";
import { mkdtemp, rm, readFile, stat, writeFile, readdir, chmod, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ensureDir, writeAtomic, safeReadFile, pathExists, copyDirectory } from "../../../src/utils/fs";
import { isWindows } from "../../../src/utils/platform";

let tempDir: string;

async function createTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "codeflex-fs-test-"));
}

describe("ensureDir", () => {
  it("creates nested directories", async () => {
    tempDir = await createTempDir();
    const nested = join(tempDir, "a", "b", "c");
    await ensureDir(nested);
    const s = await stat(nested);
    expect(s.isDirectory()).toBe(true);
  });

  it("does not error if directory already exists", async () => {
    tempDir = await createTempDir();
    await ensureDir(tempDir);
  });
});

describe("writeAtomic", () => {
  it("writes content to file atomically", async () => {
    tempDir = await createTempDir();
    const filePath = join(tempDir, "test.txt");
    await writeAtomic(filePath, "hello world");
    const content = await readFile(filePath, "utf-8");
    expect(content).toBe("hello world");
  });

  it("creates parent directories", async () => {
    tempDir = await createTempDir();
    const filePath = join(tempDir, "sub", "dir", "test.txt");
    await writeAtomic(filePath, "content");
    const content = await readFile(filePath, "utf-8");
    expect(content).toBe("content");
  });

  it("does not leave temp files behind", async () => {
    tempDir = await createTempDir();
    const filePath = join(tempDir, "test.txt");
    await writeAtomic(filePath, "data");
    const files = await readdir(tempDir);
    expect(files).toEqual(["test.txt"]);
  });
});

describe("safeReadFile", () => {
  it("returns file content", async () => {
    tempDir = await createTempDir();
    const filePath = join(tempDir, "test.txt");
    await writeFile(filePath, "content", "utf-8");
    const result = await safeReadFile(filePath);
    expect(result).toBe("content");
  });

  it("returns null for missing file", async () => {
    tempDir = await createTempDir();
    const result = await safeReadFile(join(tempDir, "missing.txt"));
    expect(result).toBeNull();
  });
});

describe("pathExists", () => {
  it("returns true for existing file", async () => {
    tempDir = await createTempDir();
    const filePath = join(tempDir, "test.txt");
    await writeFile(filePath, "x", "utf-8");
    expect(await pathExists(filePath)).toBe(true);
  });

  it("returns false for missing file", async () => {
    tempDir = await createTempDir();
    expect(await pathExists(join(tempDir, "nope.txt"))).toBe(false);
  });

  it("returns true for existing directory", async () => {
    tempDir = await createTempDir();
    expect(await pathExists(tempDir)).toBe(true);
  });
});

describe("copyDirectory", () => {
  it("copies files and preserves content", async () => {
    tempDir = await createTempDir();
    const src = join(tempDir, "src");
    const dest = join(tempDir, "dest");
    await mkdir(src);
    await writeFile(join(src, "file.txt"), "hello", "utf-8");

    await copyDirectory(src, dest);

    const content = await readFile(join(dest, "file.txt"), "utf-8");
    expect(content).toBe("hello");
  });

  it("copies nested directories", async () => {
    tempDir = await createTempDir();
    const src = join(tempDir, "src");
    const dest = join(tempDir, "dest");
    await mkdir(join(src, "sub"), { recursive: true });
    await writeFile(join(src, "sub", "nested.txt"), "nested", "utf-8");

    await copyDirectory(src, dest);

    const content = await readFile(join(dest, "sub", "nested.txt"), "utf-8");
    expect(content).toBe("nested");
  });

  it("preserves file permissions", async () => {
    tempDir = await createTempDir();
    const src = join(tempDir, "src");
    const dest = join(tempDir, "dest");
    await mkdir(src);
    const srcFile = join(src, "script.sh");
    await writeFile(srcFile, "#!/bin/sh\necho hi", "utf-8");
    await chmod(srcFile, 0o755);

    await copyDirectory(src, dest);

    const destStat = await stat(join(dest, "script.sh"));
    if (isWindows) {
      // On Windows, chmod doesn't work the same way, so we just verify the file was copied
      expect(destStat.isFile()).toBe(true);
    } else {
      expect(destStat.mode & 0o777).toBe(0o755);
    }
  });

  it("preserves read-only permissions", async () => {
    tempDir = await createTempDir();
    const src = join(tempDir, "src");
    const dest = join(tempDir, "dest");
    await mkdir(src);
    const srcFile = join(src, "readonly.txt");
    await writeFile(srcFile, "readonly content", "utf-8");
    await chmod(srcFile, 0o444);

    await copyDirectory(src, dest);

    const destStat = await stat(join(dest, "readonly.txt"));
    if (isWindows) {
      // On Windows, chmod doesn't work the same way, so we just verify the file was copied
      expect(destStat.isFile()).toBe(true);
    } else {
      expect(destStat.mode & 0o777).toBe(0o444);
    }
  });
});

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
});
