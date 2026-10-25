import type { SkillSource, OverridePolicy } from "./enums";

/** Parsed content of a skill's `codeflex.yaml` manifest, defining installation and override behaviour. */
export interface CodeFlexYaml {
  /** Unique skill identifier. */
  id: string;
  /** Origin of this skill (codeflex, client, or repository). */
  source: SkillSource;
  /** Whether this skill's rules can be overridden by higher-priority sources. */
  overridePolicy: OverridePolicy;
  /** Rule IDs that cannot be overridden even if override policy allows it. */
  nonOverridableRules?: string[];
  /** Ownership metadata. */
  owner: {
    /** Team responsible for this skill. */
    team: string;
  };
  /** Conditions under which this skill should be installed. */
  installWhen?: {
    /** At least one condition must match for the skill to be installed. */
    any: InstallCondition[];
  };
  /** IDs of other skills that this skill depends on. */
  requires?: string[];
  /** Additional applicability filters beyond install conditions. */
  appliesWhen?: {
    /** File path patterns this skill applies to. */
    paths?: string[];
    /** Project capabilities required for this skill to apply. */
    capabilities?: string[];
  };
  /** Rule IDs enforced by this skill. */
  rules?: string[];
  /** Reference links for further reading. */
  references?: string[];
  /** Script paths bundled with the skill. */
  scripts?: string[];
  /** Review metadata for skill governance. */
  review?: {
    /** ISO date of last review. */
    lastReviewed: string;
    /** Identifier of the reviewer. */
    reviewBy: string;
    /** Additional required reviewers. */
    requiredReviewers?: string[];
  };
  /** Rule IDs that this skill overrides from lower-priority sources. */
  overrides?: string[];
}

/** A condition that determines whether a skill should be installed for a project. */
export interface InstallCondition {
  /** Matches if the project references this package. */
  packageReference?: {
    /** Package name (e.g. npm package, NuGet package). */
    package: string;
    /** Minimum version range. */
    version: string;
  };
  /** Matches if the project contains a file matching this pattern. */
  file?: {
    /** Glob pattern for file matching. */
    pattern: string;
  };
}

/** Frontmatter metadata extracted from a skill's `SKILL.md` file. */
export interface SkillManifest {
  /** Human-readable skill name. */
  name: string;
  /** Skill version string. */
  version?: string;
  /** Short description of what the skill provides. */
  description: string;
}

/** A resolved standards source with its content hash and filesystem location. */
export interface StandardsSource {
  /** Source type (codeflex, client, or repository). */
  type: SkillSource;
  /** Source identifier (e.g. client ID). */
  id?: string;
  /** Release label, if applicable. */
  release?: string;
  /** Git commit hash, if fetched from git. */
  commit?: string;
  /** SHA-256 hash of the source contents. */
  sha256: string;
  /** Absolute path to the skills directory on disk. */
  skillsDir: string;
  /**
   * Absolute path to a disposable temporary directory (e.g. a git clone or
   * extracted release archive) that should be removed once this source is no
   * longer needed. Undefined for sources backed by a persistent path (local
   * filesystem or committed repository directories) that must not be deleted.
   */
  cleanupPath?: string;
}
