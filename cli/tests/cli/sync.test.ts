import { describe, it, expect, vi, beforeEach } from "vitest";
import { join } from "node:path";
import { runCli, withTempFixture, setupInitializedProject } from "./cli-helpers";
import { pathExists } from "../../src/utils/fs";
import { loadConfig, loadLock } from "../../src/config/index";
import { AgentHarness } from "../../src/types/index";

vi.mock("../../src/detection/harness/index.js", () => ({
  detectHarnesses: vi.fn(),
}));

import { detectHarnesses } from "../../src/detection/harness/index";
import { DetectionConfidence, SurfaceType } from "../../src/detection/harness/types";

const mockedDetectHarnesses = vi.mocked(detectHarnesses);

describe("CLI: sync command", () => {
  beforeEach(() => {
    mockedDetectHarnesses.mockReset();
    mockedDetectHarnesses.mockResolvedValue([]);
  });

  describe("with initialized project", () => {
    it("syncs successfully and outputs Sync complete", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);

        const result = await runCli(["sync"], tempDir);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("Sync complete!");
      });
    });

    it("preserves installed skills after sync", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        const { skillIds } = await setupInitializedProject(tempDir);

        const result = await runCli(["sync"], tempDir);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain(`Skills synced: ${skillIds.length}`);
      });
    });

    it("updates AGENTS.md during sync", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);

        await runCli(["sync"], tempDir);

        expect(await pathExists(join(tempDir, "AGENTS.md"))).toBe(true);
      });
    });

    it("preserves crossCuttingSkills in the lock file after sync (regression: sync must not reset cross-cutting classification to empty)", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);

        const lockBefore = await loadLock(tempDir);
        expect(lockBefore).not.toBeNull();
        expect(lockBefore!.crossCuttingSkills?.length ?? 0).toBeGreaterThan(0);
        const crossCuttingBefore = [...(lockBefore!.crossCuttingSkills ?? [])].sort();

        const result = await runCli(["sync"], tempDir);
        expect(result.exitCode).toBe(0);

        const lockAfter = await loadLock(tempDir);
        expect(lockAfter).not.toBeNull();
        const crossCuttingAfter = [...(lockAfter!.crossCuttingSkills ?? [])].sort();

        expect(crossCuttingAfter).toEqual(crossCuttingBefore);
        expect(crossCuttingAfter.length).toBeGreaterThan(0);
      });
    });
  });

  describe("error cases", () => {
    it("fails when not initialized", async () => {
      await withTempFixture("empty", async (tempDir) => {
        const result = await runCli(["sync"], tempDir);

        expect(result.exitCode).not.toBe(0);
        expect(result.error).toBeDefined();
      });
    });

    it("dry run does not modify files", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);

        const result = await runCli(["sync", "--dry-run"], tempDir);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("Dry run");
      });
    });
  });

  describe("harness auto-detection", () => {
    it("re-detects harnesses when autoDetect is true", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);

        mockedDetectHarnesses.mockResolvedValueOnce([
          {
            harness: AgentHarness.ClaudeCode,
            surfaces: [SurfaceType.CLI],
            confidence: DetectionConfidence.High,
            evidence: [],
          },
          {
            harness: AgentHarness.Cursor,
            surfaces: [SurfaceType.AppBundle],
            confidence: DetectionConfidence.High,
            evidence: [],
          },
        ]);

        const result = await runCli(["sync"], tempDir);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("Re-detecting harnesses");

        const config = await loadConfig(tempDir);
        expect(config).not.toBeNull();
        expect(config!.agentHarnesses).toContain(AgentHarness.ClaudeCode);
        expect(config!.agentHarnesses).toContain(AgentHarness.Cursor);
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

        const result = await runCli(["sync"], tempDir);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain("Re-detecting harnesses");

        const configAfter = await loadConfig(tempDir);
        expect(configAfter!.agentHarnesses).toEqual(originalHarnesses);
      });
    });

    it("logs when harnesses are added", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);

        const config = await loadConfig(tempDir);
        const updatedConfig = { ...config!, agentHarnesses: [] };
        const { saveConfig } = await import("../../src/config/index.js");
        await saveConfig(tempDir, updatedConfig);

        mockedDetectHarnesses.mockResolvedValueOnce([
          {
            harness: AgentHarness.Codex,
            surfaces: [SurfaceType.CLI],
            confidence: DetectionConfidence.High,
            evidence: [],
          },
        ]);

        const result = await runCli(["sync"], tempDir);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("Added harnesses");
        expect(result.stdout).toContain("Updated agentHarnesses");
      });
    });

    it("keeps existing harnesses when detection finds nothing (not treated as removal)", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        const { config: originalConfig } = await setupInitializedProject(tempDir);

        mockedDetectHarnesses.mockResolvedValueOnce([]);

        const result = await runCli(["sync"], tempDir);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("configured in agentHarnesses but not detected this run");
        expect(result.stdout).not.toContain("Updated agentHarnesses");

        const config = await loadConfig(tempDir);
        expect(config!.agentHarnesses).toEqual(originalConfig.agentHarnesses);
      });
    });

    it("logs when no harness changes detected", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        const { config } = await setupInitializedProject(tempDir);

        mockedDetectHarnesses.mockResolvedValueOnce(
          config.agentHarnesses.map((h) => ({
            harness: h,
            surfaces: [SurfaceType.CLI],
            confidence: DetectionConfidence.High,
            evidence: [],
          })),
        );

        const result = await runCli(["sync"], tempDir);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("No new harnesses detected");
      });
    });
  });
});
