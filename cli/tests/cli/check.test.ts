import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { rm } from "node:fs/promises";
import { runCli, withTempFixture, setupInitializedProject } from "./cli-helpers";

describe("CLI: check command", () => {
  describe("valid state", () => {
    it("passes check on a properly initialized project", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);

        const result = await runCli(["check"], tempDir);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("Check passed!");
      });
    });

    it("reports skill count and projection count", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);

        const result = await runCli(["check"], tempDir);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("Skills:");
        expect(result.stdout).toContain("Projections:");
        expect(result.stdout).toContain("AGENTS.md:");
      });
    });
  });

  describe("invalid state", () => {
    it("fails when AGENTS.md is missing", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);

        await rm(join(tempDir, "AGENTS.md"));

        const result = await runCli(["check"], tempDir);

        expect(result.exitCode).toBe(2);
        expect(result.stdout).toContain("Check failed!");
        expect(result.stdout).toContain("AGENTS.md is missing");
      });
    });
  });

  describe("error cases", () => {
    it("fails when not initialized", async () => {
      await withTempFixture("empty", async (tempDir) => {
        const result = await runCli(["check"], tempDir);

        expect(result.exitCode).not.toBe(0);
        expect(result.error).toBeDefined();
      });
    });
  });
});
