import { describe, it, expect } from "vitest";
import { deriveCapabilities } from "../../../src/detection/capabilities";
import type { DetectedTechnology } from "../../../src/types/index";

function tech(name: string): DetectedTechnology {
  return { name, matchedBy: "test" };
}

describe("deriveCapabilities", () => {
  it("returns empty array for no technologies", () => {
    expect(deriveCapabilities([])).toEqual([]);
  });

  it("derives database capabilities from EF Core", () => {
    const result = deriveCapabilities([tech("entity-framework-core")]);
    expect(result).toContain("database");
    expect(result).toContain("persistence");
    expect(result).toContain("query");
    expect(result).toContain("migration");
  });

  it("derives api and backend from ASP.NET Core", () => {
    const result = deriveCapabilities([tech("aspnet-core")]);
    expect(result).toContain("api");
    expect(result).toContain("backend");
  });

  it("derives frontend and ui from Angular", () => {
    const result = deriveCapabilities([tech("angular")]);
    expect(result).toContain("frontend");
    expect(result).toContain("ui");
  });

  it("derives frontend and ui from React", () => {
    const result = deriveCapabilities([tech("react")]);
    expect(result).toContain("frontend");
    expect(result).toContain("ui");
  });

  it("derives mobile from react-native", () => {
    const result = deriveCapabilities([tech("react-native")]);
    expect(result).toContain("mobile");
  });

  it("derives cloud and infrastructure from Docker", () => {
    const result = deriveCapabilities([tech("docker")]);
    expect(result).toContain("cloud");
    expect(result).toContain("infrastructure");
    expect(result).toContain("containerization");
  });

  it("derives testing from vitest", () => {
    const result = deriveCapabilities([tech("vitest")]);
    expect(result).toContain("testing");
  });

  it("derives backend from dotnet", () => {
    const result = deriveCapabilities([tech("dotnet")]);
    expect(result).toContain("backend");
  });

  it("deduplicates capabilities from multiple technologies", () => {
    const result = deriveCapabilities([tech("aspnet-core"), tech("dotnet")]);
    const backendCount = result.filter((c) => c === "backend").length;
    expect(backendCount).toBe(1);
  });

  it("returns sorted capabilities", () => {
    const result = deriveCapabilities([
      tech("entity-framework-core"),
      tech("aspnet-core"),
      tech("angular"),
    ]);
    const sorted = [...result].sort();
    expect(result).toEqual(sorted);
  });

  it("ignores unknown technologies", () => {
    const result = deriveCapabilities([tech("unknown-tech")]);
    expect(result).toEqual([]);
  });

  it("combines capabilities from multiple technologies", () => {
    const result = deriveCapabilities([
      tech("entity-framework-core"),
      tech("aspnet-core"),
    ]);
    expect(result).toContain("database");
    expect(result).toContain("api");
    expect(result).toContain("backend");
  });

  it("derives frontend and ui from Vue", () => {
    const result = deriveCapabilities([tech("vue")]);
    expect(result).toContain("frontend");
    expect(result).toContain("ui");
  });

  it("derives frontend, ui, and ssr from Nuxt", () => {
    const result = deriveCapabilities([tech("nuxt")]);
    expect(result).toContain("frontend");
    expect(result).toContain("ui");
    expect(result).toContain("ssr");
  });

  it("derives frontend and ui from Svelte", () => {
    const result = deriveCapabilities([tech("svelte")]);
    expect(result).toContain("frontend");
    expect(result).toContain("ui");
  });

  it("derives frontend, ui, and ssr from SvelteKit", () => {
    const result = deriveCapabilities([tech("sveltekit")]);
    expect(result).toContain("frontend");
    expect(result).toContain("ui");
    expect(result).toContain("ssr");
  });

  it("derives backend from Python", () => {
    const result = deriveCapabilities([tech("python")]);
    expect(result).toContain("backend");
  });

  it("derives backend from Django", () => {
    const result = deriveCapabilities([tech("django")]);
    expect(result).toContain("backend");
  });

  it("derives backend from FastAPI", () => {
    const result = deriveCapabilities([tech("fastapi")]);
    expect(result).toContain("backend");
  });

  it("derives backend from Go", () => {
    const result = deriveCapabilities([tech("go")]);
    expect(result).toContain("backend");
  });

  it("derives backend from Rust", () => {
    const result = deriveCapabilities([tech("rust")]);
    expect(result).toContain("backend");
  });

  it("derives backend from Java", () => {
    const result = deriveCapabilities([tech("java")]);
    expect(result).toContain("backend");
  });

  it("derives backend from Spring Boot", () => {
    const result = deriveCapabilities([tech("spring-boot")]);
    expect(result).toContain("backend");
  });

  it("derives cloud and infrastructure from Kubernetes", () => {
    const result = deriveCapabilities([tech("kubernetes")]);
    expect(result).toContain("cloud");
    expect(result).toContain("infrastructure");
  });

  it("derives cloud and infrastructure from Helm", () => {
    const result = deriveCapabilities([tech("helm")]);
    expect(result).toContain("cloud");
    expect(result).toContain("infrastructure");
  });

  it("derives testing from Playwright", () => {
    const result = deriveCapabilities([tech("playwright")]);
    expect(result).toContain("testing");
  });

  it("derives database and persistence from Prisma", () => {
    const result = deriveCapabilities([tech("prisma")]);
    expect(result).toContain("database");
    expect(result).toContain("persistence");
  });

  it("derives frontend and ui from Tailwind", () => {
    const result = deriveCapabilities([tech("tailwind")]);
    expect(result).toContain("frontend");
    expect(result).toContain("ui");
  });

  it("derives backend from Kotlin", () => {
    const result = deriveCapabilities([tech("kotlin")]);
    expect(result).toContain("backend");
  });

  it("derives mobile from kotlin-android", () => {
    const result = deriveCapabilities([tech("kotlin-android")]);
    expect(result).toContain("mobile");
  });

  it("derives backend from Swift", () => {
    const result = deriveCapabilities([tech("swift")]);
    expect(result).toContain("backend");
  });

  it("derives mobile from swift-ios", () => {
    const result = deriveCapabilities([tech("swift-ios")]);
    expect(result).toContain("mobile");
  });

  it("derives database and caching from Redis", () => {
    const result = deriveCapabilities([tech("redis")]);
    expect(result).toContain("database");
    expect(result).toContain("caching");
  });

  it("derives database and persistence from PostgreSQL", () => {
    const result = deriveCapabilities([tech("postgresql")]);
    expect(result).toContain("database");
    expect(result).toContain("persistence");
  });

  it("derives database and persistence from MongoDB", () => {
    const result = deriveCapabilities([tech("mongodb")]);
    expect(result).toContain("database");
    expect(result).toContain("persistence");
  });
});
