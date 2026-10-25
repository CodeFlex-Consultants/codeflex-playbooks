import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { rm, mkdir, writeFile } from "node:fs/promises";
import { runCli, withTempFixture, setupInitializedProject } from "./cli-helpers";

describe("CLI: doctor command", () => {
  describe("healthy project", () => {
    it("reports no errors on a properly initialized project", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);

        const result = await runCli(["doctor"], tempDir);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain("Errors:");
      });
    });

    it("returns JSON with ok: true for healthy project", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);

        const result = await runCli(["doctor", "--json"], tempDir);

        expect(result.exitCode).toBe(0);
        const parsed = JSON.parse(result.stdout.trim());
        expect(parsed.ok).toBe(true);
        expect(parsed.findings).toBeDefined();
        expect(parsed.summary).toBeDefined();
        expect(parsed.summary.errors).toBe(0);
      });
    });
  });

  describe("missing .codeflex directory", () => {
    it("reports error when .codeflex/ does not exist", async () => {
      await withTempFixture("empty", async (tempDir) => {
        const result = await runCli(["doctor"], tempDir);

        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain(".codeflex/ directory does not exist");
      });
    });

    it("reports error in JSON output", async () => {
      await withTempFixture("empty", async (tempDir) => {
        const result = await runCli(["doctor", "--json"], tempDir);

        const parsed = JSON.parse(result.stdout.trim());
        expect(parsed.ok).toBe(false);
        expect(parsed.summary.errors).toBeGreaterThan(0);
      });
    });
  });

  describe("missing AGENTS.md", () => {
    it("reports error and suggests fix", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);
        await rm(join(tempDir, "AGENTS.md"));

        const result = await runCli(["doctor"], tempDir);

        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain("AGENTS.md does not exist");
        expect(result.stdout).toContain("Fix:");
      });
    });

    it("auto-fixes missing AGENTS.md with --fix", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);
        await rm(join(tempDir, "AGENTS.md"));

        const result = await runCli(["doctor", "--fix"], tempDir);

        expect(result.stdout).toContain("AGENTS.md managed section updated");
      });
    });
  });

  describe("orphaned skills", () => {
    it("warns about orphaned skills in .codeflex/skills/", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);

        const orphanDir = join(tempDir, ".codeflex", "skills", "orphaned-skill");
        await mkdir(orphanDir, { recursive: true });
        await writeFile(join(orphanDir, "SKILL.md"), "orphaned");

        const result = await runCli(["doctor"], tempDir);

        expect(result.stdout).toContain("Orphaned skills");
        expect(result.stdout).toContain("orphaned-skill");
      });
    });

    it("removes orphaned skills with --fix", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);

        const orphanDir = join(tempDir, ".codeflex", "skills", "orphaned-skill");
        await mkdir(orphanDir, { recursive: true });
        await writeFile(join(orphanDir, "SKILL.md"), "orphaned");

        const result = await runCli(["doctor", "--fix", "--yes"], tempDir);

        expect(result.stdout).toContain("Removed 1 orphaned skill");
      });
    });
  });

  describe("JSON output", () => {
    it("includes summary with counts", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);

        const result = await runCli(["doctor", "--json"], tempDir);

        const parsed = JSON.parse(result.stdout.trim());
        expect(parsed.summary).toBeDefined();
        expect(typeof parsed.summary.errors).toBe("number");
        expect(typeof parsed.summary.warnings).toBe("number");
        expect(typeof parsed.summary.info).toBe("number");
        expect(typeof parsed.summary.fixed).toBe("number");
      });
    });

    it("includes fix descriptions for fixable findings", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);
        await rm(join(tempDir, "AGENTS.md"));

        const result = await runCli(["doctor", "--json"], tempDir);

        const parsed = JSON.parse(result.stdout.trim());
        const agentsFinding = parsed.findings.find(
          (f: { check: string }) => f.check === "agents-md",
        );
        expect(agentsFinding).toBeDefined();
        expect(agentsFinding.fixable).toBe(true);
        expect(agentsFinding.fixDescription).toBeDefined();
      });
    });
  });

  describe("not initialized", () => {
    it("reports multiple errors when not initialized", async () => {
      await withTempFixture("empty", async (tempDir) => {
        const result = await runCli(["doctor"], tempDir);

        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain(".codeflex/ directory does not exist");
      });
    });
  });

  describe("deprecated config detection", () => {
    it("warns about legacy .cursorrules file", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);

        await writeFile(
          join(tempDir, ".cursorrules"),
          "legacy content",
        );

        const result = await runCli(["doctor"], tempDir);

        expect(result.stdout).toContain("deprecated");
      });
    });

    it("does not warn when no legacy scoped rules exist", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);

        const result = await runCli(["doctor", "--json"], tempDir);
        const parsed = JSON.parse(result.stdout.trim());

        const deprecatedFinding = parsed.findings.find(
          (f: { check: string }) => f.check === "deprecated-config",
        );
        expect(deprecatedFinding).toBeUndefined();
      });
    });
  });

  describe("missing skills detection", () => {
    it("reports error when lockfile references skills not installed", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);

        const { loadLock, saveLock } = await import("../../src/config/index.js");
        const lock = await loadLock(tempDir);
        lock.skills.push("phantom-skill");
        await saveLock(tempDir, lock);

        const result = await runCli(["doctor", "--json"], tempDir);
        const parsed = JSON.parse(result.stdout.trim());

        const missingFinding = parsed.findings.find(
          (f: { check: string }) => f.check === "missing-skills",
        );
        expect(missingFinding).toBeDefined();
        expect(missingFinding.severity).toBe("error");
        expect(missingFinding.message).toContain("phantom-skill");
      });
    });

    it("missing skills are reported but not auto-fixable", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);

        const { loadLock, saveLock } = await import("../../src/config/index.js");
        const lock = await loadLock(tempDir);
        lock.skills.push("phantom-skill");
        await saveLock(tempDir, lock);

        const result = await runCli(["doctor", "--fix", "--json"], tempDir);
        const parsed = JSON.parse(result.stdout.trim());

        const missingFinding = parsed.findings?.find(
          (f: { check: string }) => f.check === "missing-skills",
        );
        expect(missingFinding).toBeDefined();
        expect(missingFinding.fixable).toBe(false);
        expect(missingFinding.fixDescription).toContain("sync");

        const missingFix = parsed.fixes?.find(
          (f: { check: string }) => f.check === "missing-skills",
        );
        expect(missingFix).toBeUndefined();
      });
    });
  });

  describe("lockfile consistency", () => {
    it("reports error when lockfile is missing", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);
        await rm(join(tempDir, ".codeflex", "engineering.lock"));

        const result = await runCli(["doctor", "--json"], tempDir);
        const parsed = JSON.parse(result.stdout.trim());

        const lockFinding = parsed.findings.find(
          (f: { check: string }) => f.check === "lockfile",
        );
        expect(lockFinding).toBeDefined();
        expect(lockFinding.severity).toBe("error");
      });
    });

    it("reports error when engineering.yaml is missing", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);
        await rm(join(tempDir, ".codeflex", "engineering.yaml"));

        const result = await runCli(["doctor", "--json"], tempDir);
        const parsed = JSON.parse(result.stdout.trim());

        const configFinding = parsed.findings.find(
          (f: { check: string }) => f.check === "engineering-config",
        );
        expect(configFinding).toBeDefined();
        expect(configFinding.severity).toBe("error");
      });
    });
  });

  describe("global AGENTS.md check", () => {
    it("reports info when ~/.agents/ exists but AGENTS.md does not", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);

        const { fakeHomeFor } = await import("../helpers.js");
        const fakeHome = fakeHomeFor(tempDir);
        const agentsDir = join(fakeHome, ".agents");
        await mkdir(agentsDir, { recursive: true });
        await rm(join(agentsDir, "AGENTS.md"), { force: true });

        const result = await runCli(["doctor", "--json"], tempDir);
        const parsed = JSON.parse(result.stdout.trim());

        const globalFinding = parsed.findings.find(
          (f: { check: string }) => f.check === "global-agents-md",
        );
        expect(globalFinding).toBeDefined();
        expect(globalFinding.severity).toBe("info");
      });
    });
  });

  describe("fix error paths", () => {
    it("fixAgentsMd is not attempted when lockfile is unavailable", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);
        await rm(join(tempDir, "AGENTS.md"));
        await rm(join(tempDir, ".codeflex", "engineering.lock"));

        const result = await runCli(["doctor", "--fix", "--json"], tempDir);
        const parsed = JSON.parse(result.stdout.trim());

        const agentsFinding = parsed.findings?.find(
          (f: { check: string }) => f.check === "agents-md",
        );
        expect(agentsFinding).toBeDefined();
        expect(agentsFinding.fixable).toBe(false);

        const agentsFix = parsed.fixes?.find(
          (f: { check: string }) => f.check === "agents-md",
        );
        expect(agentsFix).toBeUndefined();
      });
    });

    it("fixOrphanedSkills succeeds when orphaned skills exist", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);

        const orphanDir = join(tempDir, ".codeflex", "skills", "orphaned-skill");
        await mkdir(orphanDir, { recursive: true });
        await writeFile(join(orphanDir, "SKILL.md"), "orphaned");

        const result = await runCli(["doctor", "--fix", "--json", "--yes"], tempDir);
        const parsed = JSON.parse(result.stdout.trim());

        const orphanFix = parsed.fixes?.find(
          (f: { check: string }) => f.check === "orphaned-skills",
        );
        expect(orphanFix).toBeDefined();
        expect(orphanFix.success).toBe(true);
      });
    });
  });
});
