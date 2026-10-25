import { describe, it, expect, afterEach } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readFileWithLimit, FileSizeLimitError } from "../../../src/utils/fs";

let tempDir: string;

async function createTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "codeflex-safe-read-test-"));
}

describe("readFileWithLimit", () => {
  it("reads a file under the size limit", async () => {
    tempDir = await createTempDir();
    const filePath = join(tempDir, "small.txt");
    await writeFile(filePath, "hello world", "utf-8");

    const content = await readFileWithLimit(filePath, 1024);
    expect(content).toBe("hello world");
  });

  it("reads a file at exactly the size limit", async () => {
    tempDir = await createTempDir();
    const filePath = join(tempDir, "exact.txt");
    const content = "x".repeat(100);
    await writeFile(filePath, content, "utf-8");

    const result = await readFileWithLimit(filePath, 100);
    expect(result).toBe(content);
  });

  it("throws FileSizeLimitError when file exceeds the limit", async () => {
    tempDir = await createTempDir();
    const filePath = join(tempDir, "large.txt");
    await writeFile(filePath, "x".repeat(200), "utf-8");

    await expect(readFileWithLimit(filePath, 100)).rejects.toThrow(FileSizeLimitError);
    await expect(readFileWithLimit(filePath, 100)).rejects.toThrow(/exceeds size limit/);
  });

  it("uses default limit of 1MB when not specified", async () => {
    tempDir = await createTempDir();
    const filePath = join(tempDir, "default.txt");
    await writeFile(filePath, "small content", "utf-8");

    const content = await readFileWithLimit(filePath);
    expect(content).toBe("small content");
  });
});

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
});
