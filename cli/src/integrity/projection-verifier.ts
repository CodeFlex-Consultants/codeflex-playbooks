import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { EngineeringLock } from "../types/index";
import { sha256Directory } from "../utils/hash";
import { expandHomePath } from "../utils/fs";
import { skillsDir } from "../config/index";

/** Result of verifying that harness projections match the canonical store. */
export interface ProjectionVerification {
  /** True if all projections are in sync with no stale, missing, or unexpected entries. */
  inSync: boolean;
  /** Projections where the content hash doesn't match the canonical store. */
  stale: StaleProjection[];
  /** Expected projections that don't exist on disk. */
  missing: MissingProjection[];
  /** Managed projection entries on disk that aren't in the locked skill set. */
  unexpected: string[];
}

/** A projection that exists on disk but has diverged from the canonical store. */
export interface StaleProjection {
  /** Harness adapters that use this projection path. */
  adapters: string[];
  /** Relative path to the projection directory. */
  path: string;
  /** Skill ID that is stale. */
  skill: string;
  /** Whether the content differs or the hash computation failed. */
  reason: "content_mismatch" | "hash_mismatch";
}

/** A projection that should exist on disk but is missing. */
export interface MissingProjection {
  /** Harness adapters that use this projection path. */
  adapters: string[];
  /** Relative path to the projection directory. */
  path: string;
  /** Skill ID that is missing. */
  skill: string;
}

/**
 * Verifies that harness projection directories match the canonical skill store.
 *
 * Compares content hashes between `.codeflex/skills/<id>` and each projection target,
 * and detects unexpected managed entries not in the locked skill set.
 *
 * @param projectRoot - Absolute path to the project root
 * @param lock - Engineering lockfile containing expected projections and skills
 * @returns Verification result with stale, missing, and unexpected entries
 */
export async function verifyProjection(
  projectRoot: string,
  lock: EngineeringLock
): Promise<ProjectionVerification> {
  const stale: StaleProjection[] = [];
  const missing: MissingProjection[] = [];
  const unexpected: string[] = [];

  const allSkillIds = [...lock.skills];
  const canonicalBase = skillsDir(projectRoot);

  for (const projection of lock.projections ?? []) {
    const projectionDir = expandHomePath(projection.path, projectRoot);

    for (const skillId of allSkillIds) {
      const projectedDir = join(projectionDir, skillId);
      const canonicalDir = join(canonicalBase, skillId);

      let projectedExists = false;
      try {
        const s = await stat(projectedDir);
        projectedExists = s.isDirectory();
      } catch {
      }

      if (!projectedExists) {
        missing.push({
          adapters: projection.adapters,
          path: projection.path,
          skill: skillId,
        });
        continue;
      }

      try {
        const [canonicalHash, projectedHash] = await Promise.all([
          sha256Directory(canonicalDir),
          sha256Directory(projectedDir),
        ]);

        if (canonicalHash !== projectedHash) {
          stale.push({
            adapters: projection.adapters,
            path: projection.path,
            skill: skillId,
            reason: "content_mismatch",
          });
        }
      } catch {
        stale.push({
          adapters: projection.adapters,
          path: projection.path,
          skill: skillId,
          reason: "hash_mismatch",
        });
      }
    }

    try {
      const entries = await readdir(projectionDir);
      const managedIds = lock.managedProjections?.[projection.path];
      for (const entry of entries) {
        const isManaged = managedIds
          ? managedIds.includes(entry)
          : entry.startsWith("codeflex-") || entry.startsWith("client-") || entry.startsWith("repo-");

        if (isManaged && !allSkillIds.includes(entry)) {
          unexpected.push(join(projection.path, entry));
        }
      }
    } catch {
    }
  }

  return {
    inSync: stale.length === 0 && missing.length === 0 && unexpected.length === 0,
    stale,
    missing,
    unexpected,
  };
}
