import { describe, it, expect } from "vitest";
import { runCli, withTempFixture, setupInitializedProject } from "./cli-helpers";

describe("CLI: status command", () => {
  describe("not initialized", () => {
    it("shows Not initialized in human-readable format", async () => {
      await withTempFixture("empty", async (tempDir) => {
        const result = await runCli(["status"], tempDir);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("Not initialized");
        expect(result.stdout).toContain("CLI version:");
      });
    });

    it("returns JSON with initialized: false", async () => {
      await withTempFixture("empty", async (tempDir) => {
        const result = await runCli(["status", "--json"], tempDir);

        expect(result.exitCode).toBe(0);
        const parsed = JSON.parse(result.stdout.trim());
        expect(parsed.initialized).toBe(false);
        expect(parsed.cliVersion).toBeDefined();
      });
    });
  });

  describe("initialized", () => {
    it("shows Initialized status", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);

        const result = await runCli(["status"], tempDir);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("Initialized");
        expect(result.stdout).toContain("CLI version:");
        expect(result.stdout).toContain("Configuration:");
        expect(result.stdout).toContain("Lock:");
      });
    });

    it("shows skill and projection counts", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);

        const result = await runCli(["status"], tempDir);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("Skills:");
        expect(result.stdout).toContain("Projections:");
      });
    });

    it("returns full JSON status", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);

        const result = await runCli(["status", "--json"], tempDir);

        expect(result.exitCode).toBe(0);
        const parsed = JSON.parse(result.stdout.trim());
        expect(parsed.initialized).toBe(true);
        expect(parsed.cliVersion).toBeDefined();
        expect(parsed.config).toBeDefined();
        expect(parsed.config.harnesses).toBeDefined();
        expect(parsed.lock).toBeDefined();
        expect(parsed.lock.skills).toBeGreaterThan(0);
        expect(parsed.engineeringSkills).toBeDefined();
        expect(parsed.engineeringSkills.codeflex).toBeDefined();
      });
    });
  });
});
