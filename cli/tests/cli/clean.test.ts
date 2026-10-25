import { describe, it, expect } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runCli, withTempFixture, setupInitializedProject, resolveProjectionPath } from "./cli-helpers";
import { runClean } from "../../src/cli/clean";
import { ConsoleReporter, Verbosity } from "../../src/cli/reporter";
import { pathExists } from "../../src/utils/fs";
import { calculateProjectionTopology } from "../../src/projection/topology";
import { getScopedRulesDir, SCOPED_FILE_PREFIX } from "../../src/projection/scoped-rules";
import { loadConfig, loadLock } from "../../src/config/index";
import { AgentHarness } from "../../src/types/index";

describe("CLI: clean command", () => {
  describe("not initialized", () => {
    it("exits with error when not initialized", async () => {
      await withTempFixture("empty", async (tempDir) => {
        const result = await runCli(["clean", "--yes"], tempDir);

        expect(result.exitCode).not.toBe(0);
        expect(result.error).toBeDefined();
      });
    });
  });

  describe("initialized with projections", () => {
    it("removes only managed skill directories and scoped rule files with --yes", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);

        const config = await loadConfig(tempDir);
        expect(config).not.toBeNull();

        const lock = await loadLock(tempDir);
        expect(lock).not.toBeNull();

        const topology = calculateProjectionTopology(config!.agentHarnesses);
        const managedProjections = lock!.managedProjections ?? {};

        for (const target of topology.targets) {
          const projectionPath = resolveProjectionPath(target.path, tempDir);
          const managedSkills = managedProjections[target.path] ?? [];
          
          for (const skillId of managedSkills) {
            const skillDir = join(projectionPath, skillId);
            expect(await pathExists(skillDir)).toBe(true);
          }

          const unmanagedDir = join(projectionPath, "user-installed-skill");
          await mkdir(unmanagedDir, { recursive: true });
          await writeFile(join(unmanagedDir, "SKILL.md"), "user content");
        }

        const rulesDirRel = getScopedRulesDir(AgentHarness.ClaudeCode);
        let scopedFile: string | undefined;
        if (rulesDirRel) {
          const rulesDir = join(tempDir, rulesDirRel);
          await mkdir(rulesDir, { recursive: true });
          scopedFile = join(rulesDir, `${SCOPED_FILE_PREFIX}test-path.md`);
          await writeFile(scopedFile, "test");
        }

        const reporter = new ConsoleReporter(Verbosity.Quiet);
        await runClean(tempDir, { yes: true, reporter });

        for (const target of topology.targets) {
          const projectionPath = resolveProjectionPath(target.path, tempDir);
          const managedSkills = managedProjections[target.path] ?? [];
          
          for (const skillId of managedSkills) {
            const skillDir = join(projectionPath, skillId);
            expect(await pathExists(skillDir)).toBe(false);
          }

          const unmanagedDir = join(projectionPath, "user-installed-skill");
          expect(await pathExists(unmanagedDir)).toBe(true);
          expect(await pathExists(projectionPath)).toBe(true);
        }

        if (scopedFile) {
          expect(await pathExists(scopedFile)).toBe(false);
        }
      });
    });

    it("--dry-run reports what would be removed without deleting", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);

        const config = await loadConfig(tempDir);
        const lock = await loadLock(tempDir);
        const topology = calculateProjectionTopology(config!.agentHarnesses);
        const managedProjections = lock!.managedProjections ?? {};

        const managedSkillPaths: string[] = [];
        for (const target of topology.targets) {
          const projectionPath = resolveProjectionPath(target.path, tempDir);
          const managedSkills = managedProjections[target.path] ?? [];
          for (const skillId of managedSkills) {
            managedSkillPaths.push(join(projectionPath, skillId));
          }
        }

        const result = await runCli(["clean", "--dry-run"], tempDir);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(/would remove/i);
        expect(result.stdout).toMatch(/dry run/i);

        for (const skillPath of managedSkillPaths) {
          expect(await pathExists(skillPath)).toBe(true);
        }
      });
    });

    it("handles already clean state gracefully", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);

        const config = await loadConfig(tempDir);
        const lock = await loadLock(tempDir);
        const topology = calculateProjectionTopology(config!.agentHarnesses);
        const managedProjections = lock!.managedProjections ?? {};

        for (const target of topology.targets) {
          const projectionPath = resolveProjectionPath(target.path, tempDir);
          const managedSkills = managedProjections[target.path] ?? [];
          for (const skillId of managedSkills) {
            const skillDir = join(projectionPath, skillId);
            const { rm } = await import("node:fs/promises");
            await rm(skillDir, { recursive: true, force: true });
          }
        }

        const reporter = new ConsoleReporter(Verbosity.Quiet);
        await runClean(tempDir, { yes: true, reporter });
      });
    });
  });
});
