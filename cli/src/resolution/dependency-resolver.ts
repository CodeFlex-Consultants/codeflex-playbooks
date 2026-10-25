import type { LoadedSkill, DetectionResult } from "../types/index";
import { matchesInstallConditions } from "./install-matcher";

export interface DependencyResult {
  added: string[];
  missing: string[];
}

export function resolveDependencies(
  skills: LoadedSkill[],
  resolved: Set<string>,
  detection: DetectionResult,
  excluded: string[] = []
): DependencyResult {
  const added: string[] = [];
  const missing: string[] = [];
  const allSkills = new Map(skills.map((s) => [s.id, s]));
  // Build a set of excluded identifiers (both IDs and slugs) for efficient lookup
  const excludedIds = new Set<string>();
  for (const skill of skills) {
    if (excluded.includes(skill.id) || excluded.includes(skill.slug)) {
      excludedIds.add(skill.id);
    }
  }

  const queue: string[] = [...resolved];
  const processed = new Set<string>();

  while (queue.length > 0) {
    const skillId = queue.shift()!;

    if (processed.has(skillId)) {
      continue;
    }
    processed.add(skillId);

    const skill = allSkills.get(skillId);
    if (!skill) continue;

    const requires = skill.metadata.requires ?? [];

    for (const depId of requires) {
      if (resolved.has(depId)) {
        continue;
      }

      // A skill explicitly excluded via config must never be reintroduced as a
      // transitive dependency of another resolved skill. Treat it the same way
      // as a dependency that could not be found: report it and leave it out of
      // the resolved set, rather than silently overriding the exclusion.
      if (excludedIds.has(depId)) {
        if (!missing.includes(depId)) {
          missing.push(depId);
        }
        continue;
      }

      const depSkill = allSkills.get(depId);
      if (!depSkill) {
        if (!missing.includes(depId)) {
          missing.push(depId);
        }
        continue;
      }

      const conditions = depSkill.metadata.installWhen?.any ?? [];
      if (conditions.length === 0 || matchesInstallConditions(conditions, detection)) {
        resolved.add(depId);
        added.push(depId);
        queue.push(depId);
      } else {
        if (!missing.includes(depId)) {
          missing.push(depId);
        }
      }
    }
  }

  return { added, missing };
}
