import type { EngineeringConfig, EngineeringLock } from "../types/index";
import { SkillSource } from "../types/index";

/** Result of verifying lockfile consistency against the current configuration. */
export interface ConsistencyResult {
  /** True if no errors were found (warnings may still exist). */
  consistent: boolean;
  /** Non-fatal inconsistencies (e.g. orphaned entries, missing projections). */
  warnings: string[];
  /** Fatal inconsistencies (e.g. unsupported version, missing hashes). */
  errors: string[];
}

function assertHashPresent(hash: string | undefined, label: string, errors: string[]): void {
  if (!hash || hash.trim() === "") {
    errors.push(`${label} is missing or empty`);
  }
}

/**
 * Verifies that the engineering lockfile is consistent with the current configuration.
 *
 * Checks lockfile version, validates that projections match configured harnesses, verifies
 * source hashes are present, and ensures locked skills align with include/exclude patterns.
 *
 * @param config - Current engineering configuration
 * @param lock - Lockfile to verify against the configuration
 * @returns Consistency result with errors and warnings
 */
export async function verifyLockfileConsistency(
  config: EngineeringConfig,
  lock: EngineeringLock
): Promise<ConsistencyResult> {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (lock.version !== 1) {
    errors.push(`Unsupported lockfile version: ${lock.version}`);
  }

  for (const projection of lock.projections ?? []) {
    for (const adapter of projection.adapters) {
      if (!config.agentHarnesses.includes(adapter)) {
        warnings.push(`Projection adapter ${adapter} not in configured harnesses`);
      }
    }
  }

  if (lock.sources.client) {
    const configClientIds = config.standards.client?.map((c) => c.id) ?? [];
    for (const lockedClient of lock.sources.client) {
      if (!configClientIds.includes(lockedClient.id)) {
        warnings.push(`Locked client source ${lockedClient.id} not in config`);
      }
    }
  }

  if (lock.sources.codeflex) {
    assertHashPresent(lock.sources.codeflex.sha256, "CodeFlex source SHA-256", errors);
    assertHashPresent(lock.sources.codeflex.commit, "CodeFlex source commit hash", errors);
  }

  if (lock.sources.client) {
    for (const lockedClient of lock.sources.client) {
      assertHashPresent(lockedClient.sha256, `Client source '${lockedClient.id}' SHA-256`, errors);
    }
  }

  if (lock.sources.repository) {
    for (const lockedRepo of lock.sources.repository) {
      assertHashPresent(lockedRepo.sha256, `Repository source '${lockedRepo.id}' SHA-256`, errors);
    }
  }

  for (const includePattern of config.include) {
    if (!lock.skills.some((skillId) => matchSkillPattern(includePattern, skillId))) {
      warnings.push(`Configured include pattern '${includePattern}' does not match any locked skill`);
    }
  }

  for (const skillId of lock.skills) {
    if (config.exclude.some((pattern) => matchSkillPattern(pattern, skillId))) {
      warnings.push(`Locked skill '${skillId}' matches a config exclude pattern`);
    }
  }

  if (lock.skillSources) {
    for (const [skillId, source] of Object.entries(lock.skillSources)) {
      if (!lock.skills.includes(skillId)) {
        warnings.push(`skillSources entry '${skillId}' not in locked skills list`);
      }
      if (source === SkillSource.Client && !lock.sources.client?.length) {
        warnings.push(`Skill '${skillId}' marked as client source but no client sources are locked`);
      }
    }

    for (const skillId of lock.skills) {
      if (!lock.skillSources[skillId]) {
        warnings.push(`Locked skill '${skillId}' has no entry in skillSources`);
      }
    }
  }

  const configuredHarnesses = new Set(config.agentHarnesses);
  const lockedHarnesses = new Set< string>();
  for (const projection of lock.projections ?? []) {
    for (const adapter of projection.adapters) {
      lockedHarnesses.add(adapter);
    }
  }
  for (const harness of configuredHarnesses) {
    if (!lockedHarnesses.has(harness)) {
      warnings.push(`Configured harness '${harness}' has no locked projection`);
    }
  }

  return {
    consistent: errors.length === 0,
    warnings,
    errors,
  };
}

function matchSkillPattern(pattern: string, skillId: string): boolean {
  if (pattern === skillId) return true;
  if (pattern.includes("*")) {
    const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
    return regex.test(skillId);
  }
  return false;
}
