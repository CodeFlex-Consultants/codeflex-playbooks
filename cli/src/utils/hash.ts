import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

export async function sha256File(filePath: string): Promise<string> {
  const content = await readFile(filePath);
  return createHash("sha256").update(content).digest("hex");
}

export async function sha256Content(content: string): Promise<string> {
  return createHash("sha256").update(content).digest("hex");
}

export async function sha256Directory(dirPath: string): Promise<string> {
  const hash = createHash("sha256");
  await hashDirectoryContents(dirPath, hash, "");
  return hash.digest("hex");
}

async function hashDirectoryContents(
  dirPath: string,
  hash: ReturnType<typeof createHash>,
  relativePath: string
): Promise<void> {
  const entries = await readdir(dirPath);
  const sorted = entries.sort();

  for (const entry of sorted) {
    const fullPath = join(dirPath, entry);
    const entryRelative = relativePath.length === 0 ? entry : `${relativePath}/${entry}`;
    const entryStat = await stat(fullPath);

    if (entryStat.isDirectory()) {
      await hashDirectoryContents(fullPath, hash, entryRelative);
    } else if (entryStat.isFile()) {
      const content = await readFile(fullPath);
      hash.update(`${entryRelative}\0${content.byteLength}\0`);
      hash.update(content);
    }
  }
}
