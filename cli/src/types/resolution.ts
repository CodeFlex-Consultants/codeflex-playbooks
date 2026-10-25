import type { SkillSource } from "./enums";
import type { RuleException, EngineeringConfig } from "./config";
import type { DetectionResult } from "./detection";
import type { SkillManifest, CodeFlexYaml } from "./skills";

/** A skill that has passed resolution and is ready for installation. */
export interface ResolvedSkill {
  /** Skill identifier. */
  id: string;
  /**
   * Canonical dash-separated identifier (from SKILL.md `name` frontmatter), used for all
   * filesystem/projection/config purposes. Distinct from `id`, which is the dot-separated
   * codeflex.yaml identifier used only for dependency/override graph resolution.
   */
  slug: string;
  /**
   * Identifier of the configured standards source (client/repository id) this skill was
   * loaded from, when known. Used to disambiguate multiple configured sources of the same
   * type without parsing the skill id/slug string.
   */
  sourceId?: string;
  /** Origin of the skill (codeflex, client, or repository). */
  source: SkillSource;
  /** Path-scope patterns for scoped rule generation. */
  scopes?: string[];
  /** Rule IDs this skill overrides from lower-priority sources. */
  overriddenRules?: string[];
  /**
   * Absolute path to the skill's directory on disk, as loaded. When present, the installer
   * copies from this exact path rather than reconstructing it from the skill ID and source
   * `skillsDir`, which breaks for skills nested under category folders (e.g.
   * `skills/backend/dotnet/` rather than `skills/<id>/`).
   */
  skillDir?: string;
  /**
   * Whether this skill is cross-cutting (applies to every task regardless of technology).
   * Derived from metadata: true when the skill has no `installWhen` conditions and no
   * `appliesWhen.capabilities` restrictions.
   */
  crossCutting?: boolean;
}

/** A detected technology that has no corresponding skill in the loaded skill set. */
export interface UnmatchedTechnology {
  /** Technology name as detected. */
  name: string;
  /** Detected version, if available. */
  version?: string;
  /** Description of what file or pattern triggered the detection. */
  matchedBy: string;
}

/** Complete output of the standards resolution process. */
export interface ResolutionResult {
  /** Skills that passed resolution and should be installed. */
  skills: ResolvedSkill[];
  /** All rule conflicts encountered during resolution. */
  conflicts: ResolutionConflict[];
  /** Conflicts involving non-overridable rules that cannot be silently resolved. */
  nonOverridableConflicts: ResolutionConflict[];
  /** Map of rule ID to the skill ID that won the override. */
  overrides: Record<string, string>;
  /** Active and expired rule exceptions. */
  exceptions: {
    /** Currently active exceptions. */
    active: RuleException[];
    /** Exceptions that have passed their expiry date. */
    expired: RuleException[];
  };
  /** IDs of required skills that could not be found. */
  dependencyWarnings: string[];
  /** Per-skill explanation of why it was included. */
  explanation: ResolutionExplanation[];
  /** Detected technologies with no matching skill in the loaded skill set. */
  unmatchedTechnologies: UnmatchedTechnology[];
}

/** A conflict between two or more skills enforcing the same rule. */
export interface ResolutionConflict {
  /** The contested rule ID. */
  rule: string;
  /** Skill IDs involved in the conflict. */
  sources: string[];
  /** Whether the conflicting rule is marked as non-overridable. */
  nonOverridable: boolean;
  /** Whether the conflict was resolved by precedence rules. */
  resolved: boolean;
  /** Description of how the conflict was resolved, if applicable. */
  resolution?: string;
}

/** Explanation of why a particular skill was included in the resolution. */
export interface ResolutionExplanation {
  /** Skill identifier. */
  skillId: string;
  /** Human-readable reason for inclusion. */
  reason: string;
  /** Description of what conditions were matched. */
  matchedBy: string;
  /** Skill IDs this skill depends on. */
  dependencies: string[];
  /** Rule IDs this skill overrides. */
  overriddenRules: string[];
  /** Path-scope patterns, if any. */
  scope?: string[];
}

/** Input to the standards resolution process. */
export interface ResolutionInput {
  /** Project detection result for matching install conditions. */
  detection: DetectionResult;
  /** Engineering configuration with include/exclude/exceptions. */
  config: EngineeringConfig;
  /** Loaded skills from the CodeFlex baseline. */
  codeflexSkills: LoadedSkill[];
  /** Loaded skills from client sources. */
  clientSkills: LoadedSkill[];
  /** Loaded skills from repository sources. */
  repositorySkills: LoadedSkill[];
}

/** A skill loaded from disk with its parsed manifest and metadata. */
export interface LoadedSkill {
  /** Skill identifier from codeflex.yaml. */
  id: string;
  /**
   * Canonical dash-separated identifier (from SKILL.md `name` frontmatter), used for all
   * filesystem/projection/config purposes. Distinct from `id`, which is the dot-separated
   * codeflex.yaml identifier used only for dependency/override graph resolution.
   */
  slug: string;
  /**
   * Identifier of the configured standards source (client/repository id) this skill was
   * loaded from, when known. Used to disambiguate multiple configured sources of the same
   * type without parsing the skill id/slug string.
   */
  sourceId?: string;
  /** Origin of this skill. */
  source: SkillSource;
  /** Parsed SKILL.md frontmatter. */
  manifest: SkillManifest;
  /** Parsed codeflex.yaml metadata. */
  metadata: CodeFlexYaml;
  /** Absolute path to the skill's directory on disk. */
  skillDir: string;
}
