import type { LoadedSkill, ResolutionConflict } from "../types/index";
import { OverridePolicy, SkillSource } from "../types/index";

export interface OverrideResult {
  overrides: Map<string, string>;
  conflicts: ResolutionConflict[];
}

function isRuleNonOverridable(skill: LoadedSkill, rule: string): boolean {
  return skill.metadata.overridePolicy === OverridePolicy.Required ||
    (skill.metadata.nonOverridableRules?.includes(rule) ?? false);
}

function sourceTier(skill: LoadedSkill, rule: string): number {
  if (skill.source === SkillSource.CodeFlex && isRuleNonOverridable(skill, rule)) return 1;
  if (skill.source === SkillSource.Client) return 2;
  if (skill.source === SkillSource.Repository) return 3;
  return 4;
}

export function resolveOverrides(
  skills: LoadedSkill[]
): OverrideResult {
  const overrides = new Map<string, string>();
  const conflicts: ResolutionConflict[] = [];

  const ruleToSkills = new Map<string, LoadedSkill[]>();

  for (const skill of skills) {
    const rules = skill.metadata.rules ?? [];
    for (const rule of rules) {
      const existing = ruleToSkills.get(rule) ?? [];
      existing.push(skill);
      ruleToSkills.set(rule, existing);
    }
  }

  for (const [rule, skillList] of ruleToSkills) {
    if (skillList.length <= 1) {
      continue;
    }

    const minTier = Math.min(...skillList.map((s) => sourceTier(s, rule)));
    const topSkills = skillList.filter((s) => sourceTier(s, rule) === minTier);

    if (topSkills.length === 1) {
      overrides.set(rule, topSkills[0]!.id);
      continue;
    }

    const overridingSkill = topSkills.find((s) =>
      s.metadata.overrides?.includes(rule)
    );

    if (overridingSkill) {
      overrides.set(rule, overridingSkill.id);
      continue;
    }

    const nonOverridableTop = topSkills.filter(
      (s) => isRuleNonOverridable(s, rule)
    );

    if (nonOverridableTop.length === 1) {
      overrides.set(rule, nonOverridableTop[0]!.id);
      continue;
    }

    if (nonOverridableTop.length > 1) {
      conflicts.push({
        rule,
        sources: nonOverridableTop.map((s) => s.id),
        nonOverridable: true,
        resolved: false,
      });
      continue;
    }

    conflicts.push({
      rule,
      sources: topSkills.map((s) => s.id),
      nonOverridable: false,
      resolved: false,
    });
  }

  return { overrides, conflicts };
}
