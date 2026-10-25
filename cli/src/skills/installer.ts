import { readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import type { ResolvedSkill, StandardsSource, EngineeringLock } from "../types/index";
import { swapDirectory } from "./swap";
import { copyDirectory, ensureDir } from "../utils/fs";
import { errorMessage } from "../utils/errors";
import { codeflexDir, skillsDir } from "../config/index";
import { sha256Directory } from "../utils/hash";
import { SkillDirectoryResolver } from "./skill-directory-resolver";

/** Input parameters for installing resolved skills into the canonical store. */
export interface InstallInput {
  /** Absolute path to the project root. */
  projectRoot: string;
  /** Skills that passed resolution and should be installed. */
  resolvedSkills: ResolvedSkill[];
  /** Available standards sources to copy skills from. */
  sources: StandardsSource[];
  /** Current engineering lockfile (projections not required for installation). */
  lock: Omit<EngineeringLock, "projections" | "managedProjections">;
  /** When true, bypass the content-hash optimization and always copy from source. */
  force?: boolean;
}

/** Result of a skill installation operation. */
export interface InstallResult {
  /** Skill slugs that were newly installed or updated. */
  installed: string[];
  /** Skill slugs that were removed from the canonical store. */
  removed: string[];
  /** Skill slugs that were already up-to-date. */
  unchanged: string[];
  /** Error messages for skills that failed to install. */
  errors: string[];
}

/**
 * Installs resolved skills into the project's canonical store (`.codeflex/skills/`) using an atomic swap.
 *
 * Copies each resolved skill from its source directory into a temp directory, then atomically
 * replaces the target directory. Skills that haven't changed are carried over to avoid deletion.
 * Skills no longer in the resolved set are removed.
 *
 * @param input - Installation parameters including project root, resolved skills, and sources
 * @returns Result detailing which skills were installed, removed, unchanged, or errored
 */
export async function installSkills(input: InstallInput): Promise<InstallResult> {
  const { projectRoot, resolvedSkills, sources, force = false } = input;
  const installed: string[] = [];
  const removed: string[] = [];
  const unchanged: string[] = [];
  const errors: string[] = [];

  const targetDir = skillsDir(projectRoot);
  const tempDir = join(codeflexDir(projectRoot), ".tmp", "skills");

  await ensureDir(tempDir);

  const directoryResolver = new SkillDirectoryResolver();

  try {
    for (const skill of resolvedSkills) {
      let sourceSkillDir: string | undefined = skill.skillDir;
      if (!sourceSkillDir) {
        const source = findSourceForSkill(skill, sources);
        if (!source) {
          errors.push(`Source not found for skill ${skill.slug}`);
          continue;
        }
        sourceSkillDir = await directoryResolver.find(source.skillsDir, skill.id, skill.source);
        if (!sourceSkillDir) {
          errors.push(`Skill directory not found for ${skill.slug} in source ${source.skillsDir}`);
          continue;
        }
      }

      const tempSkillDir = join(tempDir, skill.slug);

      try {
        const destSkillDir = join(targetDir, skill.slug);
        let destExists = false;
        try {
          await stat(destSkillDir);
          destExists = true;
        } catch { /* does not exist */ }

        if (destExists && !force) {
          const [sourceHash, destHash] = await Promise.all([
            sha256Directory(sourceSkillDir),
            sha256Directory(destSkillDir),
          ]);
          if (sourceHash === destHash) {
            // Still needs to be carried over into tempDir since swapDirectory
            // replaces targetDir wholesale; skipping this would silently
            // delete unchanged skills from the canonical store.
            await copyDirectory(destSkillDir, tempSkillDir);
            unchanged.push(skill.slug);
            continue;
          }
        }

        await copyDirectory(sourceSkillDir, tempSkillDir);
        installed.push(skill.slug);
      } catch (err) {
        errors.push(`Failed to install ${skill.slug}: ${errorMessage(err)}`);
      }
    }

    let previousSkills: string[] = [];
    try {
      previousSkills = await readdir(targetDir);
    } catch { /* skip */ }

    await swapDirectory(tempDir, targetDir);

    for (const previousSkill of previousSkills) {
      if (!resolvedSkills.some((s) => s.slug === previousSkill)) {
        removed.push(previousSkill);
      }
    }
  } catch (err) {
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch { /* skip */ }
    throw err;
  }

  return { installed, removed, unchanged, errors };
}

function findSourceForSkill(
  skill: ResolvedSkill,
  sources: StandardsSource[]
): StandardsSource | undefined {
  // Prefer an explicit source id captured at load time (set from the configured
  // client/repository source id), which avoids any need to parse the skill's id/slug string.
  if (skill.sourceId) {
    const bySourceId = sources.find((s) => s.type === skill.source && s.id === skill.sourceId);
    if (bySourceId) return bySourceId;
  }

  const sourcesOfType = sources.filter((s) => s.type === skill.source);
  if (sourcesOfType.length <= 1) {
    return sourcesOfType[0];
  }

  // Multiple sources of the same type but no sourceId to disambiguate (e.g. a skill
  // reconstructed from the lockfile during `sync`, which doesn't retain sourceId).
  // Fall back to the first configured source of that type; this is a known ambiguity
  // for multi-client-source-of-the-same-type projects that predates this fix.
  return sourcesOfType[0];
}


