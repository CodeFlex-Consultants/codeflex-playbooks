import type { AgentHarness, ClientSourceType, CodeFlexSourceType, ReleaseChannel as ReleaseChannelType } from "./enums";

/** Project-level engineering configuration stored in `.codeflex/engineering.yaml`. */
export interface EngineeringConfig {
  /** Configuration schema version. */
  version: number;
  /** Whether to auto-detect technologies on each run. */
  autoDetect: boolean;
  /** Agent harnesses to generate projections for. */
  agentHarnesses: AgentHarness[];
  /** Standards source configuration. */
  standards: {
    /** CodeFlex baseline source settings. */
    codeflex: {
      /** Whether the CodeFlex baseline is enabled. */
      enabled: boolean;
      /** Custom CodeFlex source (overrides default resolution). */
      source?: CodeFlexSource;
    };
    /** Client-mandated standards sources. */
    client?: ClientStandardSource[];
    /** Repository-local standards sources. */
    repository?: RepositoryStandardSource[];
  };
  /** Skill IDs or glob patterns to force-include regardless of detection. */
  include: string[];
  /** Skill IDs or glob patterns to exclude from resolution. */
  exclude: string[];
  /** Map of skill IDs to path-scope patterns for scoped rule generation. */
  scopes: Record<string, string[]>;
  /** Approved rule exceptions with optional expiry. */
  exceptions: RuleException[];
}

/** A client-mandated standards source configuration. */
export interface ClientStandardSource {
  /** Unique identifier for this client source. */
  id: string;
  /** Transport configuration (local path or git repository). */
  source: RepositorySource | GitSource;
}

/** A local filesystem standards source relative to the project. */
export interface RepositorySource {
  type: ClientSourceType.Repository;
  /** Relative path from project root to the standards directory. */
  path: string;
  /** Optional URL for documentation or reference. */
  url?: string;
  /** Optional version or branch reference. */
  ref?: string;
}

/** A remote git standards source. */
export interface GitSource {
  type: ClientSourceType.Git;
  /** Git repository URL. */
  url: string;
  /** Optional subdirectory path within the repository. */
  path?: string;
  /** Optional git ref (branch, tag, or commit) to clone. */
  ref?: string;
}

/** A repository-local standards source configuration. */
export interface RepositoryStandardSource {
  /** Unique identifier for this repository source. */
  id: string;
  /** Relative path from project root to the standards directory. */
  path: string;
}

/** Discriminated union for CodeFlex baseline source transport configuration. */
export type CodeFlexSource =
  | { type: CodeFlexSourceType.Local; path: string }
  | { type: CodeFlexSourceType.Git; url: string; ref?: string; expectedCommit?: string; protectedBranches?: string[]; channel?: ReleaseChannelType }
  | { type: CodeFlexSourceType.Release; url: string; expectedSha256: string; channel?: ReleaseChannelType };

/** An approved exception allowing a specific rule to be bypassed. */
export interface RuleException {
  /** Rule ID to except. */
  rule: string;
  /** Justification for the exception. */
  reason?: string;
  /** Who approved the exception. */
  approvedBy?: string;
  /** Link to approval reference (ticket, ADR, etc.). */
  reference?: string;
  /** ISO 8601 expiry date after which the exception is no longer valid. */
  expires?: string;
}
