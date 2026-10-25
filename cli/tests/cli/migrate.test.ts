import { describe, it, expect, vi, beforeEach } from "vitest";
import { join } from "node:path";
import { writeFile, readFile } from "node:fs/promises";
import { runCli, withTempFixture, setupInitializedProject } from "./cli-helpers";
import { AgentHarness } from "../../src/types/index";
import { saveConfig, loadConfig } from "../../src/config/index";

import {
  HarnessMigrationStrategy,
  ConventionMigrationStrategy,
  GlobalAdoptionStrategy,
  selectStrategy,
  resolveHarnessName,
  type MigrationContext,
} from "../../src/cli/migration-strategies";

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

import { detectHarnesses } from "../../src/detection/harness/index";

const mockedDetectHarnesses = vi.mocked(detectHarnesses);

describe("CLI: migrate command", () => {
  beforeEach(() => {
    mockedDetectHarnesses.mockReset();
    mockedDetectHarnesses.mockResolvedValue([]);
  });

  describe("command registration", () => {
    it("is registered as a command", async () => {
      await withTempFixture("empty", async (tempDir) => {
        const result = await runCli(["--help"], tempDir);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("migrate");
        expect(result.stdout).toContain("Migrate project harness configuration");
      });
    });
  });

  describe("--check flag", () => {
    it("reports not initialized when no config exists", async () => {
      await withTempFixture("empty", async (tempDir) => {
        const result = await runCli(["migrate", "--check"], tempDir);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("Not initialized");
      });
    });

    it("reports no migration needed for initialized project without changes", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);

        const result = await runCli(["migrate", "--check"], tempDir);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("No migration needed");
      });
    });
  });

  describe("--from and --to flags", () => {
    it("shows dry-run plan for harness migration", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);

        const config = await loadConfig(tempDir);
        if (config) {
          await saveConfig(tempDir, { ...config, agentHarnesses: [AgentHarness.ClaudeCode] });
        }

        const result = await runCli(["migrate", "--from", "claude-code", "--to", "kilo"], tempDir);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("Dry run");
        expect(result.stdout).toContain("harness-to-harness");
      });
    });

    it("applies migration with --apply flag", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);

        const config = await loadConfig(tempDir);
        if (config) {
          await saveConfig(tempDir, { ...config, agentHarnesses: [AgentHarness.ClaudeCode] });
        }

        const result = await runCli(
          ["migrate", "--from", "claude-code", "--to", "kilo", "--apply"],
          tempDir,
        );

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("Migration applied");

        const updatedConfig = await loadConfig(tempDir);
        expect(updatedConfig?.agentHarnesses).toContain(AgentHarness.Kilo);
        expect(updatedConfig?.agentHarnesses).not.toContain(AgentHarness.ClaudeCode);
      });
    });

    it("rejects unknown harness names", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);

        const result = await runCli(["migrate", "--from", "unknown-harness", "--to", "kilo"], tempDir);

        expect(result.exitCode).not.toBe(0);
      });
    });
  });

  describe("convention migration", () => {
    it("updates bootstrap file to current convention", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);

        const config = await loadConfig(tempDir);
        if (config) {
          await saveConfig(tempDir, { ...config, agentHarnesses: [AgentHarness.ClaudeCode] });
        }

        const claudMdPath = join(tempDir, "CLAUDE.md");
        await writeFile(claudMdPath, "# Old content\n", "utf-8");

        const result = await runCli(
          ["migrate", "--from", "claude-code", "--to", "claude-code", "--apply"],
          tempDir,
        );

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("Migration applied");

        const updatedContent = await readFile(claudMdPath, "utf-8");
        expect(updatedContent).toContain("@AGENTS.md");
      });
    });
  });
});

describe("Migration strategies", () => {
  describe("HarnessMigrationStrategy", () => {
    const strategy = new HarnessMigrationStrategy();

    it("handles different from and to harnesses", () => {
      const context: MigrationContext = {
        projectRoot: "/tmp/test",
        from: AgentHarness.ClaudeCode,
        to: AgentHarness.Kilo,
        config: null,
      };

      expect(strategy.canHandle(context)).toBe(true);
    });

    it("does not handle same from and to harnesses", () => {
      const context: MigrationContext = {
        projectRoot: "/tmp/test",
        from: AgentHarness.ClaudeCode,
        to: AgentHarness.ClaudeCode,
        config: null,
      };

      expect(strategy.canHandle(context)).toBe(false);
    });

    it("does not handle missing from or to", () => {
      const context: MigrationContext = {
        projectRoot: "/tmp/test",
        from: AgentHarness.ClaudeCode,
        config: null,
      };

      expect(strategy.canHandle(context)).toBe(false);
    });
  });

  describe("ConventionMigrationStrategy", () => {
    const strategy = new ConventionMigrationStrategy();

    it("handles same from and to harnesses", () => {
      const context: MigrationContext = {
        projectRoot: "/tmp/test",
        from: AgentHarness.ClaudeCode,
        to: AgentHarness.ClaudeCode,
        config: null,
      };

      expect(strategy.canHandle(context)).toBe(true);
    });

    it("does not handle different harnesses", () => {
      const context: MigrationContext = {
        projectRoot: "/tmp/test",
        from: AgentHarness.ClaudeCode,
        to: AgentHarness.Kilo,
        config: null,
      };

      expect(strategy.canHandle(context)).toBe(false);
    });
  });

  describe("GlobalAdoptionStrategy", () => {
    const strategy = new GlobalAdoptionStrategy();

    it("handles missing from and to with config", () => {
      const context: MigrationContext = {
        projectRoot: "/tmp/test",
        config: {
          version: 1,
          autoDetect: true,
          agentHarnesses: [AgentHarness.Kilo],
          standards: { codeflex: { enabled: true } },
          include: [],
          exclude: [],
          scopes: {},
          exceptions: [],
        },
      };

      expect(strategy.canHandle(context)).toBe(true);
    });

    it("does not handle when from or to is specified", () => {
      const context: MigrationContext = {
        projectRoot: "/tmp/test",
        from: AgentHarness.ClaudeCode,
        config: {
          version: 1,
          autoDetect: true,
          agentHarnesses: [AgentHarness.Kilo],
          standards: { codeflex: { enabled: true } },
          include: [],
          exclude: [],
          scopes: {},
          exceptions: [],
        },
      };

      expect(strategy.canHandle(context)).toBe(false);
    });
  });

  describe("selectStrategy", () => {
    it("selects HarnessMigrationStrategy for different harnesses", () => {
      const context: MigrationContext = {
        projectRoot: "/tmp/test",
        from: AgentHarness.ClaudeCode,
        to: AgentHarness.Kilo,
        config: null,
      };

      const strategy = selectStrategy(context);
      expect(strategy).toBeInstanceOf(HarnessMigrationStrategy);
    });

    it("selects ConventionMigrationStrategy for same harnesses", () => {
      const context: MigrationContext = {
        projectRoot: "/tmp/test",
        from: AgentHarness.ClaudeCode,
        to: AgentHarness.ClaudeCode,
        config: null,
      };

      const strategy = selectStrategy(context);
      expect(strategy).toBeInstanceOf(ConventionMigrationStrategy);
    });

    it("selects GlobalAdoptionStrategy for no from/to with config", () => {
      const context: MigrationContext = {
        projectRoot: "/tmp/test",
        config: {
          version: 1,
          autoDetect: true,
          agentHarnesses: [AgentHarness.Kilo],
          standards: { codeflex: { enabled: true } },
          include: [],
          exclude: [],
          scopes: {},
          exceptions: [],
        },
      };

      const strategy = selectStrategy(context);
      expect(strategy).toBeInstanceOf(GlobalAdoptionStrategy);
    });

    it("returns null for no from/to without config", () => {
      const context: MigrationContext = {
        projectRoot: "/tmp/test",
        config: null,
      };

      const strategy = selectStrategy(context);
      expect(strategy).toBeNull();
    });
  });

  describe("resolveHarnessName", () => {
    it("resolves exact harness names", () => {
      expect(resolveHarnessName("claude-code")).toBe(AgentHarness.ClaudeCode);
      expect(resolveHarnessName("kilo")).toBe(AgentHarness.Kilo);
      expect(resolveHarnessName("codex")).toBe(AgentHarness.Codex);
    });

    it("resolves case-insensitively", () => {
      expect(resolveHarnessName("Claude-Code")).toBe(AgentHarness.ClaudeCode);
      expect(resolveHarnessName("KILO")).toBe(AgentHarness.Kilo);
    });

    it("resolves names without hyphens", () => {
      expect(resolveHarnessName("claudecode")).toBe(AgentHarness.ClaudeCode);
    });

    it("returns null for unknown harnesses", () => {
      expect(resolveHarnessName("unknown")).toBeNull();
      expect(resolveHarnessName("")).toBeNull();
    });
  });
});
