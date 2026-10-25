import type { ReleaseChannel as ReleaseChannelType, SkillSource, AgentHarness } from "./enums";

/** Lockfile storing resolved versions, hashes, and projections for deterministic reproducibility. */
export interface EngineeringLock {
  /** Lockfile schema version. */
  version: number;
  /** Locked source metadata. */
  sources: {
    /** Locked CodeFlex baseline source. */
    codeflex?: {
      /** Release label. */
      release: string;
      /** Git commit hash. */
      commit: string;
      /** SHA-256 hash of the skills directory. */
      sha256: string;
      /** Release channel used. */
      channel?: ReleaseChannelType;
    };
    /** Locked client sources. */
    client?: LockedClientSource[];
    /** Locked repository sources. */
    repository?: LockedRepositorySource[];
  };
  /** Ordered list of resolved skill IDs. */
  skills: string[];
  /** Map of skill ID to its source type. */
  skillSources?: Record<string, SkillSource>;
  /** Map of skill ID to content hash for integrity verification. */
  skillHashes?: Record<string, string>;
  /** Map of rule ID to the skill ID that provides the winning override. */
  resolvedOverrides?: Record<string, string>;
  /** Locked projection targets with their associated harnesses. */
  projections?: LockedProjection[];
  /** Map of projection path to managed skill IDs for stale cleanup. */
  managedProjections?: Record<string, string[]>;
  /** Skill IDs that are cross-cutting (apply to every task regardless of technology). */
  crossCuttingSkills?: string[];
  /** Detected technologies with no corresponding skill in the loaded skill set. */
  unmatchedTechnologies?: LockedUnmatchedTechnology[];
}

/** A detected technology locked in the lockfile as having no matching skill. */
export interface LockedUnmatchedTechnology {
  /** Technology name as detected. */
  name: string;
  /** Detected version, if available. */
  version?: string;
  /** Description of what file or pattern triggered the detection. */
  matchedBy: string;
}

/** A locked client source with its content hash. */
export interface LockedClientSource {
  /** Client source identifier. */
  id: string;
  /** Source descriptor (path or URL). */
  source: string;
  /** SHA-256 hash of the source contents. */
  sha256: string;
}

/** A locked repository source with its content hash. */
export interface LockedRepositorySource {
  /** Repository source identifier. */
  id: string;
  /** Relative path from project root. */
  path: string;
  /** SHA-256 hash of the source contents. */
  sha256: string;
}

/** A locked projection target recording which harnesses it serves. */
export interface LockedProjection {
  /** Harnesses that use this projection path. */
  adapters: AgentHarness[];
  /** Relative path from project root to the projection directory. */
  path: string;
}

/** Release artifact metadata from `release-manifest.json`, used for integrity verification. */
export interface ReleaseManifest {
  /** Release version label. */
  release: string;
  /** Git commit hash the release was built from. */
  commit: string;
  /** SHA-256 hash of the release contents. */
  sha256: string;
  /** Git branch the release was built from. */
  branch: string;
  /** CI/CD pipeline metadata. */
  pipeline?: {
    /** Pipeline identifier. */
    id: string;
    /** Pipeline run identifier. */
    runId: string;
    /** URL to the pipeline run. */
    url?: string;
  };
  /** Cryptographic attestation of the release. */
  attestation?: {
    /** Attestation method (e.g. sigstore, in-toto). */
    type: string;
    /** Attestation signature. */
    signature: string;
    /** Whether the attestation has been verified. */
    verified: boolean;
  };
}
