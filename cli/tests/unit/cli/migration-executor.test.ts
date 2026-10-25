import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { withEmptyTempDir } from "../../helpers";
import { executeMigration } from "../../../src/cli/migration-executor";
import { MigrationStepType, type MigrationPlan } from "../../../src/cli/migration-strategies";
import type { Reporter } from "../../../src/cli/reporter";

function silentReporter(): Reporter {
  return {
    info: () => {},
    error: () => {},
    warn: () => {},
  } as unknown as Reporter;
}

describe("executeMigration rollback", () => {
  it("restores an already-existing file to its original content when a later step fails", async () => {
    await withEmptyTempDir(async (tempDir) => {
      const targetPath = "existing-file.txt";
      const fullPath = join(tempDir, targetPath);
      await writeFile(fullPath, "original content", "utf-8");

      const plan: MigrationPlan = {
        strategyName: "test",
        description: "test plan",
        hasChanges: true,
        steps: [
          {
            type: MigrationStepType.ModifyFile,
            description: "modify existing file",
            path: targetPath,
            content: "modified content",
          },
          {
            type: MigrationStepType.CreateFile,
            // Missing `path`/`content` on a real step would be a planning bug, but here we
            // simulate an unrelated mid-migration failure via a step whose target directory
            // cannot be created, to prove rollback restores the prior successful step.
            description: "force failure",
            path: "\0invalid/path.txt",
            content: "unreachable",
          },
        ],
      };

      await expect(executeMigration(tempDir, plan, null, silentReporter())).rejects.toThrow(
        /Migration failed and was rolled back/,
      );

      const restored = await readFile(fullPath, "utf-8");
      expect(restored).toBe("original content");
    });
  });

  it("removes a newly created file when a later step fails", async () => {
    await withEmptyTempDir(async (tempDir) => {
      const createdPath = "brand-new-file.txt";

      const plan: MigrationPlan = {
        strategyName: "test",
        description: "test plan",
        hasChanges: true,
        steps: [
          {
            type: MigrationStepType.CreateFile,
            description: "create new file",
            path: createdPath,
            content: "new content",
          },
          {
            type: MigrationStepType.CreateFile,
            description: "force failure",
            path: "\0invalid/path.txt",
            content: "unreachable",
          },
        ],
      };

      await expect(executeMigration(tempDir, plan, null, silentReporter())).rejects.toThrow(
        /Migration failed and was rolled back/,
      );

      await expect(readFile(join(tempDir, createdPath), "utf-8")).rejects.toThrow();
    });
  });

  it("restores a removed file when a later step fails", async () => {
    await withEmptyTempDir(async (tempDir) => {
      const targetPath = "removable.txt";
      const fullPath = join(tempDir, targetPath);
      await writeFile(fullPath, "keep me", "utf-8");

      const plan: MigrationPlan = {
        strategyName: "test",
        description: "test plan",
        hasChanges: true,
        steps: [
          {
            type: MigrationStepType.RemoveFile,
            description: "remove file",
            path: targetPath,
          },
          {
            type: MigrationStepType.CreateFile,
            description: "force failure",
            path: "\0invalid/path.txt",
            content: "unreachable",
          },
        ],
      };

      await expect(executeMigration(tempDir, plan, null, silentReporter())).rejects.toThrow(
        /Migration failed and was rolled back/,
      );

      const restored = await readFile(fullPath, "utf-8");
      expect(restored).toBe("keep me");
    });
  });

  it("returns all created backup paths when the migration succeeds", async () => {
    await withEmptyTempDir(async (tempDir) => {
      const targetPath = "success.txt";
      const fullPath = join(tempDir, targetPath);
      await writeFile(fullPath, "before", "utf-8");
      await mkdir(join(tempDir, ".codeflex"), { recursive: true });

      const plan: MigrationPlan = {
        strategyName: "test",
        description: "test plan",
        hasChanges: true,
        steps: [
          {
            type: MigrationStepType.ModifyFile,
            description: "modify file",
            path: targetPath,
            content: "after",
          },
        ],
      };

      const backups = await executeMigration(tempDir, plan, null, silentReporter());

      expect(backups).toHaveLength(1);
      const restored = await readFile(fullPath, "utf-8");
      expect(restored).toBe("after");
    });
  });
});
