import { describe, it, expect } from "vitest";
import { runCli, withTempFixture } from "./cli-helpers";

describe("CLI: detect command", () => {
  describe("greenfield-dotnet-angular fixture", () => {
    it("detects technologies in human-readable format", async () => {
      const result = await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        return runCli(["detect"], tempDir);
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Detected technologies:");
      expect(result.stdout).toContain("dotnet");
      expect(result.stdout).toContain("angular");
    });

    it("detects technologies in JSON format with --json", async () => {
      const result = await withTempFixture("greenfield-dotnet-angular", async (tempDir) => {
        return runCli(["detect", "--json"], tempDir);
      });

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout.trim());
      expect(parsed.technologies).toBeDefined();
      expect(Array.isArray(parsed.technologies)).toBe(true);

      const techNames = parsed.technologies.map((t: { name: string }) => t.name);
      expect(techNames).toContain("dotnet");
      expect(techNames).toContain("angular");
      expect(techNames).toContain("entity-framework-core");
    });
  });

  describe("empty fixture", () => {
    it("reports no technologies detected", async () => {
      const result = await withTempFixture("empty", async (tempDir) => {
        return runCli(["detect"], tempDir);
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("No technologies detected.");
    });

    it("returns empty technologies array in JSON", async () => {
      const result = await withTempFixture("empty", async (tempDir) => {
        return runCli(["detect", "--json"], tempDir);
      });

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout.trim());
      expect(parsed.technologies).toEqual([]);
    });
  });

  describe("react-app fixture", () => {
    it("detects React", async () => {
      const result = await withTempFixture("react-app", async (tempDir) => {
        return runCli(["detect"], tempDir);
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("react");
    });

    it("detects React in JSON format", async () => {
      const result = await withTempFixture("react-app", async (tempDir) => {
        return runCli(["detect", "--json"], tempDir);
      });

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout.trim());
      const techNames = parsed.technologies.map((t: { name: string }) => t.name);
      expect(techNames).toContain("react");
    });
  });

  describe("dotnet-api fixture", () => {
    it("detects .NET technologies", async () => {
      const result = await withTempFixture("dotnet-api", async (tempDir) => {
        return runCli(["detect", "--json"], tempDir);
      });

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout.trim());
      const techNames = parsed.technologies.map((t: { name: string }) => t.name);
      expect(techNames).toContain("dotnet");
    });
  });
});
