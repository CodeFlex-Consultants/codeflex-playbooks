import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { pathExists } from "../utils/fs";
import { generateManagedSection } from "../agents-md/section-generator";
import { isManagedSectionCurrent } from "../agents-md/normalizer";
import { HARNESS_REGISTRY } from "../projection/registry";
import { BOOTSTRAP_REGISTRY } from "../agents-md/bootstrap-registry";
import { AGENTS_MD_FILENAME } from "../constants";
import type { EngineeringConfig, EngineeringLock } from "../types/index";
import { AgentHarness } from "../types/enums";
import type { SkillDirectory } from "../skills/canonical-store";

export interface AgentsMdValidation {
  exists: boolean;
  isCurrent: boolean;
}

export async function validateAgentsMd(
  projectRoot: string,
  lock: EngineeringLock,
): Promise<AgentsMdValidation> {
  const agentsMdPath = join(projectRoot, AGENTS_MD_FILENAME);
  const exists = await pathExists(agentsMdPath);

  if (!exists) {
    return { exists: false, isCurrent: false };
  }

  const content = await readFile(agentsMdPath, "utf-8");
  const expectedSection = generateManagedSection(lock.skills, lock.crossCuttingSkills);
  const isCurrent = isManagedSectionCurrent(content, expectedSection);

  return { exists, isCurrent };
}

export interface BootstrapFileValidation {
  harness: AgentHarness;
  bootstrapFile: string;
  exists: boolean;
  isCurrent: boolean;
  legacyFile?: string;
  legacyExists?: boolean;
}

export async function validateBootstrapFiles(
  projectRoot: string,
  config: EngineeringConfig,
): Promise<BootstrapFileValidation[]> {
  const validations = config.agentHarnesses.map(async (harness) => {
    const capability = HARNESS_REGISTRY[harness];
    if (!capability || capability.bootstrapFile === AGENTS_MD_FILENAME) return null;

    const bootstrapPath = join(projectRoot, capability.bootstrapFile);
    const exists = await pathExists(bootstrapPath);

    let isCurrent = false;
    if (exists) {
      const content = await readFile(bootstrapPath, "utf-8");
      const bootstrapConfig = BOOTSTRAP_REGISTRY.find((b) => b.harness === harness);
      isCurrent = bootstrapConfig ? content.includes(bootstrapConfig.marker) : false;
    }

    const legacyFiles = capability.legacyBootstrapFiles ?? [];
    let legacyFile: string | undefined;
    let legacyExists: boolean | undefined;

    for (const lf of legacyFiles) {
      const legacyPath = join(projectRoot, lf);
      if (await pathExists(legacyPath)) {
        legacyFile = lf;
        legacyExists = true;
        break;
      }
    }

    return {
      harness,
      bootstrapFile: capability.bootstrapFile,
      exists,
      isCurrent,
      legacyFile,
      legacyExists,
    };
  });

  const results = await Promise.all(validations);
  return results.filter((r) => r !== null) as BootstrapFileValidation[];
}

export function getAllLockedSkills(lock: EngineeringLock): string[] {
  return [...lock.skills, ...(lock.crossCuttingSkills ?? [])];
}

export function findMissingSkills(
  lock: EngineeringLock,
  canonicalStore: Map<string, SkillDirectory>,
): string[] {
  const installedSkills = new Set(canonicalStore.keys());
  return getAllLockedSkills(lock).filter((skillId) => !installedSkills.has(skillId));
}
