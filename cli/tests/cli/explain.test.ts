import { describe, it, expect } from "vitest";
import { runCli, withTempFixture, setupInitializedProject } from "./cli-helpers";

describe("CLI: explain command", () => {
  describe("not initialized", () => {
    it("fails when not initialized", async () => {
      await withTempFixture("empty", async (tempDir) => {
        const result = await runCli(["explain"], tempDir);

        expect(result.exitCode).not.toBe(0);
        expect(result.error).toBeDefined();
      });
    });
  });

  describe("initialized project", () => {
    it("lists all installed skills when no target given", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        const { skillIds } = await setupInitializedProject(tempDir);

        const result = await runCli(["explain"], tempDir);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("Installed Skills");
        for (const id of skillIds) {
          expect(result.stdout).toContain(id);
        }
      });
    });

    it("explains a specific skill", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        const { skillIds } = await setupInitializedProject(tempDir);
        const skillId = skillIds[0];

        const result = await runCli(["explain", skillId], tempDir);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain(`Skill: ${skillId}`);
        expect(result.stdout).toContain("Source:");
        expect(result.stdout).toContain("Reason:");
      });
    });

    it("fails for unknown skill", async () => {
      await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        await setupInitializedProject(tempDir);

        const result = await runCli(["explain", "nonexistent-skill"], tempDir);

        expect(result.exitCode).not.toBe(0);
      });
    });
  });
});
