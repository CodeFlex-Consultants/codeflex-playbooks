import { describe, it, expect } from "vitest";
import { matchesInstallConditions } from "../../../src/resolution/install-matcher";
import type { DetectionResult, InstallCondition } from "../../../src/types/index";

function makeDetection(overrides?: Partial<DetectionResult>): DetectionResult {
  return {
    technologies: [],
    scopes: {},
    capabilities: [],
    ...overrides,
  };
}

describe("matchesInstallConditions", () => {
  describe("detection metadata pattern matching", () => {
    it("matches ** /angular.json against a bare angular.json matchedBy", () => {
      const conditions: InstallCondition[] = [
        { file: { pattern: "**/angular.json" } },
      ];
      const detection = makeDetection({
        technologies: [
          { name: "angular", version: "17.0.0", matchedBy: "angular.json" },
        ],
      });

      expect(matchesInstallConditions(conditions, detection)).toBe(true);
    });

    it("matches ** /angular.json against a nested path matchedBy", () => {
      const conditions: InstallCondition[] = [
        { file: { pattern: "**/angular.json" } },
      ];
      const detection = makeDetection({
        technologies: [
          { name: "angular", version: "17.0.0", matchedBy: "src/frontend/angular.json" },
        ],
      });

      expect(matchesInstallConditions(conditions, detection)).toBe(true);
    });

    it("matches ** /*.csproj against a .csproj file path", () => {
      const conditions: InstallCondition[] = [
        { file: { pattern: "**/*.csproj" } },
      ];
      const detection = makeDetection({
        technologies: [
          { name: "dotnet", version: "8.0.0", matchedBy: "src/MyProject/MyProject.csproj" },
        ],
      });

      expect(matchesInstallConditions(conditions, detection)).toBe(true);
    });

    it("does not match ** /*.csproj against a non-csproj file", () => {
      const conditions: InstallCondition[] = [
        { file: { pattern: "**/*.csproj" } },
      ];
      const detection = makeDetection({
        technologies: [
          { name: "angular", version: "17.0.0", matchedBy: "angular.json" },
        ],
      });

      expect(matchesInstallConditions(conditions, detection)).toBe(false);
    });

    it("does not match when matchedBy is unrelated to the pattern", () => {
      const conditions: InstallCondition[] = [
        { file: { pattern: "**/angular.json" } },
      ];
      const detection = makeDetection({
        technologies: [
          { name: "dotnet", version: "8.0.0", matchedBy: "PackageReference" },
        ],
      });

      expect(matchesInstallConditions(conditions, detection)).toBe(false);
    });

    it("matches a simple filename pattern without glob stars", () => {
      const conditions: InstallCondition[] = [
        { file: { pattern: "angular.json" } },
      ];
      const detection = makeDetection({
        technologies: [
          { name: "angular", version: "17.0.0", matchedBy: "angular.json" },
        ],
      });

      expect(matchesInstallConditions(conditions, detection)).toBe(true);
    });

    it("matches * .sln pattern against a solution file", () => {
      const conditions: InstallCondition[] = [
        { file: { pattern: "*.sln" } },
      ];
      const detection = makeDetection({
        technologies: [
          { name: "dotnet", version: "8.0.0", matchedBy: "MySolution.sln" },
        ],
      });

      expect(matchesInstallConditions(conditions, detection)).toBe(true);
    });

    it("does not match * .sln against a nested solution file (single star)", () => {
      const conditions: InstallCondition[] = [
        { file: { pattern: "*.sln" } },
      ];
      const detection = makeDetection({
        technologies: [
          { name: "dotnet", version: "8.0.0", matchedBy: "src/MySolution.sln" },
        ],
      });

      expect(matchesInstallConditions(conditions, detection)).toBe(false);
    });

    it("matches ** /*.csproj but not against a non-file-path metadata string", () => {
      const conditions: InstallCondition[] = [
        { file: { pattern: "**/*.csproj" } },
      ];
      const detection = makeDetection({
        technologies: [
          { name: "dotnet", version: "8.0.0", matchedBy: "PackageReference" },
        ],
      });

      expect(matchesInstallConditions(conditions, detection)).toBe(false);
    });
  });

  describe("package reference matching", () => {
    it("matches a package by name", () => {
      const conditions: InstallCondition[] = [
        { packageReference: { package: "microsoft.net.sdk", version: ">=8.0.0" } },
      ];
      const detection = makeDetection({
        technologies: [
          { name: "microsoft.net.sdk", version: "8.0.0", matchedBy: "PackageReference" },
        ],
      });

      expect(matchesInstallConditions(conditions, detection)).toBe(true);
    });

    it("does not match when version is out of range", () => {
      const conditions: InstallCondition[] = [
        { packageReference: { package: "microsoft.net.sdk", version: ">=9.0.0" } },
      ];
      const detection = makeDetection({
        technologies: [
          { name: "microsoft.net.sdk", version: "8.0.0", matchedBy: "PackageReference" },
        ],
      });

      expect(matchesInstallConditions(conditions, detection)).toBe(false);
    });

    it("matches a partial version like 8.0 against a range using coercion", () => {
      const conditions: InstallCondition[] = [
        { packageReference: { package: "entity-framework-core", version: ">=8 <11" } },
      ];
      const detection = makeDetection({
        technologies: [
          { name: "entity-framework-core", version: "8.0", matchedBy: "PackageReference" },
        ],
      });

      expect(matchesInstallConditions(conditions, detection)).toBe(true);
    });

    it("matches a full 3-part version like 8.0.1 against a range", () => {
      const conditions: InstallCondition[] = [
        { packageReference: { package: "entity-framework-core", version: ">=8 <11" } },
      ];
      const detection = makeDetection({
        technologies: [
          { name: "entity-framework-core", version: "8.0.1", matchedBy: "PackageReference" },
        ],
      });

      expect(matchesInstallConditions(conditions, detection)).toBe(true);
    });
  });

  describe("package name disambiguation", () => {
    it("does not match EF6 condition against EF Core detection", () => {
      const conditions: InstallCondition[] = [
        { packageReference: { package: "EntityFramework", version: ">=6.0.0" } },
      ];
      const detection = makeDetection({
        technologies: [
          {
            name: "entity-framework-core",
            version: "8.0.7",
            matchedBy: "src/MyProject/MyProject.csproj:Microsoft.EntityFrameworkCore",
          },
        ],
      });

      expect(matchesInstallConditions(conditions, detection)).toBe(false);
    });

    it("matches EF Core condition against EF Core detection via actual package name", () => {
      const conditions: InstallCondition[] = [
        { packageReference: { package: "Microsoft.EntityFrameworkCore", version: ">=8.0.0" } },
      ];
      const detection = makeDetection({
        technologies: [
          {
            name: "entity-framework-core",
            version: "8.0.7",
            matchedBy: "src/MyProject/MyProject.csproj:Microsoft.EntityFrameworkCore",
          },
        ],
      });

      expect(matchesInstallConditions(conditions, detection)).toBe(true);
    });

    it("matches EF6 condition against EF6 detection", () => {
      const conditions: InstallCondition[] = [
        { packageReference: { package: "EntityFramework", version: ">=6.0.0" } },
      ];
      const detection = makeDetection({
        technologies: [
          {
            name: "entity-framework-6",
            version: "6.5.1",
            matchedBy: "src/MyProject/MyProject.csproj:EntityFramework",
          },
        ],
      });

      expect(matchesInstallConditions(conditions, detection)).toBe(true);
    });

    it("does not match EF Core condition against EF6 detection", () => {
      const conditions: InstallCondition[] = [
        { packageReference: { package: "Microsoft.EntityFrameworkCore", version: ">=8.0.0" } },
      ];
      const detection = makeDetection({
        technologies: [
          {
            name: "entity-framework-6",
            version: "6.5.1",
            matchedBy: "src/MyProject/MyProject.csproj:EntityFramework",
          },
        ],
      });

      expect(matchesInstallConditions(conditions, detection)).toBe(false);
    });

    it("matches ASP.NET Core skill against different ASP.NET Core package", () => {
      const conditions: InstallCondition[] = [
        { packageReference: { package: "Microsoft.AspNetCore.OpenApi", version: ">=0.0.0" } },
      ];
      const detection = makeDetection({
        technologies: [
          {
            name: "aspnet-core",
            version: "8.0.5",
            matchedBy: "src/MyProject/MyProject.csproj:Microsoft.AspNetCore.Diagnostics.HealthChecks",
          },
        ],
      });

      expect(matchesInstallConditions(conditions, detection)).toBe(true);
    });

    it("matches Postgres skill against Npgsql package", () => {
      const conditions: InstallCondition[] = [
        { packageReference: { package: "Npgsql", version: ">=0.0.0" } },
      ];
      const detection = makeDetection({
        technologies: [
          {
            name: "postgres",
            version: "8.0.3",
            matchedBy: "src/MyProject/MyProject.csproj:Npgsql",
          },
        ],
      });

      expect(matchesInstallConditions(conditions, detection)).toBe(true);
    });
  });

  describe("multiple conditions (any)", () => {
    it("matches if any condition is satisfied", () => {
      const conditions: InstallCondition[] = [
        { file: { pattern: "**/angular.json" } },
        { packageReference: { package: "microsoft.net.sdk", version: ">=8.0.0" } },
      ];
      const detection = makeDetection({
        technologies: [
          { name: "microsoft.net.sdk", version: "8.0.0", matchedBy: "PackageReference" },
        ],
      });

      expect(matchesInstallConditions(conditions, detection)).toBe(true);
    });

    it("returns false when no conditions match", () => {
      const conditions: InstallCondition[] = [
        { file: { pattern: "**/angular.json" } },
        { file: { pattern: "**/*.csproj" } },
      ];
      const detection = makeDetection({
        technologies: [
          { name: "react", version: "18.0.0", matchedBy: "package.json:react" },
        ],
      });

      expect(matchesInstallConditions(conditions, detection)).toBe(false);
    });
  });
});
