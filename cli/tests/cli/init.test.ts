import { describe, it, expect, vi, beforeEach } from "vitest";
import { join } from "node:path";
import { readdir, rm, cp } from "node:fs/promises";
import { runCli, withTempFixture, resolveProjectionPath } from "./cli-helpers";
import { pathExists } from "../../src/utils/fs";

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
  detectHarnesses: vi.fn(async () => []),
}));

import { fetchCodeFlexSource } from "../../src/skills/source-fetcher";

const mockedFetchCodeFlexSource = vi.mocked(fetchCodeFlexSource);

async function prepareGreenfieldDir(tempDir: string): Promise<string> {
  const originalSkillsSource = join(tempDir, ".codeflex", "skills-source");
  const savedSkillsSource = join(tempDir, "_skills-source");
  await cp(originalSkillsSource, savedSkillsSource, { recursive: true });
  await rm(join(tempDir, ".codeflex"), { recursive: true, force: true });
  return join(savedSkillsSource, "codeflex");
}

describe("CLI: init command", () => {
  beforeEach(() => {
    mockedFetchCodeFlexSource.mockReset();
  });

  describe("greenfield-dotnet-angular", () => {
    it("creates .codeflex directory with config and lock", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        const skillsSourceDir = await prepareGreenfieldDir(tempDir);

        mockedFetchCodeFlexSource.mockResolvedValueOnce({
          source: {
            type: "codeflex" as const,
            release: "local",
            commit: "local",
            sha256: "local",
            skillsDir: skillsSourceDir,
          },
          warnings: [],
        });

        const result = await runCli(["init"], tempDir);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("Initialization complete!");
        expect(await pathExists(join(tempDir, ".codeflex", "engineering.yaml"))).toBe(true);
        expect(await pathExists(join(tempDir, ".codeflex", "engineering.lock"))).toBe(true);
      });
    });

    it("installs skills to .codeflex/skills/", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        const skillsSourceDir = await prepareGreenfieldDir(tempDir);

        mockedFetchCodeFlexSource.mockResolvedValueOnce({
          source: {
            type: "codeflex" as const,
            release: "local",
            commit: "local",
            sha256: "local",
            skillsDir: skillsSourceDir,
          },
          warnings: [],
        });

        const result = await runCli(["init"], tempDir);

        expect(result.exitCode).toBe(0);

        const installedSkills = await readdir(join(tempDir, ".codeflex", "skills"));
        expect(installedSkills).toContain("codeflex-dotnet");
        expect(installedSkills).toContain("codeflex-angular");
        expect(installedSkills).toContain("codeflex-security");
      });
    });

    it("creates AGENTS.md with managed section", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        const skillsSourceDir = await prepareGreenfieldDir(tempDir);

        mockedFetchCodeFlexSource.mockResolvedValueOnce({
          source: {
            type: "codeflex" as const,
            release: "local",
            commit: "local",
            sha256: "local",
            skillsDir: skillsSourceDir,
          },
          warnings: [],
        });

        await runCli(["init"], tempDir);

        expect(await pathExists(join(tempDir, "AGENTS.md"))).toBe(true);
      });
    });

    it("creates projections for configured harnesses", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        const skillsSourceDir = await prepareGreenfieldDir(tempDir);

        mockedFetchCodeFlexSource.mockResolvedValueOnce({
          source: {
            type: "codeflex" as const,
            release: "local",
            commit: "local",
            sha256: "local",
            skillsDir: skillsSourceDir,
          },
          warnings: [],
        });

        await runCli(["init"], tempDir);

        expect(await pathExists(resolveProjectionPath("~/.agents/skills", tempDir))).toBe(true);
        expect(await pathExists(resolveProjectionPath("~/.claude/skills", tempDir))).toBe(true);
      });
    });
  });

  describe("error cases", () => {
    it("fails when already initialized", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        const skillsSourceDir = await prepareGreenfieldDir(tempDir);

        mockedFetchCodeFlexSource.mockResolvedValue({
          source: {
            type: "codeflex" as const,
            release: "local",
            commit: "local",
            sha256: "local",
            skillsDir: skillsSourceDir,
          },
          warnings: [],
        });

        await runCli(["init"], tempDir);

        const result = await runCli(["init"], tempDir);

        expect(result.exitCode).not.toBe(0);
        expect(result.error).toBeDefined();
      });
    });

    it("reinitializes with --force", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        const skillsSourceDir = await prepareGreenfieldDir(tempDir);

        mockedFetchCodeFlexSource.mockResolvedValue({
          source: {
            type: "codeflex" as const,
            release: "local",
            commit: "local",
            sha256: "local",
            skillsDir: skillsSourceDir,
          },
          warnings: [],
        });

        await runCli(["init"], tempDir);

        const result = await runCli(["init", "--force"], tempDir);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("Reinitializing");
      });
    });

    it("does not create files with --dry-run", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        const skillsSourceDir = await prepareGreenfieldDir(tempDir);

        mockedFetchCodeFlexSource.mockResolvedValueOnce({
          source: {
            type: "codeflex" as const,
            release: "local",
            commit: "local",
            sha256: "local",
            skillsDir: skillsSourceDir,
          },
          warnings: [],
        });

        const result = await runCli(["init", "--dry-run"], tempDir);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("Dry run");
        expect(await pathExists(join(tempDir, ".codeflex", "engineering.yaml"))).toBe(false);
      });
    });

    it("rejects invalid channel", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await prepareGreenfieldDir(tempDir);

        const result = await runCli(["init", "--channel", "invalid"], tempDir);

        expect(result.exitCode).not.toBe(0);
      });
    });
  });
});
