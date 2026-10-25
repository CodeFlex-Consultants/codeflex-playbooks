import { writeAtomic, safeReadFile, ensureDir } from "../utils/fs";
import { dirname } from "node:path";

export interface NormalizeFileOptions {
  filePath: string;
  managedSection: string;
  dryRun: boolean;
  ensureParentDir?: boolean;
}

export interface NormalizeFileResult {
  action: "created" | "updated" | "unchanged" | "deduplicated";
  path: string;
  previousContent?: string;
  newContent?: string;
}

interface Normalizer {
  normalize: (content: string, managedSection: string) => {
    action: "updated" | "unchanged" | "deduplicated";
    result: string;
  };
}

export async function normalizeFileContent(
  options: NormalizeFileOptions,
  normalizer: Normalizer,
): Promise<NormalizeFileResult> {
  const { filePath, managedSection, dryRun, ensureParentDir } = options;
  const content = await safeReadFile(filePath) ?? undefined;

  if (!content) {
    const newContent = managedSection + "\n";

    if (!dryRun) {
      if (ensureParentDir) {
        await ensureDir(dirname(filePath));
      }
      await writeAtomic(filePath, newContent);
    }

    return {
      action: "created",
      path: filePath,
      newContent,
    };
  }

  const normalized = normalizer.normalize(content, managedSection);

  if (normalized.action === "unchanged") {
    return {
      action: "unchanged",
      path: filePath,
      previousContent: content,
    };
  }

  if (!dryRun) {
    await writeAtomic(filePath, normalized.result);
  }

  return {
    action: normalized.action,
    path: filePath,
    previousContent: content,
    newContent: normalized.result,
  };
}
