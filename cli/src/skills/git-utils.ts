import { rm } from "node:fs/promises";
import { join } from "node:path";
import { SourceFetchError } from "../utils/errors";
import { pathExists, ensureDir } from "../utils/fs";
import { execFileAsync } from "../utils/exec";

export async function runGit(args: string[]): Promise<void> {
  try {
    await execFileAsync("git", args, { timeout: 60_000 });
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}

export async function getGitCommit(repoDir: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: repoDir });
    return stdout.trim();
  } catch {
    return null;
  }
}

export type CommitRecoveryResult =
  | { recovered: true }
  | { recovered: false; reason: "fetch-failed" | "not-on-approved-branch" | "checkout-failed" };

export async function syncGitCache(cacheDir: string, url: string, ref: string): Promise<void> {
  const hasExistingCheckout = await pathExists(join(cacheDir, ".git"));

  if (hasExistingCheckout) {
    try {
      await runGit(["-C", cacheDir, "remote", "set-url", "origin", url]);
      await runGit(["-C", cacheDir, "fetch", "--depth", "1", "origin", ref]);
      await runGit(["-C", cacheDir, "checkout", "--force", "FETCH_HEAD"]);
      await runGit(["-C", cacheDir, "clean", "-fdx"]);
      return;
    } catch {
      await rm(cacheDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  await ensureDir(cacheDir);
  try {
    await runGit(["clone", "--depth", "1", "--branch", ref, url, cacheDir]);
  } catch (err) {
    await rm(cacheDir, { recursive: true, force: true }).catch(() => {});
    throw err;
  }
}

export async function tryRecoverExactCommit(
  repoDir: string,
  commit: string,
  protectedBranches: string[],
): Promise<CommitRecoveryResult> {
  try {
    await execFileAsync("git", ["fetch", "--depth", "1", "origin", commit], { cwd: repoDir, timeout: 60_000 });
  } catch {
    return { recovered: false, reason: "fetch-failed" };
  }

  const isApproved = await isCommitOnApprovedBranch(repoDir, commit, protectedBranches);
  if (!isApproved) {
    return { recovered: false, reason: "not-on-approved-branch" };
  }

  try {
    await execFileAsync("git", ["checkout", "--force", "--quiet", commit], { cwd: repoDir, timeout: 60_000 });
  } catch {
    return { recovered: false, reason: "checkout-failed" };
  }

  const checkedOutCommit = await getGitCommit(repoDir);
  return checkedOutCommit === commit ? { recovered: true } : { recovered: false, reason: "checkout-failed" };
}

async function isCommitOnApprovedBranch(
  repoDir: string,
  commit: string,
  protectedBranches: string[],
): Promise<boolean> {
  let unshallowed = false;

  for (const branch of protectedBranches) {
    try {
      if (!unshallowed) {
        await execFileAsync("git", ["fetch", "--unshallow", "origin", branch], { cwd: repoDir, timeout: 120_000 });
        unshallowed = true;
      } else {
        await execFileAsync("git", ["fetch", "origin", branch], { cwd: repoDir, timeout: 60_000 });
      }
      await execFileAsync("git", ["merge-base", "--is-ancestor", commit, "FETCH_HEAD"], { cwd: repoDir, timeout: 30_000 });
      return true;
    } catch {
      continue;
    }
  }

  return false;
}

export function classifyGitError(err: unknown, url: string, ref: string | undefined, fallbackPrefix: string): SourceFetchError {
  const message = err instanceof Error ? err.message : (typeof err === "string" ? err : String(err));
  const lowerMessage = message.toLowerCase();

  if (isAuthenticationError(lowerMessage)) {
    return new SourceFetchError(
      `Authentication failed for repository: ${url}`,
      GIT_AUTH_HINT
    );
  }
  if (message.includes("not found") || message.includes("404") || message.includes("does not exist")) {
    return new SourceFetchError(`Repository not found: ${url}`, message);
  }
  if (message.includes("Could not resolve") || message.includes("unable to access")) {
    return new SourceFetchError(`Network error fetching repository: ${url}`, message);
  }
  if (message.includes("did not match any") || message.includes("Remote branch") || message.includes("not a valid ref")) {
    return new SourceFetchError(`Invalid ref '${ref}' for repository: ${url}`, message);
  }
  return new SourceFetchError(`${fallbackPrefix}: ${url}`, message);
}

function isAuthenticationError(lowerMessage: string): boolean {
  return (
    lowerMessage.includes("authentication failed") ||
    lowerMessage.includes("could not read username") ||
    lowerMessage.includes("could not read password") ||
    lowerMessage.includes("invalid username or password") ||
    lowerMessage.includes("permission denied (publickey)") ||
    lowerMessage.includes("401") ||
    lowerMessage.includes("403")
  );
}

const GIT_AUTH_HINT = [
  "GitHub no longer accepts account passwords for Git operations.",
  "",
  "Solutions (choose one):",
  "",
  "1. Personal Access Token (PAT):",
  "   - Create a token at https://github.com/settings/tokens with 'repo' scope",
  "   - Use the token as your password when prompted for credentials",
  "   - Cache with: git config --global credential.helper osxkeychain",
  "",
  "2. SSH (requires SSH key configured with GitHub):",
   "   export CODEFLEX_SKILLS_GIT_URL=\"git@github.com:CodeFlex-Consultants/engineering-skills.git\"",
   "   codeflex init",
  "",
  "3. Git Credential Manager (recommended for ongoing use):",
  "   git config --global credential.helper osxkeychain   # macOS",
  "   git config --global credential.helper manager        # Windows",
  "   git config --global credential.helper store          # Linux",
   "   Then re-run codeflex init and enter your PAT when prompted",
].join("\n");
