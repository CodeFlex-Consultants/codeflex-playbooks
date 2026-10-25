import { fetchCodeFlexSource, fetchClientSource, fetchRepositorySource } from "./source-fetcher";
import type { StandardsSource, EngineeringLock, EngineeringConfig, CodeFlexSource } from "../types/index";
import { SkillSource, CodeFlexSourceType } from "../types/index";
import { wrapSourceFetchError } from "../utils/errors";

export function buildSourcesFromCanonical(canonicalDir: string, lock: EngineeringLock): StandardsSource[] {
  const sources: StandardsSource[] = [
    {
      type: SkillSource.CodeFlex,
      release: lock.sources.codeflex?.release ?? "local",
      commit: lock.sources.codeflex?.commit ?? "local",
      sha256: lock.sources.codeflex?.sha256 ?? "local",
      skillsDir: canonicalDir,
    },
  ];

  if (lock.sources.client && lock.sources.client.length > 0) {
    for (const lockedClient of lock.sources.client) {
      sources.push({
        type: SkillSource.Client,
        id: lockedClient.id,
        sha256: lockedClient.sha256,
        skillsDir: canonicalDir,
      });
    }
  }

  if (lock.sources.repository && lock.sources.repository.length > 0) {
    for (const lockedRepo of lock.sources.repository) {
      sources.push({
        type: SkillSource.Repository,
        id: lockedRepo.id,
        sha256: lockedRepo.sha256,
        skillsDir: lockedRepo.path,
      });
    }
  }

  return sources;
}

export async function reFetchSources(
  config: EngineeringConfig,
  lock: EngineeringLock,
  projectRoot: string,
): Promise<StandardsSource[]> {
  const sources: StandardsSource[] = [];
  const lockCodeFlex = lock.sources.codeflex;

  const codeflexConfig = config.standards.codeflex.source;
  if (codeflexConfig) {
    let merged: CodeFlexSource;
    if (codeflexConfig.type === CodeFlexSourceType.Git && lockCodeFlex) {
      merged = { ...codeflexConfig, expectedCommit: lockCodeFlex.commit };
    } else if (codeflexConfig.type === CodeFlexSourceType.Release && lockCodeFlex) {
      merged = { ...codeflexConfig, expectedSha256: lockCodeFlex.sha256 };
    } else {
      merged = codeflexConfig;
    }
    const codeflexResult = await fetchCodeFlexSource(merged, lockCodeFlex?.release, lockCodeFlex?.channel);
    sources.push(codeflexResult.source);
  } else {
    try {
      const codeflexResult = await fetchCodeFlexSource(undefined, lockCodeFlex?.release, lockCodeFlex?.channel, lockCodeFlex?.commit);
      sources.push(codeflexResult.source);
    } catch (err) {
      wrapSourceFetchError(
        err,
        "Failed to re-fetch codeflex source",
        "The original source is unavailable and skills are missing from the canonical store",
      );
    }
  }

  if (lock.sources.client && lock.sources.client.length > 0 && config.standards.client) {
    for (const lockedClient of lock.sources.client) {
      const clientConfig = config.standards.client.find((c) => c.id === lockedClient.id);
      if (clientConfig) {
        try {
          const clientSource = await fetchClientSource({ source: clientConfig, projectRoot });
          sources.push(clientSource);
        } catch (err) {
          wrapSourceFetchError(
            err,
            `Failed to re-fetch client source '${lockedClient.id}'`,
            "The original client source is unavailable and skills are missing from the canonical store",
          );
        }
      }
    }
  }

  if (lock.sources.repository && lock.sources.repository.length > 0 && config.standards.repository) {
    for (const lockedRepo of lock.sources.repository) {
      const repoConfig = config.standards.repository.find((r) => r.id === lockedRepo.id);
      if (repoConfig) {
        try {
          const repoSource = await fetchRepositorySource(repoConfig, projectRoot);
          sources.push(repoSource);
        } catch (err) {
          wrapSourceFetchError(
            err,
            `Failed to re-fetch repository source '${lockedRepo.id}'`,
            "The original repository source is unavailable and skills are missing from the canonical store",
          );
        }
      }
    }
  }

  return sources;
}

// TODO: Implement lock file migration (v1 → v2) that populates skillSources
// by running a fresh resolution against current config. Once migration exists,
// remove this fallback and make missing skillSources a hard error.
export function inferSourceFromSkillId(slug: string): SkillSource {
  if (slug.startsWith("client-")) return SkillSource.Client;
  if (slug.startsWith("repo-")) return SkillSource.Repository;
  return SkillSource.CodeFlex;
}
