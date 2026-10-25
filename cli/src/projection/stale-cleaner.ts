import { readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { errorMessage } from "../utils/errors";
import { expandHomePath, pathExists } from "../utils/fs";

/** Input parameters for cleaning stale skill projections. */
export interface CleanStaleInput {
  /** Absolute path to the project root. */
  projectRoot: string;
  /** Relative paths to projection directories to scan. */
  projectionPaths: string[];
  /** Currently resolved skill IDs that should be kept. */
  currentSkills: string[];
  /** Known client skill IDs for managed-entry detection. */
  clientSkillIds?: string[];
  /** Previously recorded managed projection entries from the lockfile. */
  previousManagedProjections?: Record<string, string[]>;
}

/** Result of a stale projection cleanup operation. */
export interface CleanStaleResult {
  /** Relative paths of removed stale entries. */
  removed: string[];
  /** Error messages for entries that failed to clean. */
  errors: string[];
}

/**
 * Removes stale skill directories from projection targets that are no longer in the resolved skill set.
 *
 * An entry is considered managed (and eligible for removal) if it appears in `previousManagedProjections`,
 * starts with `codeflex-`, or matches a known client skill ID.
 *
 * @param input - Cleanup parameters including current skills and projection paths
 * @returns Result listing removed paths and any errors
 */
export async function cleanStaleProjections(input: CleanStaleInput): Promise<CleanStaleResult> {
  const { projectRoot, projectionPaths, currentSkills, clientSkillIds = [], previousManagedProjections } = input;
  const removed: string[] = [];
  const errors: string[] = [];

  for (const projectionPath of projectionPaths) {
    const projectionDir = expandHomePath(projectionPath, projectRoot);

    if (!(await pathExists(projectionDir))) {
      continue;
    }

    try {
      const entries = await readdir(projectionDir);
      const managedIds = previousManagedProjections?.[projectionPath];

      for (const entry of entries) {
        const entryPath = join(projectionDir, entry);

        try {
          const s = await stat(entryPath);

          if (s.isDirectory()) {
            const isManaged = managedIds
              ? managedIds.includes(entry)
              : entry.startsWith("codeflex-") || clientSkillIds.includes(entry);

            if (isManaged && !currentSkills.includes(entry)) {
              await rm(entryPath, { recursive: true, force: true });
              removed.push(`${projectionPath}/${entry}`);
            }
          }
        } catch (err) {
          errors.push(`Failed to check ${entryPath}: ${errorMessage(err)}`);
        }
      }
    } catch (err) {
      errors.push(`Failed to read ${projectionDir}: ${errorMessage(err)}`);
    }
  }

  return { removed, errors };
}
