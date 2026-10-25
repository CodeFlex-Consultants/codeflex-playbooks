import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  loadConfig,
  saveConfig,
  loadLock,
  saveLock,
  createDefaultConfig,
  codeflexDir,
  skillsDir,
  mergeDetectedHarnesses,
} from "../../../src/config/index";
import type { EngineeringConfig, DetectionResult } from "../../../src/types/index";
import { AgentHarness } from "../../../src/types/index";
import { mockLock } from "../../fixtures/builders";
import { ConfigValidationError } from "../../../src/utils/errors";
import { ensureDir } from "../../../src/utils/fs";

let tempDir: string;

function makeConfig(overrides?: Partial<EngineeringConfig>): EngineeringConfig {
  return {
    version: 1,
    autoDetect: true,
    agentHarnesses: ["codex", "kilo"],
    standards: { codeflex: { enabled: true } },
    include: [],
    exclude: [],
    scopes: {},
    exceptions: [],
    ...overrides,
  };
}

describe("codeflexDir", () => {
  it("returns .codeflex path under project root", () => {
    expect(codeflexDir("/project")).toBe(join("/project", ".codeflex"));
  });
});

describe("skillsDir", () => {
  it("returns .codeflex/skills path under project root", () => {
    expect(skillsDir("/project")).toBe(join("/project", ".codeflex", "skills"));
  });
});

describe("config round-trip", () => {
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "codeflex-config-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it("returns null when config file does not exist", async () => {
    const result = await loadConfig(tempDir);
    expect(result).toBeNull();
  });

  it("writes and reads config identically", async () => {
    const config = makeConfig();
    await saveConfig(tempDir, config);
    const loaded = await loadConfig(tempDir);
    expect(loaded).toEqual(config);
  });

  it("throws ConfigValidationError for invalid YAML", async () => {
    await ensureDir(join(tempDir, ".codeflex"));
    await writeFile(join(tempDir, ".codeflex", "engineering.yaml"), "version: bad\n", "utf-8");
    await expect(loadConfig(tempDir)).rejects.toThrow(ConfigValidationError);
  });
});

describe("lock round-trip", () => {
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "codeflex-lock-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it("returns null when lock file does not exist", async () => {
    const result = await loadLock(tempDir);
    expect(result).toBeNull();
  });

  it("writes and reads lock identically", async () => {
    const lock = mockLock({ sources: {}, skills: ["codeflex-dotnet"], projections: [{ adapters: ["codex"], path: ".agents/skills" }] });
    await saveLock(tempDir, lock);
    const loaded = await loadLock(tempDir);
    expect(loaded).toEqual(lock);
  });

  it("throws ConfigValidationError for invalid lock YAML", async () => {
    await ensureDir(join(tempDir, ".codeflex"));
    await writeFile(join(tempDir, ".codeflex", "engineering.lock"), "not: valid\nlock: true\n", "utf-8");
    await expect(loadLock(tempDir)).rejects.toThrow(ConfigValidationError);
  });
});

describe("createDefaultConfig", () => {
  it("creates config with expected defaults", () => {
    const detection: DetectionResult = {
      technologies: [{ name: "dotnet", version: "8.0", matchedBy: "*.csproj" }],
      scopes: { dotnet: ["src/backend/**"] },
      capabilities: [],
    };
    const config = createDefaultConfig(detection);
    expect(config.version).toBe(1);
    expect(config.autoDetect).toBe(true);
    expect(config.agentHarnesses).toEqual(["codex", "claude-code", "opencode", "kilo"]);
    expect(config.standards.codeflex.enabled).toBe(true);
    expect(config.scopes).toEqual({ dotnet: ["src/backend/**"] });
    expect(config.include).toEqual([]);
    expect(config.exclude).toEqual([]);
    expect(config.exceptions).toEqual([]);
  });

  it("creates config with empty scopes for empty detection", () => {
    const detection: DetectionResult = { technologies: [], scopes: {}, capabilities: [] };
    const config = createDefaultConfig(detection);
    expect(config.scopes).toEqual({});
  });
});

describe("config migration", () => {
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "codeflex-migration-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it("throws helpful error for missing version", async () => {
    await ensureDir(join(tempDir, ".codeflex"));
    await writeFile(
      join(tempDir, ".codeflex", "engineering.yaml"),
      "autoDetect: true\n",
      "utf-8"
    );
    await expect(loadConfig(tempDir)).rejects.toThrow("Missing version field");
  });

  it("throws helpful error for unsupported future version", async () => {
    await ensureDir(join(tempDir, ".codeflex"));
    await writeFile(
      join(tempDir, ".codeflex", "engineering.yaml"),
      "version: 99\nautoDetect: true\nagentHarnesses: [codex]\nstandards:\n  codeflex:\n    enabled: true\ninclude: []\nexclude: []\nscopes: {}\nexceptions: []\n",
      "utf-8"
    );
    await expect(loadConfig(tempDir)).rejects.toThrow("Unsupported config version: 99");
  });

  it("throws helpful error for version zero", async () => {
    await ensureDir(join(tempDir, ".codeflex"));
    await writeFile(
      join(tempDir, ".codeflex", "engineering.yaml"),
      "version: 0\nautoDetect: true\nagentHarnesses: [codex]\nstandards:\n  codeflex:\n    enabled: true\ninclude: []\nexclude: []\nscopes: {}\nexceptions: []\n",
      "utf-8"
    );
    await expect(loadConfig(tempDir)).rejects.toThrow("Unsupported config version: 0");
  });

  it("accepts valid version 1 config", async () => {
    const config = makeConfig();
    await saveConfig(tempDir, config);
    const loaded = await loadConfig(tempDir);
    expect(loaded).toEqual(config);
  });
});

describe("mergeDetectedHarnesses", () => {
  it("keeps existing harnesses unchanged when detection finds nothing", () => {
    const result = mergeDetectedHarnesses(
      [AgentHarness.Codex, AgentHarness.Kilo],
      [],
    );

    expect(result.merged).toEqual([AgentHarness.Codex, AgentHarness.Kilo]);
    expect(result.added).toEqual([]);
    expect(result.notRedetected).toEqual([AgentHarness.Codex, AgentHarness.Kilo]);
  });

  it("adds newly detected harnesses without dropping existing ones", () => {
    const result = mergeDetectedHarnesses(
      [AgentHarness.Codex],
      [AgentHarness.Codex, AgentHarness.Cursor],
    );

    expect(result.merged).toEqual([AgentHarness.Codex, AgentHarness.Cursor]);
    expect(result.added).toEqual([AgentHarness.Cursor]);
    expect(result.notRedetected).toEqual([]);
  });

  it("never removes a configured harness even if it isn't re-detected", () => {
    const result = mergeDetectedHarnesses(
      [AgentHarness.Codex, AgentHarness.Kilo, AgentHarness.Cursor],
      [AgentHarness.Kilo],
    );

    expect(result.merged).toEqual(
      expect.arrayContaining([AgentHarness.Codex, AgentHarness.Kilo, AgentHarness.Cursor]),
    );
    expect(result.merged).toHaveLength(3);
    expect(result.added).toEqual([]);
    expect(result.notRedetected).toEqual([AgentHarness.Codex, AgentHarness.Cursor]);
  });

  it("returns an empty merge when both current and detected are empty", () => {
    const result = mergeDetectedHarnesses([], []);

    expect(result.merged).toEqual([]);
    expect(result.added).toEqual([]);
    expect(result.notRedetected).toEqual([]);
  });

  it("adds all detected harnesses when starting from an empty config", () => {
    const result = mergeDetectedHarnesses([], [AgentHarness.Codex, AgentHarness.Kilo]);

    expect(result.merged).toEqual([AgentHarness.Codex, AgentHarness.Kilo]);
    expect(result.added).toEqual([AgentHarness.Codex, AgentHarness.Kilo]);
    expect(result.notRedetected).toEqual([]);
  });
});

describe("harness detector coverage", () => {
  it("every AgentHarness member has a detector or signal-registry entry", async () => {
    const { HARNESS_SIGNAL_REGISTRY } = await import(
      "../../../src/detection/harness/signal-registry.js"
    );

    for (const harness of Object.values(AgentHarness)) {
      const hasRegistryEntry =
        Boolean(HARNESS_SIGNAL_REGISTRY[harness]) &&
        HARNESS_SIGNAL_REGISTRY[harness].length > 0;

      expect(
        hasRegistryEntry,
        `AgentHarness.${harness} has no signal-registry entry and would silently ` +
          "always be reported as \"not detected\" (and therefore removed if the " +
          "removal guard were ever relaxed). Add an entry to HARNESS_SIGNAL_REGISTRY " +
          "or a dedicated detector in cli/src/detection/harness/index.ts.",
      ).toBe(true);
    }
  });
});
