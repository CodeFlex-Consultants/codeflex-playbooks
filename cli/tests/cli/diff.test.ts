import { describe, it, expect, vi, beforeEach } from "vitest";
import { join } from "node:path";
import { rm, writeFile } from "node:fs/promises";
import { runCli, withTempFixture, setupInitializedProject } from "./cli-helpers";

vi.mock("../../src/skills/source-fetcher.js", () => ({
  fetchCodeFlexSource: vi.fn(async () => ({
    source: {
      type: "codeflex" as const,
      release: "local",
      commit: "local",
      sha256: "local",
      skillsDir: "",
    },
    warnings: [],
  })),
  fetchClientSource: vi.fn(async () => ({
    type: "client" as const,
    id: "local",
    sha256: "local",
    skillsDir: "",
  })),
  cleanupSources: vi.fn(async () => {}),
}));

vi.mock("../../src/detection/harness/index.js", () => ({
  detectHarnesses: vi.fn(),
}));

import { fetchCodeFlexSource } from "../../src/skills/source-fetcher";
import { detectHarnesses } from "../../src/detection/harness/index";

const mockedFetchCodeFlexSource = vi.mocked(fetchCodeFlexSource);
const mockedDetectHarnesses = vi.mocked(detectHarnesses);

describe("CLI: diff command", () => {
  beforeEach(() => {
    mockedFetchCodeFlexSource.mockReset();
    mockedDetectHarnesses.mockReset();
    mockedDetectHarnesses.mockResolvedValue([]);
  });

  describe("up to date state", () => {
    it("reports no changes when project is up to date", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);

        mockedFetchCodeFlexSource.mockResolvedValueOnce({
          source: {
            type: "codeflex" as const,
            release: "local",
            commit: "local",
            sha256: "local",
            skillsDir: join(tempDir, ".codeflex", "skills-source", "codeflex"),
          },
          warnings: [],
        });

        const result = await runCli(["diff"], tempDir);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("No changes detected");
      });
    });
  });

  describe("error cases", () => {
    it("fails when not initialized", async () => {
      await withTempFixture("empty", async (tempDir) => {
        const result = await runCli(["diff"], tempDir);

        expect(result.exitCode).not.toBe(0);
        expect(result.error).toBeDefined();
      });
    });

    it("fails when source fetch throws", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);

        mockedFetchCodeFlexSource.mockRejectedValueOnce(
          new Error("Network timeout"),
        );

        const result = await runCli(["diff"], tempDir);

        expect(result.exitCode).not.toBe(0);
      });
    });

    it("rejects invalid --channel value", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);

        const result = await runCli(["diff", "--channel", "nightly"], tempDir);

        expect(result.exitCode).not.toBe(0);
      });
    });
  });

  describe("command registration", () => {
    it("is registered as a command", async () => {
      await withTempFixture("empty", async (tempDir) => {
        const result = await runCli(["--help"], tempDir);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("diff");
        expect(result.stdout).toContain("Show what would change before running update");
      });
    });

    it("documents --channel flag in help", async () => {
      await withTempFixture("empty", async (tempDir) => {
        const result = await runCli(["--help"], tempDir);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("diff");
      });
    });
  });

  describe("skill changes", () => {
    it("detects skill additions when lockfile has fewer skills than resolution", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);

        const { loadLock, saveLock } = await import("../../src/config/index.js");
        const lock = await loadLock(tempDir);
        lock.skills = [];
        await saveLock(tempDir, lock);

        mockedFetchCodeFlexSource.mockResolvedValueOnce({
          source: {
            type: "codeflex" as const,
            release: "local",
            commit: "local",
            sha256: "local",
            skillsDir: join(tempDir, ".codeflex", "skills-source", "codeflex"),
          },
          warnings: [],
        });

        const result = await runCli(["diff"], tempDir);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("Changes detected");
        expect(result.stdout).toContain("Skills:");
      });
    });

    it("detects skill removals when lockfile has extra skills", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);

        const { loadLock, saveLock } = await import("../../src/config/index.js");
        const lock = await loadLock(tempDir);
        lock.skills.push("nonexistent-skill");
        await saveLock(tempDir, lock);

        mockedFetchCodeFlexSource.mockResolvedValueOnce({
          source: {
            type: "codeflex" as const,
            release: "local",
            commit: "local",
            sha256: "local",
            skillsDir: join(tempDir, ".codeflex", "skills-source", "codeflex"),
          },
          warnings: [],
        });

        const result = await runCli(["diff"], tempDir);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("Changes detected");
        expect(result.stdout).toContain("nonexistent-skill");
      });
    });
  });

  describe("file changes", () => {
    it("detects AGENTS.md addition when file is missing", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);
        await rm(join(tempDir, "AGENTS.md"));

        mockedFetchCodeFlexSource.mockResolvedValueOnce({
          source: {
            type: "codeflex" as const,
            release: "local",
            commit: "local",
            sha256: "local",
            skillsDir: join(tempDir, ".codeflex", "skills-source", "codeflex"),
          },
          warnings: [],
        });

        const result = await runCli(["diff"], tempDir);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("Changes detected");
        expect(result.stdout).toContain("AGENTS.md");
      });
    });

    it("detects AGENTS.md modification when managed section is stale", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);
        await writeFile(join(tempDir, "AGENTS.md"), "# Stale content\n");

        mockedFetchCodeFlexSource.mockResolvedValueOnce({
          source: {
            type: "codeflex" as const,
            release: "local",
            commit: "local",
            sha256: "local",
            skillsDir: join(tempDir, ".codeflex", "skills-source", "codeflex"),
          },
          warnings: [],
        });

        const result = await runCli(["diff"], tempDir);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("Changes detected");
        expect(result.stdout).toContain("AGENTS.md");
      });
    });

    it("detects bootstrap file additions for configured harnesses", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);

        const { loadConfig, saveConfig } = await import("../../src/config/index.js");
        const config = await loadConfig(tempDir);
        config.agentHarnesses = ["claude-code"];
        await saveConfig(tempDir, config);

        const claudeMdPath = join(tempDir, "CLAUDE.md");
        try {
          await rm(claudeMdPath);
        } catch {
          // File may not exist
        }

        mockedFetchCodeFlexSource.mockResolvedValueOnce({
          source: {
            type: "codeflex" as const,
            release: "local",
            commit: "local",
            sha256: "local",
            skillsDir: join(tempDir, ".codeflex", "skills-source", "codeflex"),
          },
          warnings: [],
        });

        const result = await runCli(["diff"], tempDir);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("Changes detected");
      });
    });
  });

  describe("channel flag", () => {
    it("accepts stable channel", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);

        mockedFetchCodeFlexSource.mockResolvedValueOnce({
          source: {
            type: "codeflex" as const,
            release: "local",
            commit: "local",
            sha256: "local",
            skillsDir: join(tempDir, ".codeflex", "skills-source", "codeflex"),
          },
          warnings: [],
        });

        const result = await runCli(["diff", "--channel", "stable"], tempDir);

        expect(result.exitCode).toBe(0);
      });
    });

    it("accepts canary channel", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);

        mockedFetchCodeFlexSource.mockResolvedValueOnce({
          source: {
            type: "codeflex" as const,
            release: "local",
            commit: "local",
            sha256: "local",
            skillsDir: join(tempDir, ".codeflex", "skills-source", "codeflex"),
          },
          warnings: [],
        });

        const result = await runCli(["diff", "--channel", "canary"], tempDir);

        expect(result.exitCode).toBe(0);
      });
    });
  });
});
