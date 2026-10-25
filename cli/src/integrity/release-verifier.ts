import { stat } from "node:fs/promises";
import type { StandardsSource, EngineeringLock, ReleaseManifest } from "../types/index";
import { sha256Directory } from "../utils/hash";
import { releaseManifestSchema } from "../types/schemas";
import { errorMessage, IntegrityError } from "../utils/errors";
import { SkillDirectoryResolver } from "../skills/skill-directory-resolver";
import { formatZodIssues } from "../utils/yaml";

/** Result of verifying a trusted release against the lockfile. */
export interface IntegrityResult {
  /** True if all integrity checks passed. */
  valid: boolean;
  /** List of integrity violations found. */
  errors: string[];
}

export interface PipelineVerificationOptions {
  approvedPipelineIds?: string[];
}

/**
 * Verifies that a fetched standards source matches the expected lockfile and optional release manifest.
 *
 * Checks release/commit/SHA-256 consistency against the lockfile, validates the release manifest
 * schema and attestation, optionally verifies the pipeline ID, and verifies per-skill content hashes.
 *
 * @param source - The fetched standards source to verify
 * @param expectedLock - The lockfile containing expected hashes and metadata
 * @param manifest - Optional release manifest from the artifact
 * @param pipelineOptions - Optional pipeline verification constraints
 * @returns Integrity result indicating whether the source is trusted
 */
export async function verifyTrustedRelease(
  source: StandardsSource,
  expectedLock: EngineeringLock,
  manifest?: ReleaseManifest,
  pipelineOptions?: PipelineVerificationOptions
): Promise<IntegrityResult> {
  const errors: string[] = [];

  if (expectedLock.sources.codeflex) {
    if (source.release !== expectedLock.sources.codeflex.release) {
      errors.push(`Release mismatch: expected ${expectedLock.sources.codeflex.release}, got ${source.release}`);
    }
    if (source.commit !== expectedLock.sources.codeflex.commit) {
      errors.push(`Commit mismatch: expected ${expectedLock.sources.codeflex.commit}, got ${source.commit}`);
    }
    if (source.sha256 !== expectedLock.sources.codeflex.sha256) {
      errors.push(`SHA-256 mismatch: expected ${expectedLock.sources.codeflex.sha256}, got ${source.sha256}`);
    }
  }

  if (manifest) {
    const manifestResult = releaseManifestSchema.safeParse(manifest);
    if (!manifestResult.success) {
      errors.push(`Invalid release manifest schema: ${formatZodIssues(manifestResult.error)}`);
    } else {
      const parsedManifest = manifestResult.data;

      if (parsedManifest.attestation && !parsedManifest.attestation.verified) {
        errors.push(`Release attestation is not verified (type: ${parsedManifest.attestation.type})`);
      }

      if (parsedManifest.pipeline && pipelineOptions?.approvedPipelineIds?.length) {
        if (!pipelineOptions.approvedPipelineIds.includes(parsedManifest.pipeline.id)) {
          errors.push(`Pipeline '${parsedManifest.pipeline.id}' is not in the approved pipeline list`);
        }
      }
    }
  }

  const directoryResolver = new SkillDirectoryResolver();

  for (const skillId of expectedLock.skills) {
    const skillDir = await directoryResolver.find(source.skillsDir, skillId, source.type);
    if (!skillDir) {
      errors.push(`Skill ${skillId} not found or unreadable`);
      continue;
    }

    let dirStat;
    try {
      dirStat = await stat(skillDir);
    } catch (err) {
      errors.push(`Skill ${skillId} not found or unreadable: ${errorMessage(err)}`);
      continue;
    }

    if (!dirStat.isDirectory()) {
      errors.push(`Skill ${skillId} is not a directory`);
      continue;
    }

    const computedHash = await sha256Directory(skillDir);

    if (expectedLock.skillHashes && expectedLock.skillHashes[skillId]) {
      const expectedHash = expectedLock.skillHashes[skillId];
      if (computedHash !== expectedHash) {
        errors.push(`Skill ${skillId} hash mismatch: expected ${expectedHash}, got ${computedHash}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export async function assertCodeFlexIntegrity(
  codeflexSource: StandardsSource,
  expectedLock: EngineeringLock,
): Promise<void> {
  const result = await verifyTrustedRelease(codeflexSource, expectedLock);
  if (!result.valid) {
    const detail = result.errors.map((e) => `  - ${e}`).join("\n");
    throw new IntegrityError(
      "Integrity verification failed. The locked standards may have been tampered with.",
      detail,
    );
  }
}
