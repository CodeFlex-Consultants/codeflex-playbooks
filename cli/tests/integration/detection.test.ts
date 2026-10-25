import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { detectProject } from "../../src/detection/index";

const fixturesDir = join(import.meta.dirname, "../fixtures");

function fixturePath(name: string): string {
  return join(fixturesDir, name);
}

describe("integration: detection across fixtures", () => {
  describe("greenfield-dotnet-angular", () => {
    it("detects .NET, ASP.NET Core, Angular, and EF Core", async () => {
      const result = await detectProject(fixturePath("greenfield-dotnet-angular"));
      const techNames = result.technologies.map((t) => t.name);

      expect(techNames).toContain("dotnet");
      expect(techNames).toContain("aspnet-core");
      expect(techNames).toContain("angular");
      expect(techNames).toContain("entity-framework-core");

      const dotnet = result.technologies.find((t) => t.name === "dotnet" && t.version);
      expect(dotnet?.version).toBe("8.0");

      const efCore = result.technologies.find((t) => t.name === "entity-framework-core");
      expect(efCore?.version).toBe("8.0.2");

      const angular = result.technologies.find((t) => t.name === "angular" && t.version);
      expect(angular?.version).toBe("20.0.0");
    });

    it("assigns correct scopes for backend and frontend", async () => {
      const result = await detectProject(fixturePath("greenfield-dotnet-angular"));

      expect(result.scopes["dotnet"]).toBeDefined();
      expect(result.scopes["dotnet"].some((s) => s.includes("src/Backend"))).toBe(true);

      expect(result.scopes["angular"]).toBeDefined();
      expect(result.scopes["angular"].some((s) => s.includes("src/Frontend"))).toBe(true);
    });
  });

  describe("existing-client-project", () => {
    it("detects .NET and ASP.NET Core", async () => {
      const result = await detectProject(fixturePath("existing-client-project"));
      const techNames = result.technologies.map((t) => t.name);

      expect(techNames).toContain("dotnet");
      expect(techNames).toContain("aspnet-core");
    });

    it("does not detect frontend technologies", async () => {
      const result = await detectProject(fixturePath("existing-client-project"));
      const techNames = result.technologies.map((t) => t.name);

      expect(techNames).not.toContain("angular");
      expect(techNames).not.toContain("react");
    });
  });

  describe("conflicting-standards", () => {
    it("detects .NET and ASP.NET Core", async () => {
      const result = await detectProject(fixturePath("conflicting-standards"));
      const techNames = result.technologies.map((t) => t.name);

      expect(techNames).toContain("dotnet");
      expect(techNames).toContain("aspnet-core");
    });
  });

  describe("monorepo-integration", () => {
    it("detects multiple technologies with correct scopes", async () => {
      const result = await detectProject(fixturePath("monorepo-integration"));
      const techNames = result.technologies.map((t) => t.name);

      expect(techNames).toContain("dotnet");
      expect(techNames).toContain("angular");
      expect(techNames).toContain("react-native");
      expect(techNames).toContain("entity-framework-core");
    });

    it("assigns scopes per technology", async () => {
      const result = await detectProject(fixturePath("monorepo-integration"));

      expect(result.scopes["dotnet"]).toBeDefined();
      expect(result.scopes["dotnet"]).toContain("src/backend/**");

      expect(result.scopes["angular"]).toBeDefined();
      expect(result.scopes["angular"]).toContain("src/web/**");

      expect(result.scopes["react-native"]).toBeDefined();
      expect(result.scopes["react-native"]).toContain("src/mobile/**");
    });
  });
});
