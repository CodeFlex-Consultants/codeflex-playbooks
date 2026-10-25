import { stat, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir, homedir } from "node:os";
import type {
  StandardsSource,
  ClientStandardSource,
  CodeFlexSource,
  RepositoryStandardSource,
} from "../types/index";
import { CodeFlexSourceType, ReleaseChannel, SkillSource, ClientSourceType } from "../types/index";
import { sha256Content, sha256Directory } from "../utils/hash";
import { SourceFetchError } from "../utils/errors";
import { runGit, getGitCommit, classifyGitError, syncGitCache, tryRecoverExactCommit } from "./git-utils";
import { acquireCacheLock } from "./cache-lock";
import { fetchCodeFlexReleaseSource } from "./release-artifact";
import { ENV_VARS, ENV_VALUES } from "../utils/env-vars";
import { CONFIG_DIRS, PATH_SEGMENTS } from "../detection/harness/constants";

export { classifyGitError } from "./git-utils";
export type { CommitRecoveryResult } from "./git-utils";

const DEFAULT_PROTECTED_BRANCHES = ["main", "dev"];

export const DEFAULT_CODEFLEX_SKILLS_REPO_URL = "https://github.com/CodeFlex-Consultants/engineering-skills.git";

const CODEFLEX_SKILLS_SUBDIRECTORY = "skills";

export function getCodeFlexSkillsCacheDir(): string {
  return process.env[ENV_VARS.CODEFLEX_SKILLS_CACHE_DIR] ?? join(homedir(), CONFIG_DIRS.CODEFLEX, CONFIG_DIRS.ENGINEERING_SKILLS);
}

export interface FetchOptions {
  source: ClientStandardSource;
  projectRoot: string;
}

export interface FetchCodeFlexResult {
  source: StandardsSource;
  warnings: string[];
}

export async function fetchCodeFlexSource(
  source?: CodeFlexSource,
  release?: string,
  channel?: ReleaseChannel,
  expectedCommit?: string
): Promise<FetchCodeFlexResult> {
  if (!source) {
    // Check for local development path first
    if (process.env[ENV_VARS.CODEFLEX_SKILLS_PATH]) {
      return fetchCodeFlexLocalSource(release);
    }

    // Check for sibling engineering-skills directory (development mode only)
    if (process.env[ENV_VARS.CODEFLEX_ENABLE_DEV_FALLBACK] === ENV_VALUES.DEV_FALLBACK_ENABLED || 
        process.env[ENV_VARS.NODE_ENV] === ENV_VALUES.NODE_ENV_DEVELOPMENT) {
      const devFallbackPath = join(process.cwd(), PATH_SEGMENTS.PARENT, CONFIG_DIRS.ENGINEERING_SKILLS, CONFIG_DIRS.SKILLS);
      try {
        await stat(devFallbackPath);
        return fetchCodeFlexLocalSource(release, devFallbackPath);
      } catch {
        // Local dev path doesn't exist, try Git
      }
    }

    const defaultGitUrl = process.env[ENV_VARS.CODEFLEX_SKILLS_GIT_URL] ?? DEFAULT_CODEFLEX_SKILLS_REPO_URL;
    return fetchCodeFlexGitSource(
      { type: CodeFlexSourceType.Git, url: defaultGitUrl, expectedCommit },
      release,
      channel
    );
  }

  if (source.type === CodeFlexSourceType.Git) {
    return fetchCodeFlexGitSource(source, release, channel);
  }

  if (source.type === CodeFlexSourceType.Release) {
    return fetchCodeFlexReleaseSource(source, release);
  }

  return fetchCodeFlexLocalSource(release, source.path);
}

async function fetchCodeFlexLocalSource(
  release?: string,
  overridePath?: string
): Promise<FetchCodeFlexResult> {
  const envPath = process.env[ENV_VARS.CODEFLEX_SKILLS_PATH];
  const devFallbackPath = join(process.cwd(), PATH_SEGMENTS.PARENT, CONFIG_DIRS.ENGINEERING_SKILLS, CONFIG_DIRS.SKILLS);
  const defaultPath = overridePath ?? envPath ?? devFallbackPath;
  const warnings: string[] = [];

  // Only show warning if using dev fallback without explicit configuration
  if (!overridePath && !envPath && defaultPath === devFallbackPath) {
    warnings.push(
      `Using development fallback path '${defaultPath}'. ` +
      `Set ${ENV_VARS.CODEFLEX_SKILLS_PATH} environment variable or configure an explicit codeflex source for production use.`
    );
  }

  try {
    await stat(defaultPath);
  } catch {
    throw new SourceFetchError(
      `CodeFlex skills directory not found at ${defaultPath}`,
      !overridePath && !envPath
        ? `The development fallback path does not exist. Set ${ENV_VARS.CODEFLEX_SKILLS_PATH} or configure an explicit codeflex source.`
        : `Verify the path exists and is accessible.`
    );
  }

  const dirHash = await sha256Directory(defaultPath);
  const commitHash = await sha256Content(defaultPath);

  return {
    source: {
      type: SkillSource.CodeFlex,
      release: release ?? "local",
      commit: commitHash,
      sha256: dirHash,
      skillsDir: defaultPath,
    },
    warnings,
  };
}

async function fetchCodeFlexGitSource(
  source: Extract<CodeFlexSource, { type: CodeFlexSourceType.Git }>,
  release?: string,
  channel?: ReleaseChannel
): Promise<FetchCodeFlexResult> {
  const { url, ref, expectedCommit, protectedBranches, channel: sourceChannel } = source;
  const effectiveChannel = channel ?? sourceChannel ?? ReleaseChannel.Stable;
  const defaultBranch = effectiveChannel === ReleaseChannel.Canary ? "dev" : "main";
  const effectiveRef = ref ?? defaultBranch;
  const effectiveProtectedBranches = protectedBranches ?? DEFAULT_PROTECTED_BRANCHES;

  if (!effectiveProtectedBranches.includes(effectiveRef)) {
    throw new SourceFetchError(
      `Branch '${effectiveRef}' is not an approved protected branch`,
      `Approved branches: ${effectiveProtectedBranches.join(", ")}`
    );
  }

  const cacheDir = getCodeFlexSkillsCacheDir();

  try {
    const releaseLock = await acquireCacheLock(cacheDir);
    let resolvedCommit: string | null;
    let skillsDir: string;
    let sha: string;
    try {
      await syncGitCache(cacheDir, url, effectiveRef);

      resolvedCommit = await getGitCommit(cacheDir);

      if (expectedCommit && resolvedCommit !== expectedCommit) {
        const recovery = await tryRecoverExactCommit(cacheDir, expectedCommit, effectiveProtectedBranches);
        if (!recovery.recovered) {
          const detail = recovery.reason === "not-on-approved-branch"
            ? `The commit exists on the remote but is not reachable from any approved protected branch ` +
              `(${effectiveProtectedBranches.join(", ")}). engineering.lock may be stale or tampered with.`
            : `The branch '${effectiveRef}' has moved past the expected commit, and it could not be fetched directly. ` +
              `The remote may not support fetching a commit by SHA, or the commit may no longer exist.`;
          throw new SourceFetchError(
            `Commit hash mismatch: expected ${expectedCommit}, got ${resolvedCommit}`,
            detail,
          );
        }
        resolvedCommit = expectedCommit;
      }

      skillsDir = join(cacheDir, CODEFLEX_SKILLS_SUBDIRECTORY);
      try {
        await stat(skillsDir);
      } catch {
        throw new SourceFetchError(
          `Skills directory not found in cloned repository`,
          `Expected a '${CODEFLEX_SKILLS_SUBDIRECTORY}/' directory in ${url}@${effectiveRef}`
        );
      }

      sha = await sha256Directory(skillsDir);
    } finally {
      await releaseLock();
    }

    return {
      source: {
        type: SkillSource.CodeFlex,
        release: release ?? `git:${url}@${(resolvedCommit ?? "unknown").slice(0, 12)}`,
        commit: resolvedCommit ?? undefined,
        sha256: sha,
        skillsDir,
      },
      warnings: [],
    };
  } catch (err) {
    if (err instanceof SourceFetchError) {
      throw err;
    }

    throw classifyGitError(err, url, effectiveRef, "Failed to fetch codeflex git source");
  }
}

async function fetchLocalSource(
  type: SkillSource.Client | SkillSource.Repository,
  id: string | undefined,
  fullPath: string,
  label: string,
): Promise<StandardsSource> {
  try {
    await stat(fullPath);
  } catch {
    throw new SourceFetchError(`${label} directory not found at ${fullPath}`);
  }

  const dirHash = await sha256Directory(fullPath);

  return {
    type,
    id,
    sha256: dirHash,
    skillsDir: fullPath,
  };
}

export async function fetchClientSource(
  options: FetchOptions
): Promise<StandardsSource> {
  const { source, projectRoot } = options;

  if (source.source.type === ClientSourceType.Git) {
    return fetchGitSource(source);
  }

  const sourcePath = source.source.path;
  if (!sourcePath) {
    throw new SourceFetchError("Client source path is required");
  }

  const fullPath = join(projectRoot, sourcePath);
  return fetchLocalSource(SkillSource.Client, source.id, fullPath, "Client source");
}

export async function fetchRepositorySource(
  source: RepositoryStandardSource,
  projectRoot: string
): Promise<StandardsSource> {
  const fullPath = join(projectRoot, source.path);
  return fetchLocalSource(SkillSource.Repository, source.id, fullPath, "Repository source");
}

async function fetchGitSource(
  source: ClientStandardSource
): Promise<StandardsSource> {
  const url = source.source.url;
  if (!url) {
    throw new SourceFetchError("Git source URL is required");
  }

  const ref = source.source.ref;
  const subPath = source.source.path;

  let tempDir: string | undefined;
  try {
    tempDir = await mkdtemp(join(tmpdir(), "codeflex-git-"));

    await runGit(["clone", "--depth", "1", ...(ref ? ["--branch", ref] : []), url, tempDir]);

    const resolvedCommit = await getGitCommit(tempDir);

    const skillsDir = subPath ? join(tempDir, subPath) : tempDir;

    try {
      await stat(skillsDir);
    } catch {
      throw new SourceFetchError(
        `Path '${subPath}' not found in repository ${url}`,
        `The specified subdirectory does not exist in the cloned repository`
      );
    }

    const sha = await sha256Directory(skillsDir);

    return {
      type: SkillSource.Client,
      id: source.id,
      commit: resolvedCommit ?? undefined,
      sha256: sha,
      skillsDir,
      cleanupPath: tempDir,
    };
  } catch (err) {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }

    if (err instanceof SourceFetchError) {
      throw err;
    }

    throw classifyGitError(err, url, ref, "Failed to fetch git source");
  }
}

export async function cleanupSources(sources: readonly StandardsSource[]): Promise<void> {
  const paths = new Set<string>();
  for (const source of sources) {
    if (source.cleanupPath) {
      paths.add(source.cleanupPath);
    }
  }
  await Promise.all([...paths].map((p) => rm(p, { recursive: true, force: true }).catch(() => {})));
}
