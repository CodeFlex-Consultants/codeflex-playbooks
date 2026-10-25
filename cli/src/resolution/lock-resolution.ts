import type { LoadedSkill, ResolutionResult, EngineeringLock, ResolutionExplanation } from "../types/index";

export function buildResolutionFromLock(lock: EngineeringLock, allSkills: LoadedSkill[]): ResolutionResult {
  const lockedSkillIds = new Set(lock.skills);

  const resolvedSkills = allSkills
    .filter(s => lockedSkillIds.has(s.slug))
    .map(s => ({
      id: s.id,
      slug: s.slug,
      source: s.source,
      scopes: undefined as string[] | undefined,
      overriddenRules: s.metadata.overrides,
    }));

  const explanation: ResolutionExplanation[] = resolvedSkills.map(s => ({
    skillId: s.slug,
    reason: "Installed (from lockfile)",
    matchedBy: "lockfile",
    dependencies: [],
    overriddenRules: s.overriddenRules ?? [],
  }));

  return {
    skills: resolvedSkills,
    conflicts: [],
    nonOverridableConflicts: [],
    overrides: lock.resolvedOverrides ?? {},
    exceptions: { active: [], expired: [] },
    dependencyWarnings: [],
    explanation,
    unmatchedTechnologies: [],
  };
}

export const LOCK_RESOLUTION_NOTE = "Lock-based resolution does not include conflict/exception data. Use --force for accurate conflict/exception information.";
