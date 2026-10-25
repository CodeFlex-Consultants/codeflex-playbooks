import { describe, it, expect, vi, beforeEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { EngineeringConfig, StandardsSource } from "../../../src/types/index";
import { CodeFlexSourceType, AgentHarness } from "../../../src/types/index";

vi.mock("../../../src/skills/source-fetcher.js", () => ({
  fetchCodeFlexSource: vi.fn(async () => ({
    source: {
      type: "codeflex" as const,
      release: "local",
      commit: "local",
      sha256: "local",
      skillsDir: "",
    },
    warnings: [],
  })),
  fetchClientSource: vi.fn(),
  fetchRepositorySource: vi.fn(),
}));

import { fetchCodeFlexSource } from "../../../src/skills/source-fetcher";
import { fetchAllSources, loadAllSkills } from "../../../src/cli/pipeline";

const mockedFetchCodeFlexSource = vi.mocked(fetchCodeFlexSource);

function baseConfig(overrides: Partial<EngineeringConfig["standards"]["codeflex"]> = {}): EngineeringConfig {
  return {
    version: 1,
    autoDetect: true,
    agentHarnesses: [AgentHarness.ClaudeCode],
    standards: {
      codeflex: {
        enabled: true,
        ...overrides,
      },
    },
    include: [],
    exclude: [],
    scopes: {},
    exceptions: [],
  };
}

describe("fetchAllSources", () => {
  beforeEach(() => {
    mockedFetchCodeFlexSource.mockClear();
  });

  it("passes the configured codeflex source through to fetchCodeFlexSource", async () => {
    const gitSource = {
      type: CodeFlexSourceType.Git,
      url: "https://github.com/CodeFlex-Consultants/engineering-skills",
      ref: "main",
    } as const;

    const config = baseConfig({ source: gitSource });

    await fetchAllSources({ projectRoot: "/project", config });

    expect(mockedFetchCodeFlexSource).toHaveBeenCalledWith(gitSource, undefined, undefined);
  });

  it("falls back to the local default when no codeflex source is configured", async () => {
    const config = baseConfig();

    await fetchAllSources({ projectRoot: "/project", config });

    expect(mockedFetchCodeFlexSource).toHaveBeenCalledWith(undefined, undefined, undefined);
  });

  it("surfaces fetchCodeFlexSource warnings to the reporter", async () => {
    mockedFetchCodeFlexSource.mockResolvedValueOnce({
      source: {
        type: "codeflex" as const,
        release: "local",
        commit: "local",
        sha256: "local",
        skillsDir: "",
      },
      warnings: ["Using development fallback path 'foo'."],
    });

    const warn = vi.fn();
    const reporter = { debug: vi.fn(), info: vi.fn(), warn, error: vi.fn() };

    await fetchAllSources({ projectRoot: "/project", config: baseConfig(), reporter });

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("development fallback path"));
  });
});

describe("loadAllSkills", () => {
  function makeSource(skillsDir: string): StandardsSource {
    return { type: "codeflex" as const, sha256: "hash", skillsDir };
  }

  it("returns skills loaded from disk with no diagnostics for valid skills", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "load-all-skills-"));
    try {
      const skillDir = join(baseDir, "test-skill");
      await mkdir(skillDir, { recursive: true });
      await writeFile(
        join(skillDir, "SKILL.md"),
        ["---", "name: test-skill", "description: A test skill", "---", "# Test"].join("\n"),
        "utf-8",
      );
      await writeFile(
        join(skillDir, "codeflex.yaml"),
        ["id: test-skill", "source: codeflex", "overridePolicy: allowed", "owner:", "  team: test-team"].join("\n"),
        "utf-8",
      );

      const result = await loadAllSkills({
        codeflexSource: makeSource(baseDir),
        clientSourceList: [],
        repositorySourceList: [],
        config: baseConfig(),
      });

      expect(result.codeflexSkills).toHaveLength(1);
      expect(result.codeflexSkills[0]!.id).toBe("test-skill");
    } finally {
      await rm(baseDir, { recursive: true, force: true });
    }
  });

  it("surfaces diagnostics for skills that fail to load, via the reporter, instead of silently dropping them", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "load-all-skills-"));
    try {
      const brokenSkillDir = join(baseDir, "broken-skill");
      await mkdir(brokenSkillDir, { recursive: true });
      await writeFile(join(brokenSkillDir, "SKILL.md"), "# Broken skill, missing codeflex.yaml", "utf-8");

      const warn = vi.fn();
      const reporter = { debug: vi.fn(), info: vi.fn(), warn, error: vi.fn() };

      const result = await loadAllSkills({
        codeflexSource: makeSource(baseDir),
        clientSourceList: [],
        repositorySourceList: [],
        config: baseConfig(),
        reporter,
      });

      expect(result.codeflexSkills).toHaveLength(0);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("broken-skill"));
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("missing SKILL.md or codeflex.yaml"));
    } finally {
      await rm(baseDir, { recursive: true, force: true });
    }
  });
});
