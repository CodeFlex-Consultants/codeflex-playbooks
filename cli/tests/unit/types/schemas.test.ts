import { describe, it, expect } from "vitest";
import { engineeringConfigSchema, engineeringLockSchema, codeflexYamlSchema, skillManifestSchema } from "../../../src/types/schemas";

describe("engineeringConfigSchema", () => {
  it("validates a minimal valid config", () => {
    const config = {
      version: 1,
      autoDetect: true,
      agentHarnesses: ["codex"],
      standards: { codeflex: { enabled: true } },
      include: [],
      exclude: [],
      scopes: {},
      exceptions: [],
    };
    const result = engineeringConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it("rejects config with missing required fields", () => {
    const config = { version: 1 };
    const result = engineeringConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it("rejects config with version < 1", () => {
    const config = {
      version: 0,
      autoDetect: true,
      agentHarnesses: [],
      standards: { codeflex: { enabled: true } },
      include: [],
      exclude: [],
      scopes: {},
      exceptions: [],
    };
    const result = engineeringConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it("accepts config with client sources", () => {
    const config = {
      version: 1,
      autoDetect: true,
      agentHarnesses: ["codex"],
      standards: {
        codeflex: { enabled: true },
        client: [{ id: "client-a", source: { type: "repository" as const, path: ".client/skills" } }],
      },
      include: [],
      exclude: [],
      scopes: {},
      exceptions: [],
    };
    const result = engineeringConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });
});

describe("engineeringLockSchema", () => {
  it("validates a minimal valid lock", () => {
    const lock = {
      version: 1,
      sources: {},
      skills: ["codeflex-dotnet"],
      projections: [{ adapters: ["codex"], path: ".agents/skills" }],
    };
    const result = engineeringLockSchema.safeParse(lock);
    expect(result.success).toBe(true);
  });

  it("rejects lock with non-array adapters", () => {
    const lock = {
      version: 1,
      sources: {},
      skills: [],
      projections: [{ adapters: "agents", path: ".unknown/skills" }],
    };
    const result = engineeringLockSchema.safeParse(lock);
    expect(result.success).toBe(false);
  });

  it("accepts lock with multiple adapters", () => {
    const lock = {
      version: 1,
      sources: {},
      skills: [],
      projections: [{ adapters: ["codex", "opencode", "kilo"], path: ".agents/skills" }],
    };
    const result = engineeringLockSchema.safeParse(lock);
    expect(result.success).toBe(true);
  });

  it("accepts lock with codeflex source", () => {
    const lock = {
      version: 1,
      sources: {
        codeflex: { release: "2026.09.0", commit: "abc123", sha256: "deadbeef" },
      },
      skills: [],
      projections: [],
    };
    const result = engineeringLockSchema.safeParse(lock);
    expect(result.success).toBe(true);
  });
});

describe("codeflexYamlSchema", () => {
  it("validates a minimal codeflex.yaml", () => {
    const yaml = {
      id: "codeflex-dotnet",
      source: "codeflex",
      overridePolicy: "allowed",
      owner: { team: "platform" },
    };
    const result = codeflexYamlSchema.safeParse(yaml);
    expect(result.success).toBe(true);
  });

  it("rejects invalid source", () => {
    const yaml = {
      id: "test",
      source: "invalid",
      overridePolicy: "allowed",
      owner: { team: "x" },
    };
    const result = codeflexYamlSchema.safeParse(yaml);
    expect(result.success).toBe(false);
  });
});

describe("skillManifestSchema", () => {
  it("validates a minimal manifest", () => {
    const manifest = { name: "test-skill", description: "A test skill" };
    const result = skillManifestSchema.safeParse(manifest);
    expect(result.success).toBe(true);
  });

  it("rejects manifest without description", () => {
    const manifest = { name: "test-skill" };
    const result = skillManifestSchema.safeParse(manifest);
    expect(result.success).toBe(false);
  });
});
