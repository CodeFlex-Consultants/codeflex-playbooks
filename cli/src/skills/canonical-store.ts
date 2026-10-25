import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
import { sha256Directory } from "../utils/hash";
import { writeAtomic, ensureDir } from "../utils/fs";
import { skillsDir } from "../config/index";
import { codeflexYamlSchema } from "../types/schemas";
import type { CodeFlexYaml } from "../types/index";
import { BACKUP_SUFFIX } from "../constants";

/** Metadata about a skill directory in the canonical store. */
export interface SkillDirectory {
  /** Skill identifier (directory name). */
  id: string;
  /** Absolute path to the skill directory. */
  dirPath: string;
  /** Sorted list of file names in the skill directory. */
  files: string[];
  /** SHA-256 hash of the directory contents. */
  contentHash: string;
}

/** Content to write into a skill directory in the canonical store. */
export interface SkillContent {
  /** Map of file name to file content. */
  files: Map<string, string>;
}

/**
 * Reads the canonical skill store (`.codeflex/skills/`) and returns metadata for each installed skill.
 *
 * @param projectRoot - Absolute path to the project root
 * @returns Map of skill ID to directory metadata; empty map if the store doesn't exist
 */
export async function readCanonicalStore(
  projectRoot: string
): Promise<Map<string, SkillDirectory>> {
  const storeDir = skillsDir(projectRoot);
  const result = new Map<string, SkillDirectory>();

  let entries: string[];
  try {
    entries = await readdir(storeDir);
  } catch {
    return result;
  }

  for (const entry of entries) {
    if (entry.endsWith(BACKUP_SUFFIX)) continue;

    const skillDir = join(storeDir, entry);

    try {
      const s = await stat(skillDir);
      if (!s.isDirectory()) {
        continue;
      }
    } catch {
      continue;
    }

    const files: string[] = [];

    let skillFiles: string[];
    try {
      skillFiles = (await readdir(skillDir)).sort();
    } catch {
      continue;
    }

    for (const file of skillFiles) {
      const filePath = join(skillDir, file);
      try {
        const s = await stat(filePath);
        if (s.isFile()) {
          files.push(file);
        }
      } catch {
        continue;
      }
    }

    const contentHash = await sha256Directory(skillDir);

    result.set(entry, {
      id: entry,
      dirPath: skillDir,
      files,
      contentHash,
    });
  }

  return result;
}

/**
 * Reads and parses a single skill's `codeflex.yaml` manifest directly from the canonical store
 * (`.codeflex/skills/<slug>/codeflex.yaml`), without requiring the full source-tree skill loader.
 * Used by commands that reconstruct `ResolvedSkill`s from lock-file data (e.g. `sync`) and need
 * metadata — such as `installWhen` conditions, for cross-cutting classification — that isn't
 * itself persisted in the lock file.
 *
 * @param projectRoot - Absolute path to the project root
 * @param slug - Skill slug (canonical store directory name)
 * @returns Parsed `codeflex.yaml` contents, or `undefined` if the skill or manifest is missing or invalid
 */
export async function readCanonicalSkillManifest(
  projectRoot: string,
  slug: string
): Promise<CodeFlexYaml | undefined> {
  if (slug.includes("..") || slug.includes("/") || slug.includes("\\")) {
    return undefined;
  }

  const skillsDirPath = skillsDir(projectRoot);
  const manifestPath = join(skillsDirPath, slug, "codeflex.yaml");
  
  const resolved = (await import("node:path")).resolve(manifestPath);
  const skillsRoot = (await import("node:path")).resolve(skillsDirPath);
  if (!resolved.startsWith(skillsRoot)) {
    return undefined;
  }

  let raw: string;
  try {
    raw = await readFile(manifestPath, "utf-8");
  } catch {
    return undefined;
  }

  const parsed = codeflexYamlSchema.safeParse(parse(raw));
  return parsed.success ? parsed.data : undefined;
}

/**
 * Writes skill content into the canonical store (`.codeflex/skills/`), creating directories as needed.
 *
 * @param projectRoot - Absolute path to the project root
 * @param skills - Map of skill ID to file content to write
 */
export async function writeCanonicalStore(
  projectRoot: string,
  skills: Map<string, SkillContent>
): Promise<void> {
  const storeDir = skillsDir(projectRoot);
  await ensureDir(storeDir);

  for (const [skillId, content] of skills) {
    const skillDir = join(storeDir, skillId);
    await ensureDir(skillDir);

    for (const [fileName, fileContent] of content.files) {
      const filePath = join(skillDir, fileName);
      await writeAtomic(filePath, fileContent);
    }
  }
}
