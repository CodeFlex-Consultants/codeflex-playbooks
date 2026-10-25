import { loadConfig, loadLock } from "../config/index";
import { verifyLockfileConsistency } from "../integrity/lockfile-verifier";
import { verifyProjection } from "../integrity/projection-verifier";
import { readCanonicalStore } from "../skills/canonical-store";
import { findMissingSkills, getAllLockedSkills, validateAgentsMd, validateBootstrapFiles } from "./validation-helpers";
import type { EngineeringConfig, EngineeringLock } from "../types/index";

export interface ProjectValidationResults {
  config: EngineeringConfig | null;
  lock: EngineeringLock | null;
  lockfileConsistency: {
    consistent: boolean;
    errors: string[];
    warnings: string[];
  };
  skills: {
    missing: string[];
    extra: string[];
    hashMismatches: Array<{ skillId: string; expected: string; actual: string }>;
  };
  projections: {
    missing: number;
    stale: number;
    unexpected: number;
  };
  agentsMd: {
    exists: boolean;
    isCurrent: boolean;
  };
  bootstrapFiles: Array<{
    harness: string;
    bootstrapFile: string;
    exists: boolean;
    isCurrent: boolean;
    legacyFile?: string;
    legacyExists?: boolean;
  }>;
}

export async function runProjectValidations(projectRoot: string): Promise<ProjectValidationResults> {
  const config = await loadConfig(projectRoot).catch(() => null);
  const lock = await loadLock(projectRoot).catch(() => null);
  const canonicalStore = await readCanonicalStore(projectRoot);

  const lockfileConsistency = { consistent: true, errors: [] as string[], warnings: [] as string[] };
  if (config && lock) {
    const result = await verifyLockfileConsistency(config, lock);
    lockfileConsistency.consistent = result.consistent;
    lockfileConsistency.errors = result.errors;
    lockfileConsistency.warnings = result.warnings;
  }

  const skills = { missing: [] as string[], extra: [] as string[], hashMismatches: [] as Array<{ skillId: string; expected: string; actual: string }> };
  if (lock) {
    const lockedSkills = new Set(getAllLockedSkills(lock));
    const installedSkills = new Set(canonicalStore.keys());

    skills.missing = findMissingSkills(lock, canonicalStore);
    skills.extra = [...installedSkills].filter((id) => !lockedSkills.has(id));

    if (lock.skillHashes) {
      for (const [skillId, expectedHash] of Object.entries(lock.skillHashes)) {
        const skillDir = canonicalStore.get(skillId);
        if (skillDir && skillDir.contentHash !== expectedHash) {
          skills.hashMismatches.push({ skillId, expected: expectedHash, actual: skillDir.contentHash });
        }
      }
    }
  }

  const projections = { missing: 0, stale: 0, unexpected: 0 };
  if (lock) {
    const result = await verifyProjection(projectRoot, lock);
    projections.missing = result.missing.length;
    projections.stale = result.stale.length;
    projections.unexpected = result.unexpected.length;
  }

  const agentsMd = { exists: false, isCurrent: false };
  if (lock) {
    const validation = await validateAgentsMd(projectRoot, lock);
    agentsMd.exists = validation.exists;
    agentsMd.isCurrent = validation.isCurrent;
  }

  const bootstrapFiles: ProjectValidationResults["bootstrapFiles"] = [];
  if (config) {
    const validations = await validateBootstrapFiles(projectRoot, config);
    for (const v of validations) {
      bootstrapFiles.push({
        harness: v.harness,
        bootstrapFile: v.bootstrapFile,
        exists: v.exists,
        isCurrent: v.isCurrent,
        legacyFile: v.legacyFile,
        legacyExists: v.legacyExists,
      });
    }
  }

  return {
    config,
    lock,
    lockfileConsistency,
    skills,
    projections,
    agentsMd,
    bootstrapFiles,
  };
}
