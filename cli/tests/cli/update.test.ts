import { describe, it, expect, vi, beforeEach } from "vitest";
import { join } from "node:path";
import { runCli, withTempFixture, setupInitializedProject } from "./cli-helpers";
import { loadConfig } from "../../src/config/index";
import { AgentHarness } from "../../src/types/index";

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
import { DetectionConfidence, SurfaceType } from "../../src/detection/harness/types";

const mockedFetchCodeFlexSource = vi.mocked(fetchCodeFlexSource);
const mockedDetectHarnesses = vi.mocked(detectHarnesses);

describe("CLI: update command", () => {
  beforeEach(() => {
    mockedFetchCodeFlexSource.mockReset();
    mockedDetectHarnesses.mockReset();
    mockedDetectHarnesses.mockResolvedValue([]);
  });

  describe("with initialized project", () => {
    it("reports already up to date when sources unchanged", async () => {
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

        const result = await runCli(["update"], tempDir);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("Already up to date.");
      });
    });

    it("proceeds with update when source sha changes", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);

        const skillsSourceDir = join(tempDir, ".codeflex", "skills-source", "codeflex");
        mockedFetchCodeFlexSource.mockResolvedValueOnce({
          source: {
            type: "codeflex" as const,
            release: "local-v2",
            commit: "local-v2",
            sha256: "new-sha256",
            skillsDir: skillsSourceDir,
          },
          warnings: [],
        });

        const result = await runCli(["update"], tempDir);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("Resolving standards...");
      });
    });

    it("dry run reports without modifying files", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);

        mockedFetchCodeFlexSource.mockResolvedValueOnce({
          source: {
            type: "codeflex" as const,
            release: "local-v2",
            commit: "local-v2",
            sha256: "new-sha256",
            skillsDir: join(tempDir, ".codeflex", "skills-source", "codeflex"),
          },
          warnings: [],
        });

        const result = await runCli(["update", "--dry-run"], tempDir);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("Resolving standards...");
      });
    });
  });

  describe("error cases", () => {
    it("fails when not initialized", async () => {
      await withTempFixture("empty", async (tempDir) => {
        const result = await runCli(["update"], tempDir);

        expect(result.exitCode).not.toBe(0);
        expect(result.error).toBeDefined();
      });
    });

    it("rejects invalid channel", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);

        const result = await runCli(["update", "--channel", "invalid"], tempDir);

        expect(result.exitCode).not.toBe(0);
      });
    });

    it("fails when codeflex source fetch fails", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);

        mockedFetchCodeFlexSource.mockRejectedValueOnce(new Error("Network error"));

        const result = await runCli(["update"], tempDir);

        expect(result.exitCode).not.toBe(0);
        expect(result.error).toBeDefined();
      });
    });
  });

  describe("harness auto-detection", () => {
    it("re-detects harnesses when autoDetect is true", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);

        const skillsSourceDir = join(tempDir, ".codeflex", "skills-source", "codeflex");
        mockedFetchCodeFlexSource.mockResolvedValueOnce({
          source: {
            type: "codeflex" as const,
            release: "local-v2",
            commit: "local-v2",
            sha256: "new-sha256",
            skillsDir: skillsSourceDir,
          },
          warnings: [],
        });

        mockedDetectHarnesses.mockResolvedValueOnce([
          {
            harness: AgentHarness.ClaudeCode,
            surfaces: [SurfaceType.CLI],
            confidence: DetectionConfidence.High,
            evidence: [],
          },
          {
            harness: AgentHarness.OpenCode,
            surfaces: [SurfaceType.CLI],
            confidence: DetectionConfidence.High,
            evidence: [],
          },
        ]);

        const result = await runCli(["update"], tempDir);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("Re-detecting harnesses");

        const config = await loadConfig(tempDir);
        expect(config).not.toBeNull();
        expect(config!.agentHarnesses).toContain(AgentHarness.ClaudeCode);
        expect(config!.agentHarnesses).toContain(AgentHarness.OpenCode);
      });
    });

    it("does not re-detect harnesses when autoDetect is false", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);

        const config = await loadConfig(tempDir);
        const originalHarnesses = config!.agentHarnesses;

        const updatedConfig = { ...config!, autoDetect: false };
        const { saveConfig } = await import("../../src/config/index.js");
        await saveConfig(tempDir, updatedConfig);

        const skillsSourceDir = join(tempDir, ".codeflex", "skills-source", "codeflex");
        mockedFetchCodeFlexSource.mockResolvedValueOnce({
          source: {
            type: "codeflex" as const,
            release: "local-v2",
            commit: "local-v2",
            sha256: "new-sha256",
            skillsDir: skillsSourceDir,
          },
          warnings: [],
        });

        const result = await runCli(["update"], tempDir);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain("Re-detecting harnesses");

        const configAfter = await loadConfig(tempDir);
        expect(configAfter!.agentHarnesses).toEqual(originalHarnesses);
      });
    });

    it("logs harness changes during update", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);

        const config = await loadConfig(tempDir);
        const updatedConfig = { ...config!, agentHarnesses: [] };
        const { saveConfig } = await import("../../src/config/index.js");
        await saveConfig(tempDir, updatedConfig);

        const skillsSourceDir = join(tempDir, ".codeflex", "skills-source", "codeflex");
        mockedFetchCodeFlexSource.mockResolvedValueOnce({
          source: {
            type: "codeflex" as const,
            release: "local-v2",
            commit: "local-v2",
            sha256: "new-sha256",
            skillsDir: skillsSourceDir,
          },
          warnings: [],
        });

        mockedDetectHarnesses.mockResolvedValueOnce([
          {
            harness: AgentHarness.Codex,
            surfaces: [SurfaceType.CLI],
            confidence: DetectionConfidence.High,
            evidence: [],
          },
        ]);

        const result = await runCli(["update"], tempDir);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("Added harnesses");
        expect(result.stdout).toContain("Updated agentHarnesses");
      });
    });
  });
});
