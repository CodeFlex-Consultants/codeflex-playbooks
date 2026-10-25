import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { detectProject } from "../../../src/detection/index";
import { matchesInstallConditions } from "../../../src/resolution/install-matcher";
import type { InstallCondition } from "../../../src/types/index";
import { withEmptyTempDir } from "../../helpers";

const fixturesDir = join(import.meta.dirname, "../../fixtures");

function fixturePath(name: string): string {
  return join(fixturesDir, name);
}

describe("detectProject", () => {
  describe("dotnet-api fixture", () => {
    it("detects .NET 8.0 and ASP.NET Core", async () => {
      const result = await detectProject(fixturePath("dotnet-api"));
      const techNames = result.technologies.map((t) => t.name);
      expect(techNames).toContain("dotnet");
      expect(techNames).toContain("aspnet-core");
      
      const dotnet = result.technologies.find((t) => t.name === "dotnet" && t.version);
      expect(dotnet?.version).toBe("8.0");

      expect(result.capabilities).toContain("api");
      expect(result.capabilities).toContain("backend");
    });
  });

  describe("dotnet-ef8 fixture", () => {
    it("detects EF Core 8 but NOT EF6", async () => {
      const result = await detectProject(fixturePath("dotnet-ef8"));
      const techNames = result.technologies.map((t) => t.name);
      expect(techNames).toContain("entity-framework-core");
      expect(techNames).not.toContain("entity-framework-6");
      
      const efCore = result.technologies.find((t) => t.name === "entity-framework-core");
      expect(efCore?.version).toBe("8.0.2");

      expect(result.capabilities).toContain("database");
      expect(result.capabilities).toContain("persistence");
    });

    it("full 3-part EF Core version satisfies an installWhen packageReference range", async () => {
      const result = await detectProject(fixturePath("dotnet-ef8"));
      const efCore = result.technologies.find((t) => t.name === "entity-framework-core");
      expect(efCore?.version).toBe("8.0.2");

      const conditions: InstallCondition[] = [
        { packageReference: { package: "entity-framework-core", version: ">=8 <11" } },
      ];

      expect(matchesInstallConditions(conditions, result)).toBe(true);
    });
  });

  describe("dotnet-ef6 fixture", () => {
    it("detects EF6 but NOT EF Core", async () => {
      const result = await detectProject(fixturePath("dotnet-ef6"));
      const techNames = result.technologies.map((t) => t.name);
      expect(techNames).toContain("entity-framework-6");
      expect(techNames).not.toContain("entity-framework-core");
    });
  });

  describe("angular-app fixture", () => {
    it("detects Angular", async () => {
      const result = await detectProject(fixturePath("angular-app"));
      const techNames = result.technologies.map((t) => t.name);
      expect(techNames).toContain("angular");
      
      const angular = result.technologies.find((t) => t.name === "angular" && t.version);
      expect(angular?.version).toBe("20.0.0");

      expect(result.capabilities).toContain("frontend");
      expect(result.capabilities).toContain("ui");
    });
  });

  describe("angular-ngxs fixture", () => {
    it("detects Angular and NGXS", async () => {
      const result = await detectProject(fixturePath("angular-ngxs"));
      const techNames = result.technologies.map((t) => t.name);
      expect(techNames).toContain("angular");
      expect(techNames).toContain("ngxs");
    });
  });

  describe("react-app fixture", () => {
    it("detects React", async () => {
      const result = await detectProject(fixturePath("react-app"));
      const techNames = result.technologies.map((t) => t.name);
      expect(techNames).toContain("react");
      
      const react = result.technologies.find((t) => t.name === "react");
      expect(react?.version).toBe("19.0.0");
    });
  });

  describe("react-native-app fixture", () => {
    it("detects React Native", async () => {
      const result = await detectProject(fixturePath("react-native-app"));
      const techNames = result.technologies.map((t) => t.name);
      expect(techNames).toContain("react-native");
    });
  });

  describe("monorepo fixture", () => {
    it("detects multiple technologies with correct scopes", async () => {
      const result = await detectProject(fixturePath("monorepo"));
      const techNames = result.technologies.map((t) => t.name);
      expect(techNames).toContain("dotnet");
      expect(techNames).toContain("angular");
      expect(techNames).toContain("react-native");
      
      expect(result.scopes["dotnet"]).toBeDefined();
      expect(result.scopes["dotnet"]).toContain("src/backend/**");
      
      expect(result.scopes["angular"]).toBeDefined();
      expect(result.scopes["angular"]).toContain("src/web/**");
      
      expect(result.scopes["react-native"]).toBeDefined();
      expect(result.scopes["react-native"]).toContain("src/mobile/**");
    });
  });

  describe("empty fixture", () => {
    it("returns empty result for empty directory", async () => {
      const result = await detectProject(fixturePath("empty"));
      expect(result.technologies).toHaveLength(0);
      expect(Object.keys(result.scopes)).toHaveLength(0);
      expect(result.capabilities).toHaveLength(0);
    });
  });

  describe("bicep-project fixture", () => {
    it("detects Bicep", async () => {
      const result = await detectProject(fixturePath("bicep-project"));
      const techNames = result.technologies.map((t) => t.name);
      expect(techNames).toContain("bicep");
    });
  });

  describe("docker-project fixture", () => {
    it("detects Docker", async () => {
      const result = await detectProject(fixturePath("docker-project"));
      const techNames = result.technologies.map((t) => t.name);
      expect(techNames).toContain("docker");
    });
  });

  describe("vue-app fixture", () => {
    it("detects Vue", async () => {
      const result = await detectProject(fixturePath("vue-app"));
      const techNames = result.technologies.map((t) => t.name);
      expect(techNames).toContain("vue");

      const vue = result.technologies.find((t) => t.name === "vue");
      expect(vue?.version).toBe("3.4.0");

      expect(result.capabilities).toContain("frontend");
      expect(result.capabilities).toContain("ui");
    });
  });

  describe("nuxt-app fixture", () => {
    it("detects Nuxt and Vue", async () => {
      const result = await detectProject(fixturePath("nuxt-app"));
      const techNames = result.technologies.map((t) => t.name);
      expect(techNames).toContain("vue");
      expect(techNames).toContain("nuxt");

      expect(result.capabilities).toContain("frontend");
      expect(result.capabilities).toContain("ui");
      expect(result.capabilities).toContain("ssr");
    });
  });

  describe("svelte-app fixture", () => {
    it("detects Svelte", async () => {
      const result = await detectProject(fixturePath("svelte-app"));
      const techNames = result.technologies.map((t) => t.name);
      expect(techNames).toContain("svelte");

      expect(result.capabilities).toContain("frontend");
      expect(result.capabilities).toContain("ui");
    });
  });

  describe("sveltekit-app fixture", () => {
    it("detects SvelteKit and Svelte", async () => {
      const result = await detectProject(fixturePath("sveltekit-app"));
      const techNames = result.technologies.map((t) => t.name);
      expect(techNames).toContain("svelte");
      expect(techNames).toContain("sveltekit");

      expect(result.capabilities).toContain("frontend");
      expect(result.capabilities).toContain("ui");
      expect(result.capabilities).toContain("ssr");
    });
  });

  describe("python-django fixture", () => {
    it("detects Python and Django", async () => {
      const result = await detectProject(fixturePath("python-django"));
      const techNames = result.technologies.map((t) => t.name);
      expect(techNames).toContain("python");
      expect(techNames).toContain("django");
      expect(techNames).not.toContain("fastapi");

      expect(result.capabilities).toContain("backend");
    });
  });

  describe("python-fastapi fixture", () => {
    it("detects Python and FastAPI", async () => {
      const result = await detectProject(fixturePath("python-fastapi"));
      const techNames = result.technologies.map((t) => t.name);
      expect(techNames).toContain("python");
      expect(techNames).toContain("fastapi");
      expect(techNames).not.toContain("django");

      expect(result.capabilities).toContain("backend");
    });
  });

  describe("go-app fixture", () => {
    it("detects Go", async () => {
      const result = await detectProject(fixturePath("go-app"));
      const techNames = result.technologies.map((t) => t.name);
      expect(techNames).toContain("go");

      expect(result.capabilities).toContain("backend");
    });
  });

  describe("rust-app fixture", () => {
    it("detects Rust", async () => {
      const result = await detectProject(fixturePath("rust-app"));
      const techNames = result.technologies.map((t) => t.name);
      expect(techNames).toContain("rust");

      expect(result.capabilities).toContain("backend");
    });
  });

  describe("java-spring fixture", () => {
    it("detects Java and Spring Boot", async () => {
      const result = await detectProject(fixturePath("java-spring"));
      const techNames = result.technologies.map((t) => t.name);
      expect(techNames).toContain("java");
      expect(techNames).toContain("spring-boot");

      expect(result.capabilities).toContain("backend");
    });
  });

  describe("kubernetes-helm fixture", () => {
    it("detects Helm and Kubernetes", async () => {
      const result = await detectProject(fixturePath("kubernetes-helm"));
      const techNames = result.technologies.map((t) => t.name);
      expect(techNames).toContain("helm");
      expect(techNames).toContain("kubernetes");

      expect(result.capabilities).toContain("cloud");
      expect(result.capabilities).toContain("infrastructure");
    });
  });

  describe("playwright-app fixture", () => {
    it("detects Playwright", async () => {
      const result = await detectProject(fixturePath("playwright-app"));
      const techNames = result.technologies.map((t) => t.name);
      expect(techNames).toContain("playwright");

      expect(result.capabilities).toContain("testing");
    });
  });

  describe("prisma-app fixture", () => {
    it("detects Prisma", async () => {
      const result = await detectProject(fixturePath("prisma-app"));
      const techNames = result.technologies.map((t) => t.name);
      expect(techNames).toContain("prisma");

      expect(result.capabilities).toContain("database");
      expect(result.capabilities).toContain("persistence");
    });
  });

  describe("prisma-v8-app fixture", () => {
    it("detects Prisma 8 via contract.prisma", async () => {
      const result = await detectProject(fixturePath("prisma-v8-app"));
      const techNames = result.technologies.map((t) => t.name);
      expect(techNames).toContain("prisma");

      expect(result.capabilities).toContain("database");
      expect(result.capabilities).toContain("persistence");
    });
  });

  describe("tailwind-app fixture", () => {
    it("detects Tailwind CSS", async () => {
      const result = await detectProject(fixturePath("tailwind-app"));
      const techNames = result.technologies.map((t) => t.name);
      expect(techNames).toContain("tailwind");

      expect(result.capabilities).toContain("frontend");
      expect(result.capabilities).toContain("ui");
    });
  });

  describe("kotlin-app fixture", () => {
    it("detects Kotlin", async () => {
      const result = await detectProject(fixturePath("kotlin-app"));
      const techNames = result.technologies.map((t) => t.name);
      expect(techNames).toContain("kotlin");

      expect(result.capabilities).toContain("backend");
    });
  });

  describe("kotlin-android-app fixture", () => {
    it("detects Kotlin and Kotlin Android", async () => {
      const result = await detectProject(fixturePath("kotlin-android-app"));
      const techNames = result.technologies.map((t) => t.name);
      expect(techNames).toContain("kotlin");
      expect(techNames).toContain("kotlin-android");

      expect(result.capabilities).toContain("mobile");
    });
  });

  describe("swift-app fixture", () => {
    it("detects Swift", async () => {
      const result = await detectProject(fixturePath("swift-app"));
      const techNames = result.technologies.map((t) => t.name);
      expect(techNames).toContain("swift");

      expect(result.capabilities).toContain("backend");
    });
  });

  describe("swift-ios-app fixture", () => {
    it("detects Swift and Swift iOS", async () => {
      const result = await detectProject(fixturePath("swift-ios-app"));
      const techNames = result.technologies.map((t) => t.name);
      expect(techNames).toContain("swift");
      expect(techNames).toContain("swift-ios");

      expect(result.capabilities).toContain("mobile");
    });
  });

  describe("dotnet-framework-app fixture", () => {
    it("detects .NET Framework and NOT .NET Core", async () => {
      const result = await detectProject(fixturePath("dotnet-framework-app"));
      const techNames = result.technologies.map((t) => t.name);
      expect(techNames).toContain("dotnet-framework");
      expect(techNames).not.toContain("dotnet");

      const fw = result.technologies.find((t) => t.name === "dotnet-framework" && t.version);
      expect(fw?.version).toBe("4.7.2");

      expect(result.capabilities).toContain("backend");
    });

    it("detects packages.config alongside .csproj", async () => {
      const result = await detectProject(fixturePath("dotnet-framework-app"));
      const techNames = result.technologies.map((t) => t.name);
      expect(techNames).toContain("dotnet-framework");
      expect(result.capabilities).toContain("backend");
    });
  });

  describe("dotnet-core-app fixture", () => {
    it("detects .NET Core/5+ and NOT .NET Framework", async () => {
      const result = await detectProject(fixturePath("dotnet-core-app"));
      const techNames = result.technologies.map((t) => t.name);
      expect(techNames).toContain("dotnet");
      expect(techNames).not.toContain("dotnet-framework");

      const dotnet = result.technologies.find((t) => t.name === "dotnet" && t.version);
      expect(dotnet?.version).toBe("8.0");

      expect(result.capabilities).toContain("backend");
    });
  });

  describe("version-specific detection", () => {
    it("detects angular with its real semver version, no synthetic threshold technology", async () => {
      const result = await detectProject(fixturePath("angular-app"));
      const techNames = result.technologies.map((t) => t.name);
      expect(techNames).toContain("angular");
      expect(techNames).not.toContain("angular-17-plus");

      const angular = result.technologies.find((t) => t.name === "angular" && t.version);
      expect(angular?.version).toBe("20.0.0");
    });

    it("detects react with its real semver version, no synthetic threshold technology", async () => {
      const result = await detectProject(fixturePath("react-app"));
      const techNames = result.technologies.map((t) => t.name);
      expect(techNames).toContain("react");
      expect(techNames).not.toContain("react-19");

      const react = result.technologies.find((t) => t.name === "react");
      expect(react?.version).toBe("19.0.0");
    });

    it("detects dotnet with version 8.0 for .NET 8.0", async () => {
      const result = await detectProject(fixturePath("dotnet-api"));
      const dotnet8 = result.technologies.find(
        (t) => t.name === "dotnet" && t.version === "8.0",
      );
      expect(dotnet8).toBeDefined();
    });
  });

  describe("redis-app fixture", () => {
    it("detects Redis via ioredis", async () => {
      const result = await detectProject(fixturePath("redis-app"));
      const techNames = result.technologies.map((t) => t.name);
      expect(techNames).toContain("redis");

      const redis = result.technologies.find((t) => t.name === "redis");
      expect(redis?.version).toBe("5.3.0");

      expect(result.capabilities).toContain("database");
      expect(result.capabilities).toContain("caching");
    });
  });

  describe("postgresql-app fixture", () => {
    it("detects PostgreSQL via pg", async () => {
      const result = await detectProject(fixturePath("postgresql-app"));
      const techNames = result.technologies.map((t) => t.name);
      expect(techNames).toContain("postgresql");

      const pg = result.technologies.find((t) => t.name === "postgresql");
      expect(pg?.version).toBe("8.11.0");

      expect(result.capabilities).toContain("database");
      expect(result.capabilities).toContain("persistence");
    });
  });

  describe("mongodb-app fixture", () => {
    it("detects MongoDB via mongodb", async () => {
      const result = await detectProject(fixturePath("mongodb-app"));
      const techNames = result.technologies.map((t) => t.name);
      expect(techNames).toContain("mongodb");

      const mongo = result.technologies.find((t) => t.name === "mongodb");
      expect(mongo?.version).toBe("6.3.0");

      expect(result.capabilities).toContain("database");
      expect(result.capabilities).toContain("persistence");
    });
  });

  describe("dotnet OS-specific target framework monikers", () => {
    it("extracts the base version from a platform-specific TFM (net8.0-windows)", async () => {
      await withEmptyTempDir(async (tempDir) => {
        await writeFile(
          join(tempDir, "app.csproj"),
          [
            '<Project Sdk="Microsoft.NET.Sdk">',
            "  <PropertyGroup>",
            "    <TargetFramework>net8.0-windows</TargetFramework>",
            "  </PropertyGroup>",
            "</Project>",
            "",
          ].join("\n"),
          "utf-8",
        );

        const result = await detectProject(tempDir);
        const dotnet = result.technologies.find((t) => t.name === "dotnet" && t.version);
        // See https://learn.microsoft.com/en-us/dotnet/standard/frameworks — platform-specific
        // TFMs like net8.0-windows/net8.0-android/net8.0-ios must still resolve to "8.0".
        expect(dotnet?.version).toBe("8.0");
      });
    });

    it("extracts the base version from a TFM with an explicit platform version (net8.0-android34.0)", async () => {
      await withEmptyTempDir(async (tempDir) => {
        await writeFile(
          join(tempDir, "app.csproj"),
          [
            '<Project Sdk="Microsoft.NET.Sdk">',
            "  <PropertyGroup>",
            "    <TargetFramework>net8.0-android34.0</TargetFramework>",
            "  </PropertyGroup>",
            "</Project>",
            "",
          ].join("\n"),
          "utf-8",
        );

        const result = await detectProject(tempDir);
        const dotnet = result.technologies.find((t) => t.name === "dotnet" && t.version);
        expect(dotnet?.version).toBe("8.0");
      });
    });
  });
});
