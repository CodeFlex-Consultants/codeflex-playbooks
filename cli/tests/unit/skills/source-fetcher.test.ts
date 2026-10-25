import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fetchClientSource, fetchCodeFlexSource, fetchRepositorySource, classifyGitError } from "../../../src/skills/source-fetcher";
import { SourceFetchError } from "../../../src/utils/errors";
import { engineeringConfigSchema } from "../../../src/types/schemas";
import type { ClientStandardSource, CodeFlexSource, RepositoryStandardSource } from "../../../src/types/index";

const execFileAsync = promisify(execFile);

async function runGit(args: string[], cwd: string): Promise<void> {
  await execFileAsync("git", args, { cwd });
}

async function createTempGitRepo(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "codeflex-git-test-"));
  await runGit(["init", "-b", "main"], dir);
  await runGit(["config", "user.email", "test@test.com"], dir);
  await runGit(["config", "user.name", "Test"], dir);
  await mkdir(join(dir, "skills", "test-skill"), { recursive: true });
  await writeFile(join(dir, "skills", "test-skill", "SKILL.md"), "# Test Skill");
  await writeFile(join(dir, "skills", "test-skill", "codeflex.yaml"), "id: test-skill");
  await runGit(["add", "."], dir);
  await runGit(["commit", "-m", "initial"], dir);
  return dir;
}

describe("fetchClientSource", () => {
  let tempRoot: string;

  beforeEach(async () => {
    tempRoot = await mkdtemp(join(tmpdir(), "codeflex-fetch-test-"));
  });

  afterEach(async () => {
    await rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  });

  describe("repository sources", () => {
    it("fetches a local repository source", async () => {
      const skillsDir = join(tempRoot, "skills");
      await mkdir(skillsDir, { recursive: true });
      await writeFile(join(skillsDir, "test.txt"), "content");

      const source: ClientStandardSource = {
        id: "test-client",
        source: { type: "repository", path: "skills" },
      };

      const result = await fetchClientSource({ source, projectRoot: tempRoot });
      expect(result.type).toBe("client");
      expect(result.id).toBe("test-client");
      expect(result.skillsDir).toBe(skillsDir);
      expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
    });

    it("throws for missing repository path", async () => {
      const source: ClientStandardSource = {
        id: "test-client",
        source: { type: "repository", path: "nonexistent" },
      };

      await expect(
        fetchClientSource({ source, projectRoot: tempRoot })
      ).rejects.toThrow("directory not found");
    });
  });

  describe("git sources", () => {
    let gitRepoPath: string;

    beforeEach(async () => {
      gitRepoPath = await createTempGitRepo();
    });

    afterEach(async () => {
      await rm(gitRepoPath, { recursive: true, force: true }).catch(() => {});
    });

    it("fetches a git source from a local repository", async () => {
      const source: ClientStandardSource = {
        id: "test-git",
        source: { type: "git", url: gitRepoPath, path: "skills" },
      };

      const result = await fetchClientSource({ source, projectRoot: tempRoot });
      expect(result.type).toBe("client");
      expect(result.id).toBe("test-git");
      expect(result.commit).toBeDefined();
      expect(result.commit).not.toBe("unknown");
      expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(result.skillsDir).toContain("codeflex-git-");
    });

    it("fetches a git source without subpath", async () => {
      const source: ClientStandardSource = {
        id: "test-git",
        source: { type: "git", url: gitRepoPath },
      };

      const result = await fetchClientSource({ source, projectRoot: tempRoot });
      expect(result.type).toBe("client");
      expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
    });

    it("fetches a git source with a specific ref", async () => {
      await runGit(["tag", "v1.0.0"], gitRepoPath);

      const source: ClientStandardSource = {
        id: "test-git",
        source: { type: "git", url: gitRepoPath, ref: "v1.0.0" },
      };

      const result = await fetchClientSource({ source, projectRoot: tempRoot });
      expect(result.type).toBe("client");
      expect(result.commit).toBeDefined();
    });

    it("throws SourceFetchError for invalid ref", async () => {
      const source: ClientStandardSource = {
        id: "test-git",
        source: { type: "git", url: gitRepoPath, ref: "nonexistent-branch" },
      };

      await expect(
        fetchClientSource({ source, projectRoot: tempRoot })
      ).rejects.toThrow(SourceFetchError);
    });

    it("throws SourceFetchError for invalid URL", async () => {
      const source: ClientStandardSource = {
        id: "test-git",
        source: { type: "git", url: "/nonexistent/path/to/repo" },
      };

      await expect(
        fetchClientSource({ source, projectRoot: tempRoot })
      ).rejects.toThrow(SourceFetchError);
    });

    it("throws SourceFetchError for missing subpath in repo", async () => {
      const source: ClientStandardSource = {
        id: "test-git",
        source: { type: "git", url: gitRepoPath, path: "nonexistent-dir" },
      };

      await expect(
        fetchClientSource({ source, projectRoot: tempRoot })
      ).rejects.toThrow(SourceFetchError);
    });
  });
});

describe("git source schema validation", () => {
  it("accepts a valid git source config", () => {
    const config = {
      version: 1,
      autoDetect: true,
      agentHarnesses: ["codex"],
      standards: {
        codeflex: { enabled: true },
        client: [{ id: "client-a", source: { type: "git" as const, url: "https://github.com/org/repo.git" } }],
      },
      include: [],
      exclude: [],
      scopes: {},
      exceptions: [],
    };
    const result = engineeringConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it("accepts git source with ref and path", () => {
    const config = {
      version: 1,
      autoDetect: true,
      agentHarnesses: ["codex"],
      standards: {
        codeflex: { enabled: true },
        client: [{
          id: "client-a",
          source: { type: "git" as const, url: "https://github.com/org/repo.git", ref: "v1.0.0", path: "skills" },
        }],
      },
      include: [],
      exclude: [],
      scopes: {},
      exceptions: [],
    };
    const result = engineeringConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it("rejects git source without url", () => {
    const config = {
      version: 1,
      autoDetect: true,
      agentHarnesses: ["codex"],
      standards: {
        codeflex: { enabled: true },
        client: [{ id: "client-a", source: { type: "git" as const } }],
      },
      include: [],
      exclude: [],
      scopes: {},
      exceptions: [],
    };
    const result = engineeringConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it("rejects git source with invalid url", () => {
    const config = {
      version: 1,
      autoDetect: true,
      agentHarnesses: ["codex"],
      standards: {
        codeflex: { enabled: true },
        client: [{ id: "client-a", source: { type: "git" as const, url: "not-a-url" } }],
      },
      include: [],
      exclude: [],
      scopes: {},
      exceptions: [],
    };
    const result = engineeringConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it("rejects repository source without path", () => {
    const config = {
      version: 1,
      autoDetect: true,
      agentHarnesses: ["codex"],
      standards: {
        codeflex: { enabled: true },
        client: [{ id: "client-a", source: { type: "repository" as const } }],
      },
      include: [],
      exclude: [],
      scopes: {},
      exceptions: [],
    };
    const result = engineeringConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });
});

describe("fetchCodeFlexSource", () => {
  let tempRoot: string;

  beforeEach(async () => {
    tempRoot = await mkdtemp(join(tmpdir(), "codeflex-fetch-codeflex-test-"));
  });

  afterEach(async () => {
    await rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  });

  describe("git source", () => {
    let gitRepoPath: string;
    let cacheDir: string;
    let previousCacheDirEnv: string | undefined;

    beforeEach(async () => {
      gitRepoPath = await createTempGitRepo();
      // fetchCodeFlexGitSource now maintains a persistent, shared cache under
      // ~/.codeflex/engineering-skills (overridable via CODEFLEX_SKILLS_CACHE_DIR)
      // rather than a disposable per-call temp directory. Point it at an
      // isolated temp path per test so the suite never touches the real
      // developer home directory and tests don't interfere with each other.
      previousCacheDirEnv = process.env["CODEFLEX_SKILLS_CACHE_DIR"];
      cacheDir = join(tempRoot, "codeflex-skills-cache");
      process.env["CODEFLEX_SKILLS_CACHE_DIR"] = cacheDir;
    });

    afterEach(async () => {
      await rm(gitRepoPath, { recursive: true, force: true }).catch(() => {});
      await rm(cacheDir, { recursive: true, force: true }).catch(() => {});
      await rm(`${cacheDir}.lock`, { force: true }).catch(() => {});
      if (previousCacheDirEnv === undefined) {
        delete process.env["CODEFLEX_SKILLS_CACHE_DIR"];
      } else {
        process.env["CODEFLEX_SKILLS_CACHE_DIR"] = previousCacheDirEnv;
      }
    });

    it("fetches codeflex source from a git repository", async () => {
      const source: CodeFlexSource = {
        type: "git",
        url: gitRepoPath,
        ref: "main",
        protectedBranches: ["main"],
      };
      const result = await fetchCodeFlexSource(source);
      expect(result.source.type).toBe("codeflex");
      expect(result.source.commit).toBeDefined();
      expect(result.source.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(result.source.skillsDir).toBe(join(cacheDir, "skills"));
      expect(result.source.cleanupPath).toBeUndefined();
    });

    it("verifies commit hash when expectedCommit matches", async () => {
      const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: gitRepoPath });
      const commitHash = stdout.trim();

      const source: CodeFlexSource = {
        type: "git",
        url: gitRepoPath,
        ref: "main",
        expectedCommit: commitHash,
        protectedBranches: ["main"],
      };

      const result = await fetchCodeFlexSource(source);
      expect(result.source.commit).toBe(commitHash);
    });

    it("throws SourceFetchError when expectedCommit does not match and cannot be recovered", async () => {
      const source: CodeFlexSource = {
        type: "git",
        url: gitRepoPath,
        ref: "main",
        expectedCommit: "0000000000000000000000000000000000000000",
      };

      await expect(fetchCodeFlexSource(source)).rejects.toThrow(SourceFetchError);
      await expect(fetchCodeFlexSource(source)).rejects.toThrow(/Commit hash mismatch/);
    });

    it("recovers a pinned expectedCommit that is genuinely reachable from an approved branch", async () => {
      const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: gitRepoPath });
      const originalCommit = stdout.trim();

      await writeFile(join(gitRepoPath, "skills", "test-skill", "codeflex.yaml"), "id: test-skill-v2", "utf-8");
      await runGit(["add", "."], gitRepoPath);
      await runGit(["commit", "-m", "advance past the locked commit"], gitRepoPath);

      // originalCommit is a real ancestor of main's current tip, so recovery must succeed
      // even though protectedBranches is a strict subset that still includes "main".
      const source: CodeFlexSource = {
        type: "git",
        url: gitRepoPath,
        ref: "main",
        expectedCommit: originalCommit,
        protectedBranches: ["main"],
      };

      const result = await fetchCodeFlexSource(source);

      expect(result.source.commit).toBe(originalCommit);
      const recoveredYaml = await readFile(join(result.source.skillsDir, "test-skill", "codeflex.yaml"), "utf-8");
      expect(recoveredYaml).toBe("id: test-skill");
    });

    it("refuses to recover a commit that only exists on a non-approved branch", async () => {
      // A commit fetched by SHA can come from *any* ref the remote serves, not just an
      // approved one — this is exactly the scenario that must be rejected: engineering.lock
      // (or an attacker controlling it) names a commit that was never actually released via
      // an approved branch.
      await runGit(["checkout", "-b", "feature/never-merged"], gitRepoPath);
      await writeFile(join(gitRepoPath, "skills", "test-skill", "codeflex.yaml"), "id: test-skill-evil", "utf-8");
      await runGit(["add", "."], gitRepoPath);
      await runGit(["commit", "-m", "commit that never lands on main"], gitRepoPath);
      const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: gitRepoPath });
      const unapprovedCommit = stdout.trim();
      await runGit(["checkout", "main"], gitRepoPath);

      const source: CodeFlexSource = {
        type: "git",
        url: gitRepoPath,
        ref: "main",
        expectedCommit: unapprovedCommit,
        protectedBranches: ["main"],
      };

      await expect(fetchCodeFlexSource(source)).rejects.toThrow(SourceFetchError);
      await expect(fetchCodeFlexSource(source)).rejects.toThrow(/Commit hash mismatch/);
    });

    it("throws SourceFetchError when branch is not in protectedBranches", async () => {
      await runGit(["checkout", "-b", "feature-branch"], gitRepoPath);
      await writeFile(join(gitRepoPath, "test.txt"), "content");
      await runGit(["add", "."], gitRepoPath);
      await runGit(["commit", "-m", "feature"], gitRepoPath);

      const source: CodeFlexSource = {
        type: "git",
        url: gitRepoPath,
        ref: "feature-branch",
        protectedBranches: ["main", "dev"],
      };

      await expect(fetchCodeFlexSource(source)).rejects.toThrow(SourceFetchError);
      await expect(fetchCodeFlexSource(source)).rejects.toThrow(/not an approved protected branch/);
    });

    it("accepts branch when it is in protectedBranches", async () => {
      const source: CodeFlexSource = {
        type: "git",
        url: gitRepoPath,
        ref: "main",
        protectedBranches: ["main", "dev"],
      };

      const result = await fetchCodeFlexSource(source);
      expect(result.source.type).toBe("codeflex");
    });

    it("defaults protectedBranches to main and dev", async () => {
      await runGit(["checkout", "-b", "staging"], gitRepoPath);
      await writeFile(join(gitRepoPath, "test.txt"), "content");
      await runGit(["add", "."], gitRepoPath);
      await runGit(["commit", "-m", "staging"], gitRepoPath);

      const source: CodeFlexSource = {
        type: "git",
        url: gitRepoPath,
        ref: "staging",
      };

      await expect(fetchCodeFlexSource(source)).rejects.toThrow(/not an approved protected branch/);
    });

    it("reuses the persistent cache directory across calls instead of re-cloning", async () => {
      const source: CodeFlexSource = {
        type: "git",
        url: gitRepoPath,
        ref: "main",
        protectedBranches: ["main"],
      };

      const first = await fetchCodeFlexSource(source);
      const second = await fetchCodeFlexSource(source);

      expect(first.source.skillsDir).toBe(second.source.skillsDir);
      expect(second.source.sha256).toBe(first.source.sha256);
    });

    it("picks up upstream changes on the next call via the cache", async () => {
      const source: CodeFlexSource = {
        type: "git",
        url: gitRepoPath,
        ref: "main",
        protectedBranches: ["main"],
      };

      const first = await fetchCodeFlexSource(source);

      await writeFile(join(gitRepoPath, "skills", "test-skill", "SKILL.md"), "# Updated Test Skill");
      await runGit(["add", "."], gitRepoPath);
      await runGit(["commit", "-m", "update skill"], gitRepoPath);

      const second = await fetchCodeFlexSource(source);

      expect(second.source.commit).not.toBe(first.source.commit);
      expect(second.source.sha256).not.toBe(first.source.sha256);
    });

    it("recovers by re-cloning when the cache directory is corrupted", async () => {
      const source: CodeFlexSource = {
        type: "git",
        url: gitRepoPath,
        ref: "main",
        protectedBranches: ["main"],
      };

      await fetchCodeFlexSource(source);
      await rm(join(cacheDir, ".git", "HEAD"), { force: true }).catch(() => {});

      const result = await fetchCodeFlexSource(source);
      expect(result.source.type).toBe("codeflex");
      expect(result.source.sha256).toMatch(/^[a-f0-9]{64}$/);
    });

    it("does not leave a stale lock file behind after a successful fetch", async () => {
      const source: CodeFlexSource = {
        type: "git",
        url: gitRepoPath,
        ref: "main",
        protectedBranches: ["main"],
      };

      await fetchCodeFlexSource(source);

      const { pathExists } = await import("../../../src/utils/fs.js");
      expect(await pathExists(`${cacheDir}.lock`)).toBe(false);
    });
  });

  describe("release source", () => {
    let stagingDir: string;
    let server: ReturnType<typeof createServer>;
    let serverUrl: string;

    beforeEach(async () => {
      stagingDir = await mkdtemp(join(tmpdir(), "codeflex-release-staging-"));

      await mkdir(join(stagingDir, "skills", "test-skill"), { recursive: true });
      await writeFile(join(stagingDir, "skills", "test-skill", "SKILL.md"), "# Test Skill");
      await writeFile(join(stagingDir, "skills", "test-skill", "codeflex.yaml"), "id: test-skill");

      const { sha256Directory } = await import("../../../src/utils/hash.js");
      const skillsHash = await sha256Directory(join(stagingDir, "skills"));

      const manifest = {
        release: "v2026.09.0",
        commit: "abc123def456",
        sha256: skillsHash,
        branch: "main",
      };
      await writeFile(join(stagingDir, "release-manifest.json"), JSON.stringify(manifest));

      const archivePath = join(stagingDir, "artifact.tar.gz");
      await execFileAsync("tar", ["czf", archivePath, "-C", stagingDir, "release-manifest.json", "skills"]);

      const archiveBuffer = await readFile(archivePath);
      server = createServer((_req, res) => {
        res.writeHead(200, { "Content-Type": "application/gzip" });
        res.end(archiveBuffer);
      });
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      const addr = server.address();
      serverUrl = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}/artifact.tar.gz`;
    });

    afterEach(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await rm(stagingDir, { recursive: true, force: true }).catch(() => {});
    });

    it("fetches codeflex source from a release artifact with valid manifest", async () => {
      const { sha256Directory } = await import("../../../src/utils/hash.js");
      const skillsHash = await sha256Directory(join(stagingDir, "skills"));

      const source: CodeFlexSource = {
        type: "release",
        url: serverUrl,
        expectedSha256: skillsHash,
      };

      const result = await fetchCodeFlexSource(source);
      expect(result.source.type).toBe("codeflex");
      expect(result.source.release).toBe("v2026.09.0");
      expect(result.source.sha256).toBe(skillsHash);
    });

    it("throws SourceFetchError when SHA-256 does not match", async () => {
      const source: CodeFlexSource = {
        type: "release",
        url: serverUrl,
        expectedSha256: "0000000000000000000000000000000000000000000000000000000000000000",
      };

      await expect(fetchCodeFlexSource(source)).rejects.toThrow(SourceFetchError);
      await expect(fetchCodeFlexSource(source)).rejects.toThrow(/SHA-256 mismatch/);
    });

    it("throws SourceFetchError when HTTP request fails", async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));

      const source: CodeFlexSource = {
        type: "release",
        url: serverUrl,
        expectedSha256: "abc123",
      };

      await expect(fetchCodeFlexSource(source)).rejects.toThrow(SourceFetchError);
    });
  });

  describe("codeflex source schema validation", () => {
    it("accepts a valid codeflex git source config", () => {
      const config = {
        version: 1,
        autoDetect: true,
        agentHarnesses: ["codex"],
        standards: {
          codeflex: {
            enabled: true,
            source: { type: "git" as const, url: "https://github.com/org/repo.git" },
          },
        },
        include: [],
        exclude: [],
        scopes: {},
        exceptions: [],
      };
      const result = engineeringConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it("accepts codeflex git source with all options", () => {
      const config = {
        version: 1,
        autoDetect: true,
        agentHarnesses: ["codex"],
        standards: {
          codeflex: {
            enabled: true,
            source: {
              type: "git" as const,
              url: "https://github.com/org/repo.git",
              ref: "v1.0.0",
              expectedCommit: "abc123",
              protectedBranches: ["main"],
            },
          },
        },
        include: [],
        exclude: [],
        scopes: {},
        exceptions: [],
      };
      const result = engineeringConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it("accepts codeflex release source config", () => {
      const config = {
        version: 1,
        autoDetect: true,
        agentHarnesses: ["codex"],
        standards: {
          codeflex: {
            enabled: true,
            source: {
              type: "release" as const,
              url: "https://github.com/org/release.git",
              expectedSha256: "abc123def456",
            },
          },
        },
        include: [],
        exclude: [],
        scopes: {},
        exceptions: [],
      };
      const result = engineeringConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it("accepts codeflex local source config", () => {
      const config = {
        version: 1,
        autoDetect: true,
        agentHarnesses: ["codex"],
        standards: {
          codeflex: {
            enabled: true,
            source: { type: "local" as const, path: "../engineering-skills/skills" },
          },
        },
        include: [],
        exclude: [],
        scopes: {},
        exceptions: [],
      };
      const result = engineeringConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it("rejects codeflex git source without url", () => {
      const config = {
        version: 1,
        autoDetect: true,
        agentHarnesses: ["codex"],
        standards: {
          codeflex: {
            enabled: true,
            source: { type: "git" as const },
          },
        },
        include: [],
        exclude: [],
        scopes: {},
        exceptions: [],
      };
      const result = engineeringConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it("rejects codeflex release source without expectedSha256", () => {
      const config = {
        version: 1,
        autoDetect: true,
        agentHarnesses: ["codex"],
        standards: {
          codeflex: {
            enabled: true,
            source: { type: "release" as const, url: "https://github.com/org/release.git" },
          },
        },
        include: [],
        exclude: [],
        scopes: {},
        exceptions: [],
      };
      const result = engineeringConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });
});

describe("fetchRepositorySource", () => {
  let tempRoot: string;

  beforeEach(async () => {
    tempRoot = await mkdtemp(join(tmpdir(), "codeflex-repo-fetch-test-"));
  });

  afterEach(async () => {
    await rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  });

  it("computes SHA-256 for a local repository source", async () => {
    const skillsDir = join(tempRoot, "repo-skills");
    await mkdir(skillsDir, { recursive: true });
    await writeFile(join(skillsDir, "SKILL.md"), "# Repo Skill");
    await writeFile(join(skillsDir, "codeflex.yaml"), "id: repo-skill");

    const source: RepositoryStandardSource = {
      id: "test-repo",
      path: "repo-skills",
    };

    const result = await fetchRepositorySource(source, tempRoot);
    expect(result.type).toBe("repository");
    expect(result.id).toBe("test-repo");
    expect(result.skillsDir).toBe(skillsDir);
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces different hashes for different contents", async () => {
    const dir1 = join(tempRoot, "repo-a");
    const dir2 = join(tempRoot, "repo-b");
    await mkdir(dir1, { recursive: true });
    await mkdir(dir2, { recursive: true });
    await writeFile(join(dir1, "file.txt"), "content-a");
    await writeFile(join(dir2, "file.txt"), "content-b");

    const result1 = await fetchRepositorySource({ id: "a", path: "repo-a" }, tempRoot);
    const result2 = await fetchRepositorySource({ id: "b", path: "repo-b" }, tempRoot);

    expect(result1.sha256).not.toBe(result2.sha256);
  });

  it("throws SourceFetchError for missing directory", async () => {
    const source: RepositoryStandardSource = {
      id: "missing-repo",
      path: "nonexistent",
    };

    await expect(fetchRepositorySource(source, tempRoot)).rejects.toThrow(SourceFetchError);
    await expect(fetchRepositorySource(source, tempRoot)).rejects.toThrow(/directory not found/);
  });

  it("produces consistent hash for same contents", async () => {
    const skillsDir = join(tempRoot, "stable-repo");
    await mkdir(skillsDir, { recursive: true });
    await writeFile(join(skillsDir, "SKILL.md"), "# Stable");

    const result1 = await fetchRepositorySource({ id: "r", path: "stable-repo" }, tempRoot);
    const result2 = await fetchRepositorySource({ id: "r", path: "stable-repo" }, tempRoot);

    expect(result1.sha256).toBe(result2.sha256);
  });
});

describe("classifyGitError", () => {
  const url = "https://github.com/CodeFlex-Consultants/engineering-skills";

  it("detects 'Authentication failed' and provides actionable hint", () => {
    const err = new Error("fatal: Authentication failed for 'https://github.com/CodeFlex-Consultants/engineering-skills'");
    const result = classifyGitError(err, url, "main", "Failed to fetch");
    expect(result.message).toBe(`Authentication failed for repository: ${url}`);
    expect(result.detail).toContain("GitHub no longer accepts account passwords");
    expect(result.detail).toContain("Personal Access Token");
    expect(result.detail).toContain("CODEFLEX_SKILLS_GIT_URL");
    expect(result.detail).toContain("credential.helper");
  });

  it("detects 'could not read Username' case-insensitively", () => {
    const err = new Error("fatal: could not read Username for 'https://github.com'");
    const result = classifyGitError(err, url, "main", "Failed to fetch");
    expect(result.message).toContain("Authentication failed");
    expect(result.detail).toContain("GitHub no longer accepts account passwords");
  });

  it("detects 'could not read Password' case-insensitively", () => {
    const err = new Error("fatal: could not read Password for 'https://github.com'");
    const result = classifyGitError(err, url, "main", "Failed to fetch");
    expect(result.message).toContain("Authentication failed");
    expect(result.detail).toContain("GitHub no longer accepts account passwords");
  });

  it("detects 'Invalid username or password'", () => {
    const err = new Error("Remote: Invalid username or password.");
    const result = classifyGitError(err, url, "main", "Failed to fetch");
    expect(result.message).toContain("Authentication failed");
    expect(result.detail).toContain("GitHub no longer accepts account passwords");
  });

  it("detects 'permission denied (publickey)'", () => {
    const err = new Error("git@github.com: Permission denied (publickey).");
    const result = classifyGitError(err, url, "main", "Failed to fetch");
    expect(result.message).toContain("Authentication failed");
    expect(result.detail).toContain("GitHub no longer accepts account passwords");
  });

  it("detects HTTP 401 errors", () => {
    const err = new Error("The requested URL returned error: 401 Unauthorized");
    const result = classifyGitError(err, url, "main", "Failed to fetch");
    expect(result.message).toContain("Authentication failed");
    expect(result.detail).toContain("GitHub no longer accepts account passwords");
  });

  it("detects HTTP 403 errors", () => {
    const err = new Error("The requested URL returned error: 403 Forbidden");
    const result = classifyGitError(err, url, "main", "Failed to fetch");
    expect(result.message).toContain("Authentication failed");
    expect(result.detail).toContain("GitHub no longer accepts account passwords");
  });

  it("is case-insensitive for auth patterns", () => {
    const err = new Error("FATAL: AUTHENTICATION FAILED");
    const result = classifyGitError(err, url, "main", "Failed to fetch");
    expect(result.message).toContain("Authentication failed");
    expect(result.detail).toContain("GitHub no longer accepts account passwords");
  });

  it("classifies repository-not-found errors", () => {
    const err = new Error("Repository not found: https://github.com/org/nonexistent");
    const result = classifyGitError(err, url, "main", "Failed to fetch");
    expect(result.message).toContain("Repository not found");
    expect(result.detail).toContain("not found");
  });

  it("classifies network errors", () => {
    const err = new Error("Could not resolve host: github.com");
    const result = classifyGitError(err, url, "main", "Failed to fetch");
    expect(result.message).toContain("Network error");
  });

  it("classifies invalid ref errors", () => {
    const err = new Error("Remote branch nonexistent does not match any");
    const result = classifyGitError(err, url, "nonexistent", "Failed to fetch");
    expect(result.message).toContain("Invalid ref");
  });

  it("falls back to generic error for unrecognised messages", () => {
    const err = new Error("something unexpected happened");
    const result = classifyGitError(err, url, "main", "Failed to fetch");
    expect(result.message).toBe(`Failed to fetch: ${url}`);
    expect(result.detail).toBe("something unexpected happened");
  });

  it("handles non-Error values", () => {
    const result = classifyGitError("fatal: Authentication failed", url, "main", "Failed to fetch");
    expect(result.message).toContain("Authentication failed");
    expect(result.detail).toContain("GitHub no longer accepts account passwords");
  });
});
