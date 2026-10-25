import { describe, it, expect, vi } from "vitest";
import { mkdtemp, rm, mkdir, writeFile, readdir, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { homedir } from "node:os";
import { join } from "node:path";

vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return {
    ...actual,
    homedir: vi.fn(actual.homedir),
  };
});

const mockHomedir = vi.mocked(homedir);
import { calculateProjectionTopology } from "../../../src/projection/topology";
import { projectSkills } from "../../../src/projection/projector";
import { cleanStaleProjections } from "../../../src/projection/stale-cleaner";
import { calculateScopedRules, generateScopedRules, cleanStaleScopedRules } from "../../../src/projection/scoped-rules";
import type { EngineeringConfig, ResolvedSkill } from "../../../src/types/index";

describe("calculateProjectionTopology", () => {
  it("should group codex and kilo at ~/.agents/skills when both support it", () => {
    const plan = calculateProjectionTopology(["codex", "kilo"]);

    expect(plan.targets.length).toBe(1);

    const agentsTarget = plan.targets.find((t) => t.path === "~/.agents/skills");
    expect(agentsTarget).toBeDefined();
    expect(agentsTarget?.satisfiesHarnesses).toContain("codex");
    expect(agentsTarget?.satisfiesHarnesses).toContain("kilo");
  });

  it("should create separate target for claude-code (no ~/.agents/skills support)", () => {
    const plan = calculateProjectionTopology(["codex", "claude-code", "kilo"]);

    const agentsTarget = plan.targets.find((t) => t.path === "~/.agents/skills");
    expect(agentsTarget).toBeDefined();
    expect(agentsTarget?.satisfiesHarnesses).toContain("codex");
    expect(agentsTarget?.satisfiesHarnesses).toContain("kilo");

    const claudeTarget = plan.targets.find((t) => t.path === "~/.claude/skills");
    expect(claudeTarget).toBeDefined();
    expect(claudeTarget?.satisfiesHarnesses).toContain("claude-code");
  });

  it("should project copilot to ~/.agents/skills when alone (supports it via compatibility)", () => {
    const plan = calculateProjectionTopology(["copilot"]);

    const agentsTarget = plan.targets.find((t) => t.path === "~/.agents/skills");
    expect(agentsTarget).toBeDefined();
    expect(agentsTarget?.satisfiesHarnesses).toContain("copilot");
  });

  it("should group copilot with codex at ~/.agents/skills", () => {
    const plan = calculateProjectionTopology(["codex", "copilot"]);

    expect(plan.targets.length).toBe(1);
    const agentsTarget = plan.targets.find((t) => t.path === "~/.agents/skills");
    expect(agentsTarget).toBeDefined();
    expect(agentsTarget?.satisfiesHarnesses).toContain("codex");
    expect(agentsTarget?.satisfiesHarnesses).toContain("copilot");
  });

  it("should project cursor to ~/.agents/skills when alone (supports it via compatibility)", () => {
    const plan = calculateProjectionTopology(["cursor"]);

    const agentsTarget = plan.targets.find((t) => t.path === "~/.agents/skills");
    expect(agentsTarget).toBeDefined();
    expect(agentsTarget?.satisfiesHarnesses).toContain("cursor");
  });

  it("should group cursor with codex at ~/.agents/skills", () => {
    const plan = calculateProjectionTopology(["codex", "cursor"]);

    expect(plan.targets.length).toBe(1);
    const agentsTarget = plan.targets.find((t) => t.path === "~/.agents/skills");
    expect(agentsTarget).toBeDefined();
    expect(agentsTarget?.satisfiesHarnesses).toContain("codex");
    expect(agentsTarget?.satisfiesHarnesses).toContain("cursor");
  });

  it("should create separate targets for cursor and claude-code", () => {
    const plan = calculateProjectionTopology(["claude-code", "cursor"]);

    const agentsTarget = plan.targets.find((t) => t.path === "~/.agents/skills");
    expect(agentsTarget).toBeDefined();
    expect(agentsTarget?.satisfiesHarnesses).toContain("cursor");

    const claudeTarget = plan.targets.find((t) => t.path === "~/.claude/skills");
    expect(claudeTarget).toBeDefined();
    expect(claudeTarget?.satisfiesHarnesses).toContain("claude-code");
  });

  it("should project devin to ~/.agents/skills when alone (supports it via compatibility)", () => {
    const plan = calculateProjectionTopology(["devin"]);

    const agentsTarget = plan.targets.find((t) => t.path === "~/.agents/skills");
    expect(agentsTarget).toBeDefined();
    expect(agentsTarget?.satisfiesHarnesses).toContain("devin");
  });

  it("should group devin with codex at ~/.agents/skills", () => {
    const plan = calculateProjectionTopology(["codex", "devin"]);

    expect(plan.targets.length).toBe(1);
    const agentsTarget = plan.targets.find((t) => t.path === "~/.agents/skills");
    expect(agentsTarget).toBeDefined();
    expect(agentsTarget?.satisfiesHarnesses).toContain("codex");
    expect(agentsTarget?.satisfiesHarnesses).toContain("devin");
  });

  it("should create separate targets for devin and claude-code", () => {
    const plan = calculateProjectionTopology(["claude-code", "devin"]);

    const agentsTarget = plan.targets.find((t) => t.path === "~/.agents/skills");
    expect(agentsTarget).toBeDefined();
    expect(agentsTarget?.satisfiesHarnesses).toContain("devin");

    const claudeTarget = plan.targets.find((t) => t.path === "~/.claude/skills");
    expect(claudeTarget).toBeDefined();
    expect(claudeTarget?.satisfiesHarnesses).toContain("claude-code");
  });

  it("should project zoocode to ~/.agents/skills when alone (supports it via compatibility)", () => {
    const plan = calculateProjectionTopology(["zoocode"]);

    const agentsTarget = plan.targets.find((t) => t.path === "~/.agents/skills");
    expect(agentsTarget).toBeDefined();
    expect(agentsTarget?.satisfiesHarnesses).toContain("zoocode");
  });

  it("should group zoocode with codex at ~/.agents/skills", () => {
    const plan = calculateProjectionTopology(["codex", "zoocode"]);

    expect(plan.targets.length).toBe(1);
    const agentsTarget = plan.targets.find((t) => t.path === "~/.agents/skills");
    expect(agentsTarget).toBeDefined();
    expect(agentsTarget?.satisfiesHarnesses).toContain("codex");
    expect(agentsTarget?.satisfiesHarnesses).toContain("zoocode");
  });

  it("should create separate targets for zoocode and claude-code", () => {
    const plan = calculateProjectionTopology(["claude-code", "zoocode"]);

    const agentsTarget = plan.targets.find((t) => t.path === "~/.agents/skills");
    expect(agentsTarget).toBeDefined();
    expect(agentsTarget?.satisfiesHarnesses).toContain("zoocode");

    const claudeTarget = plan.targets.find((t) => t.path === "~/.claude/skills");
    expect(claudeTarget).toBeDefined();
    expect(claudeTarget?.satisfiesHarnesses).toContain("claude-code");
  });

  it("should project jetbrains to ~/.agents/skills (only compatibility path)", () => {
    const plan = calculateProjectionTopology(["jetbrains"]);

    const agentsTarget = plan.targets.find((t) => t.path === "~/.agents/skills");
    expect(agentsTarget).toBeDefined();
    expect(agentsTarget?.satisfiesHarnesses).toContain("jetbrains");
  });

  it("should group jetbrains with codex at ~/.agents/skills", () => {
    const plan = calculateProjectionTopology(["codex", "jetbrains"]);

    expect(plan.targets.length).toBe(1);
    const agentsTarget = plan.targets.find((t) => t.path === "~/.agents/skills");
    expect(agentsTarget).toBeDefined();
    expect(agentsTarget?.satisfiesHarnesses).toContain("codex");
    expect(agentsTarget?.satisfiesHarnesses).toContain("jetbrains");
  });

  it("should project cline to ~/.agents/skills when alone (supports it via compatibility)", () => {
    const plan = calculateProjectionTopology(["cline"]);

    const agentsTarget = plan.targets.find((t) => t.path === "~/.agents/skills");
    expect(agentsTarget).toBeDefined();
    expect(agentsTarget?.satisfiesHarnesses).toContain("cline");
  });

  it("should group cline with codex at ~/.agents/skills", () => {
    const plan = calculateProjectionTopology(["codex", "cline"]);

    expect(plan.targets.length).toBe(1);
    const agentsTarget = plan.targets.find((t) => t.path === "~/.agents/skills");
    expect(agentsTarget).toBeDefined();
    expect(agentsTarget?.satisfiesHarnesses).toContain("codex");
    expect(agentsTarget?.satisfiesHarnesses).toContain("cline");
  });

  it("should create separate targets for cline and claude-code", () => {
    const plan = calculateProjectionTopology(["claude-code", "cline"]);

    const agentsTarget = plan.targets.find((t) => t.path === "~/.agents/skills");
    expect(agentsTarget).toBeDefined();
    expect(agentsTarget?.satisfiesHarnesses).toContain("cline");

    const claudeTarget = plan.targets.find((t) => t.path === "~/.claude/skills");
    expect(claudeTarget).toBeDefined();
    expect(claudeTarget?.satisfiesHarnesses).toContain("claude-code");
  });

  it("should project aider to ~/.agents/skills (only compatibility path)", () => {
    const plan = calculateProjectionTopology(["aider"]);

    const agentsTarget = plan.targets.find((t) => t.path === "~/.agents/skills");
    expect(agentsTarget).toBeDefined();
    expect(agentsTarget?.satisfiesHarnesses).toContain("aider");
  });

  it("should group aider with codex at ~/.agents/skills", () => {
    const plan = calculateProjectionTopology(["codex", "aider"]);

    expect(plan.targets.length).toBe(1);
    const agentsTarget = plan.targets.find((t) => t.path === "~/.agents/skills");
    expect(agentsTarget).toBeDefined();
    expect(agentsTarget?.satisfiesHarnesses).toContain("codex");
    expect(agentsTarget?.satisfiesHarnesses).toContain("aider");
  });

  it("should create separate targets for aider and claude-code", () => {
    const plan = calculateProjectionTopology(["claude-code", "aider"]);

    const agentsTarget = plan.targets.find((t) => t.path === "~/.agents/skills");
    expect(agentsTarget).toBeDefined();
    expect(agentsTarget?.satisfiesHarnesses).toContain("aider");

    const claudeTarget = plan.targets.find((t) => t.path === "~/.claude/skills");
    expect(claudeTarget).toBeDefined();
    expect(claudeTarget?.satisfiesHarnesses).toContain("claude-code");
  });

  it("should throw error for unknown harness", () => {
    expect(() => calculateProjectionTopology(["unknown-harness"])).toThrow("Unknown harness");
  });
});

describe("projectSkills", () => {
  it("should project skills to target directories", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "projection-test-"));
    const fakeHome = join(tempDir, "fake-home");
    await mkdir(fakeHome, { recursive: true });
    mockHomedir.mockReturnValue(fakeHome);

    try {
      const skillDir = join(tempDir, ".codeflex", "skills", "codeflex-test");
      await mkdir(skillDir, { recursive: true });
      await writeFile(join(skillDir, "SKILL.md"), "# Test Skill", "utf-8");

      const plan = calculateProjectionTopology(["codex"]);

      const result = await projectSkills({
        projectRoot: tempDir,
        plan,
        skills: ["codeflex-test"],
      });

      expect(result.projected).toBe(1);
      expect(result.errors).toHaveLength(0);

      const projectedDir = join(fakeHome, ".agents", "skills", "codeflex-test");
      const files = await readdir(projectedDir);
      expect(files).toContain("SKILL.md");
    } finally {
      mockHomedir.mockReset();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should report errors for missing skills", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "projection-test-"));
    const fakeHome = join(tempDir, "fake-home");
    await mkdir(fakeHome, { recursive: true });
    mockHomedir.mockReturnValue(fakeHome);

    try {
      const plan = calculateProjectionTopology(["codex"]);

      const result = await projectSkills({
        projectRoot: tempDir,
        plan,
        skills: ["nonexistent-skill"],
      });

      expect(result.errors.length).toBeGreaterThan(0);
    } finally {
      mockHomedir.mockReset();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it.each(["codex", "opencode", "kilo", "copilot"])(
    "should not destroy a pre-existing global ~/.agents/AGENTS.md file when projecting skills for %s",
    async (harness) => {
      const tempDir = await mkdtemp(join(tmpdir(), "projection-global-agents-md-"));
      const fakeHome = join(tempDir, "fake-home");
      const globalAgentsDir = join(fakeHome, ".agents");
      await mkdir(globalAgentsDir, { recursive: true });
      mockHomedir.mockReturnValue(fakeHome);

      try {
        // Pre-existing global AGENTS.md file, as created by `sync --global`.
        const globalAgentsMdPath = join(globalAgentsDir, "AGENTS.md");
        const globalAgentsMdContent = "# Global CodeFlex Engineering Standards\n";
        await writeFile(globalAgentsMdPath, globalAgentsMdContent, "utf-8");

        const skillDir = join(tempDir, ".codeflex", "skills", "codeflex-test");
        await mkdir(skillDir, { recursive: true });
        await writeFile(join(skillDir, "SKILL.md"), "# Test Skill", "utf-8");

        const plan = calculateProjectionTopology([harness]);

        const result = await projectSkills({
          projectRoot: tempDir,
          plan,
          skills: ["codeflex-test"],
        });

        expect(result.errors).toHaveLength(0);

        // The global AGENTS.md file must remain a file with its original
        // content — it must never be renamed out of the way and replaced by
        // a skill-projection directory (see registry.ts's HarnessCapability
        // doc comment on why nativeSkillPaths/compatibilityPaths must only
        // ever contain directory paths).
        const stats = await stat(globalAgentsMdPath);
        expect(stats.isFile()).toBe(true);
        const finalContent = await readFile(globalAgentsMdPath, "utf-8");
        expect(finalContent).toBe(globalAgentsMdContent);
      } finally {
        mockHomedir.mockReset();
        await rm(tempDir, { recursive: true, force: true });
      }
    },
  );
});

describe("Cline skill projection (home dir) + bootstrap file (project dir) coexistence", () => {
  it("should project skills into ~/.cline/skills and generate the project-local bootstrap file without crashing, even when .clinerules previously existed as a file", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "cline-collision-test-"));
    const fakeHome = join(tempDir, "fake-home");
    await mkdir(fakeHome, { recursive: true });
    mockHomedir.mockReturnValue(fakeHome);

    try {
      // Simulate a prior run where .clinerules was written as a plain bootstrap
      // file (pre-fix behavior), to ensure the fix handles the transition.
      await writeFile(join(tempDir, ".clinerules"), "@AGENTS.md\n", "utf-8");
      await rm(join(tempDir, ".clinerules"));

      const skillDir = join(tempDir, ".codeflex", "skills", "codeflex-test");
      await mkdir(skillDir, { recursive: true });
      await writeFile(join(skillDir, "SKILL.md"), "# Test Skill", "utf-8");

      const plan = calculateProjectionTopology(["cline"]);

      const projectionResult = await projectSkills({
        projectRoot: tempDir,
        plan,
        skills: ["codeflex-test"],
      });

      expect(projectionResult.errors).toHaveLength(0);
      expect(projectionResult.projected).toBe(1);

      // Skill projection now targets ~/.agents/skills (the shared compatibility path),
      // not the harness-specific ~/.cline/skills path.
      const projectedEntries = await readdir(join(fakeHome, ".agents", "skills"));
      expect(projectedEntries).toContain("codeflex-test");

      const { generateAllBootstrapFiles } = await import("../../../src/agents-md/bootstrap-file.js");

      // This previously threw EISDIR when the bootstrap config wrote directly
      // to ".clinerules" while it was also used as a skill projection target.
      // Skill projection no longer touches the project-local ".clinerules"
      // path at all, so this exercises the simpler case of bootstrap-file
      // generation succeeding after a prior file at that path was removed.
      let bootstrapResults;
      try {
        bootstrapResults = await generateAllBootstrapFiles({ projectRoot: tempDir, harnesses: ["cline"] });
      } catch (err) {
        throw new Error(`Expected no error, but got: ${err instanceof Error ? err.stack : String(err)}`, { cause: err });
      }

      const clineResult = bootstrapResults.find((r) => r.path.endsWith(join(".clinerules", "codeflex-bootstrap.md")));
      expect(clineResult).toBeDefined();
      expect(clineResult?.action).toBe("created");

      const bootstrapContent = await readFile(join(tempDir, ".clinerules", "codeflex-bootstrap.md"), "utf-8");
      expect(bootstrapContent).toContain("@~/.agents/AGENTS.md");
      expect(bootstrapContent).toContain("@AGENTS.md");

      const finalEntries = await readdir(join(tempDir, ".clinerules"));
      expect(finalEntries).toContain("codeflex-bootstrap.md");
    } finally {
      mockHomedir.mockReset();
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe("cleanStaleProjections", () => {
  it("should remove stale codeflex-* directories", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "clean-test-"));

    try {
      const projectionDir = join(tempDir, ".agents", "skills");
      await mkdir(projectionDir, { recursive: true });
      await mkdir(join(projectionDir, "codeflex-old"), { recursive: true });
      await mkdir(join(projectionDir, "codeflex-current"), { recursive: true });

      const result = await cleanStaleProjections({
        projectRoot: tempDir,
        projectionPaths: [".agents/skills"],
        currentSkills: ["codeflex-current"],
      });

      expect(result.removed).toContain(".agents/skills/codeflex-old");
      expect(result.removed).not.toContain(".agents/skills/codeflex-current");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should not remove non-codeflex directories", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "clean-test-"));

    try {
      const projectionDir = join(tempDir, ".agents", "skills");
      await mkdir(projectionDir, { recursive: true });
      await mkdir(join(projectionDir, "custom-skill"), { recursive: true });

      const result = await cleanStaleProjections({
        projectRoot: tempDir,
        projectionPaths: [".agents/skills"],
        currentSkills: [],
      });

      expect(result.removed).not.toContain(".agents/skills/custom-skill");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should remove stale client skill directories", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "clean-test-"));

    try {
      const projectionDir = join(tempDir, ".agents", "skills");
      await mkdir(projectionDir, { recursive: true });
      await mkdir(join(projectionDir, "client-old-skill"), { recursive: true });
      await mkdir(join(projectionDir, "client-current-skill"), { recursive: true });

      const result = await cleanStaleProjections({
        projectRoot: tempDir,
        projectionPaths: [".agents/skills"],
        currentSkills: ["client-current-skill"],
        clientSkillIds: ["client-old-skill", "client-current-skill"],
      });

      expect(result.removed).toContain(".agents/skills/client-old-skill");
      expect(result.removed).not.toContain(".agents/skills/client-current-skill");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should not remove client skills not listed in clientSkillIds", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "clean-test-"));

    try {
      const projectionDir = join(tempDir, ".agents", "skills");
      await mkdir(projectionDir, { recursive: true });
      await mkdir(join(projectionDir, "unmanaged-skill"), { recursive: true });

      const result = await cleanStaleProjections({
        projectRoot: tempDir,
        projectionPaths: [".agents/skills"],
        currentSkills: [],
        clientSkillIds: [],
      });

      expect(result.removed).not.toContain(".agents/skills/unmanaged-skill");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe("calculateScopedRules", () => {
  it("should return empty array when no scopes exist", () => {
    const config: EngineeringConfig = {
      version: 1,
      autoDetect: true,
      agentHarnesses: ["codex"],
      standards: { codeflex: { enabled: true } },
      include: [],
      exclude: [],
      scopes: {},
      exceptions: [],
    };

    const resolvedSkills: ResolvedSkill[] = [
      { id: "codeflex-dotnet", slug: "codeflex-dotnet", source: "codeflex" },
    ];

    const rules = calculateScopedRules(config, resolvedSkills);
    expect(rules).toHaveLength(0);
  });

  it("should group skills by scope from resolved skills", () => {
    const config: EngineeringConfig = {
      version: 1,
      autoDetect: true,
      agentHarnesses: ["codex"],
      standards: { codeflex: { enabled: true } },
      include: [],
      exclude: [],
      scopes: {},
      exceptions: [],
    };

    const resolvedSkills: ResolvedSkill[] = [
      { id: "codeflex-dotnet", slug: "codeflex-dotnet", source: "codeflex", scopes: ["src/**/*.cs"] },
      { id: "codeflex-csharp", slug: "codeflex-csharp", source: "codeflex", scopes: ["src/**/*.cs"] },
    ];

    const rules = calculateScopedRules(config, resolvedSkills);
    expect(rules).toHaveLength(1);
    expect(rules[0].pathPattern).toBe("src/**/*.cs");
    expect(rules[0].skillIds).toContain("codeflex-dotnet");
    expect(rules[0].skillIds).toContain("codeflex-csharp");
  });

  it("should merge scopes from config and resolved skills", () => {
    const config: EngineeringConfig = {
      version: 1,
      autoDetect: true,
      agentHarnesses: ["codex"],
      standards: { codeflex: { enabled: true } },
      include: [],
      exclude: [],
      scopes: { "codeflex-dotnet": ["tests/**/*.cs"] },
      exceptions: [],
    };

    const resolvedSkills: ResolvedSkill[] = [
      { id: "codeflex-dotnet", slug: "codeflex-dotnet", source: "codeflex", scopes: ["src/**/*.cs"] },
    ];

    const rules = calculateScopedRules(config, resolvedSkills);
    expect(rules).toHaveLength(2);

    const srcRule = rules.find((r) => r.pathPattern === "src/**/*.cs");
    expect(srcRule).toBeDefined();
    expect(srcRule?.skillIds).toContain("codeflex-dotnet");

    const testRule = rules.find((r) => r.pathPattern === "tests/**/*.cs");
    expect(testRule).toBeDefined();
    expect(testRule?.skillIds).toContain("codeflex-dotnet");
  });

  it("should map config scope technology names to projected skill slugs", () => {
    const config: EngineeringConfig = {
      version: 1,
      autoDetect: true,
      agentHarnesses: ["codex"],
      standards: { codeflex: { enabled: true } },
      include: [],
      exclude: [],
      scopes: { "angular": ["ClientApp/**"] },
      exceptions: [],
    };

    const resolvedSkills: ResolvedSkill[] = [
      { id: "codeflex-angular", slug: "codeflex-angular", source: "codeflex" },
    ];

    const rules = calculateScopedRules(config, resolvedSkills);
    expect(rules).toHaveLength(1);
    expect(rules[0].pathPattern).toBe("ClientApp/**");
    expect(rules[0].skillIds).toContain("codeflex-angular");
    expect(rules[0].skillIds).not.toContain("angular");
  });

  it("should drop config scope keys that match no projected skill", () => {
    const config: EngineeringConfig = {
      version: 1,
      autoDetect: true,
      agentHarnesses: ["codex"],
      standards: { codeflex: { enabled: true } },
      include: [],
      exclude: [],
      scopes: { "ngxs": ["ClientApp/**"] },
      exceptions: [],
    };

    const resolvedSkills: ResolvedSkill[] = [
      { id: "codeflex-angular", slug: "codeflex-angular", source: "codeflex" },
    ];

    const rules = calculateScopedRules(config, resolvedSkills);
    expect(rules).toHaveLength(0);
  });

  it("should merge config scopes with resolved skill scopes when key is a technology name", () => {
    const config: EngineeringConfig = {
      version: 1,
      autoDetect: true,
      agentHarnesses: ["codex"],
      standards: { codeflex: { enabled: true } },
      include: [],
      exclude: [],
      scopes: { "angular": ["ClientApp/**/*.test.ts"] },
      exceptions: [],
    };

    const resolvedSkills: ResolvedSkill[] = [
      { id: "codeflex-angular", slug: "codeflex-angular", source: "codeflex", scopes: ["ClientApp/**"] },
    ];

    const rules = calculateScopedRules(config, resolvedSkills);
    expect(rules).toHaveLength(2);

    const broadRule = rules.find((r) => r.pathPattern === "ClientApp/**");
    expect(broadRule).toBeDefined();
    expect(broadRule?.skillIds).toContain("codeflex-angular");

    const testRule = rules.find((r) => r.pathPattern === "ClientApp/**/*.test.ts");
    expect(testRule).toBeDefined();
    expect(testRule?.skillIds).toContain("codeflex-angular");
  });

  it("should map 'dotnet' to 'codeflex-dotnet'", () => {
    const config: EngineeringConfig = {
      version: 1,
      autoDetect: true,
      agentHarnesses: ["codex"],
      standards: { codeflex: { enabled: true } },
      include: [],
      exclude: [],
      scopes: { "dotnet": ["src/**/*.cs"] },
      exceptions: [],
    };

    const resolvedSkills: ResolvedSkill[] = [
      { id: "codeflex-dotnet", slug: "codeflex-dotnet", source: "codeflex" },
    ];

    const rules = calculateScopedRules(config, resolvedSkills);
    expect(rules).toHaveLength(1);
    expect(rules[0].pathPattern).toBe("src/**/*.cs");
    expect(rules[0].skillIds).toContain("codeflex-dotnet");
    expect(rules[0].skillIds).not.toContain("dotnet");
  });

  it("should map 'ef-core' to 'codeflex-ef-core'", () => {
    const config: EngineeringConfig = {
      version: 1,
      autoDetect: true,
      agentHarnesses: ["codex"],
      standards: { codeflex: { enabled: true } },
      include: [],
      exclude: [],
      scopes: { "ef-core": ["src/**/*.cs"] },
      exceptions: [],
    };

    const resolvedSkills: ResolvedSkill[] = [
      { id: "codeflex-ef-core", slug: "codeflex-ef-core", source: "codeflex" },
    ];

    const rules = calculateScopedRules(config, resolvedSkills);
    expect(rules).toHaveLength(1);
    expect(rules[0].pathPattern).toBe("src/**/*.cs");
    expect(rules[0].skillIds).toContain("codeflex-ef-core");
    expect(rules[0].skillIds).not.toContain("ef-core");
  });

  it("should map 'security' to 'codeflex-security'", () => {
    const config: EngineeringConfig = {
      version: 1,
      autoDetect: true,
      agentHarnesses: ["codex"],
      standards: { codeflex: { enabled: true } },
      include: [],
      exclude: [],
      scopes: { "security": ["src/**/*.cs"] },
      exceptions: [],
    };

    const resolvedSkills: ResolvedSkill[] = [
      { id: "codeflex-security", slug: "codeflex-security", source: "codeflex" },
    ];

    const rules = calculateScopedRules(config, resolvedSkills);
    expect(rules).toHaveLength(1);
    expect(rules[0].pathPattern).toBe("src/**/*.cs");
    expect(rules[0].skillIds).toContain("codeflex-security");
    expect(rules[0].skillIds).not.toContain("security");
  });

  it("should map multiple technology names to their respective projected skills", () => {
    const config: EngineeringConfig = {
      version: 1,
      autoDetect: true,
      agentHarnesses: ["codex"],
      standards: { codeflex: { enabled: true } },
      include: [],
      exclude: [],
      scopes: {
        "dotnet": ["src/**/*.cs"],
        "angular": ["ClientApp/**"],
        "ef-core": ["src/Data/**/*.cs"],
      },
      exceptions: [],
    };

    const resolvedSkills: ResolvedSkill[] = [
      { id: "codeflex-dotnet", slug: "codeflex-dotnet", source: "codeflex" },
      { id: "codeflex-angular", slug: "codeflex-angular", source: "codeflex" },
      { id: "codeflex-ef-core", slug: "codeflex-ef-core", source: "codeflex" },
    ];

    const rules = calculateScopedRules(config, resolvedSkills);
    expect(rules).toHaveLength(3);

    const dotnetRule = rules.find((r) => r.pathPattern === "src/**/*.cs");
    expect(dotnetRule).toBeDefined();
    expect(dotnetRule?.skillIds).toContain("codeflex-dotnet");

    const angularRule = rules.find((r) => r.pathPattern === "ClientApp/**");
    expect(angularRule).toBeDefined();
    expect(angularRule?.skillIds).toContain("codeflex-angular");

    const efCoreRule = rules.find((r) => r.pathPattern === "src/Data/**/*.cs");
    expect(efCoreRule).toBeDefined();
    expect(efCoreRule?.skillIds).toContain("codeflex-ef-core");
  });

  it("should not match partial components (e.g., 'dot' should not match 'codeflex-dotnet')", () => {
    const config: EngineeringConfig = {
      version: 1,
      autoDetect: true,
      agentHarnesses: ["codex"],
      standards: { codeflex: { enabled: true } },
      include: [],
      exclude: [],
      scopes: { "dot": ["src/**/*.cs"] },
      exceptions: [],
    };

    const resolvedSkills: ResolvedSkill[] = [
      { id: "codeflex-dotnet", slug: "codeflex-dotnet", source: "codeflex" },
    ];

    const rules = calculateScopedRules(config, resolvedSkills);
    expect(rules).toHaveLength(0);
  });

  it("should map client and repository skill slugs correctly", () => {
    const config: EngineeringConfig = {
      version: 1,
      autoDetect: true,
      agentHarnesses: ["codex"],
      standards: { codeflex: { enabled: true } },
      include: [],
      exclude: [],
      scopes: { "dotnet": ["src/**/*.cs"] },
      exceptions: [],
    };

    const resolvedSkills: ResolvedSkill[] = [
      { id: "codeflex-dotnet", slug: "codeflex-dotnet", source: "codeflex" },
      { id: "client-dotnet", slug: "client-dotnet", source: "client" },
      { id: "repo-dotnet", slug: "repo-dotnet", source: "repository" },
    ];

    const rules = calculateScopedRules(config, resolvedSkills);
    expect(rules).toHaveLength(1);
    expect(rules[0].pathPattern).toBe("src/**/*.cs");
    expect(rules[0].skillIds).toContain("codeflex-dotnet");
    expect(rules[0].skillIds).toContain("client-dotnet");
    expect(rules[0].skillIds).toContain("repo-dotnet");
  });

  it("should map client-specific technology names to client skill slugs", () => {
    const config: EngineeringConfig = {
      version: 1,
      autoDetect: true,
      agentHarnesses: ["codex"],
      standards: { codeflex: { enabled: true } },
      include: [],
      exclude: [],
      scopes: { "auth": ["src/Auth/**"] },
      exceptions: [],
    };

    const resolvedSkills: ResolvedSkill[] = [
      { id: "codeflex-dotnet", slug: "codeflex-dotnet", source: "codeflex" },
      { id: "client-auth", slug: "client-auth", source: "client" },
    ];

    const rules = calculateScopedRules(config, resolvedSkills);
    expect(rules).toHaveLength(1);
    expect(rules[0].pathPattern).toBe("src/Auth/**");
    expect(rules[0].skillIds).toContain("client-auth");
    expect(rules[0].skillIds).not.toContain("codeflex-dotnet");
  });

  it("should map repository-specific technology names to repository skill slugs", () => {
    const config: EngineeringConfig = {
      version: 1,
      autoDetect: true,
      agentHarnesses: ["codex"],
      standards: { codeflex: { enabled: true } },
      include: [],
      exclude: [],
      scopes: { "custom": ["src/Custom/**"] },
      exceptions: [],
    };

    const resolvedSkills: ResolvedSkill[] = [
      { id: "codeflex-dotnet", slug: "codeflex-dotnet", source: "codeflex" },
      { id: "repo-custom", slug: "repo-custom", source: "repository" },
    ];

    const rules = calculateScopedRules(config, resolvedSkills);
    expect(rules).toHaveLength(1);
    expect(rules[0].pathPattern).toBe("src/Custom/**");
    expect(rules[0].skillIds).toContain("repo-custom");
    expect(rules[0].skillIds).not.toContain("codeflex-dotnet");
  });
});

describe("generateScopedRules", () => {
  it("should generate scoped rules for claude-code harness", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "scoped-rules-test-"));

    try {
      const config: EngineeringConfig = {
        version: 1,
        autoDetect: true,
        agentHarnesses: ["claude-code"],
        standards: { codeflex: { enabled: true } },
        include: [],
        exclude: [],
        scopes: {},
        exceptions: [],
      };

      const resolvedSkills: ResolvedSkill[] = [
        { id: "codeflex-dotnet", slug: "codeflex-dotnet", source: "codeflex", scopes: ["src/**/*.cs"] },
      ];

      const result = await generateScopedRules({
        projectRoot: tempDir,
        config,
        resolvedSkills,
        harness: "claude-code",
      });

      expect(result.generated).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
      expect(result.generated[0]).toContain(join(".claude", "rules") + "");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should generate scoped rules for copilot harness", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "scoped-rules-test-"));

    try {
      const config: EngineeringConfig = {
        version: 1,
        autoDetect: true,
        agentHarnesses: ["copilot"],
        standards: { codeflex: { enabled: true } },
        include: [],
        exclude: [],
        scopes: {},
        exceptions: [],
      };

      const resolvedSkills: ResolvedSkill[] = [
        { id: "codeflex-dotnet", slug: "codeflex-dotnet", source: "codeflex", scopes: ["src/**/*.cs"] },
      ];

      const result = await generateScopedRules({
        projectRoot: tempDir,
        config,
        resolvedSkills,
        harness: "copilot",
      });

      expect(result.generated).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
      expect(result.generated[0]).toContain(join(".github", "instructions") + "");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should generate scoped rules for cursor harness", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "scoped-rules-test-"));

    try {
      const config: EngineeringConfig = {
        version: 1,
        autoDetect: true,
        agentHarnesses: ["cursor"],
        standards: { codeflex: { enabled: true } },
        include: [],
        exclude: [],
        scopes: {},
        exceptions: [],
      };

      const resolvedSkills: ResolvedSkill[] = [
        { id: "codeflex-dotnet", slug: "codeflex-dotnet", source: "codeflex", scopes: ["src/**/*.cs"] },
      ];

      const result = await generateScopedRules({
        projectRoot: tempDir,
        config,
        resolvedSkills,
        harness: "cursor",
      });

      expect(result.generated).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
      expect(result.generated[0]).toContain(join(".cursor", "rules") + "");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should generate scoped rules for windsurf harness", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "scoped-rules-test-"));

    try {
      const config: EngineeringConfig = {
        version: 1,
        autoDetect: true,
        agentHarnesses: ["devin"],
        standards: { codeflex: { enabled: true } },
        include: [],
        exclude: [],
        scopes: {},
        exceptions: [],
      };

      const resolvedSkills: ResolvedSkill[] = [
        { id: "codeflex-dotnet", slug: "codeflex-dotnet", source: "codeflex", scopes: ["src/**/*.cs"] },
      ];

      const result = await generateScopedRules({
        projectRoot: tempDir,
        config,
        resolvedSkills,
        harness: "devin",
      });

      expect(result.generated).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
      expect(result.generated[0]).toContain(join(".devin", "rules") + "");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should generate scoped rules for roo harness", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "scoped-rules-test-"));

    try {
      const config: EngineeringConfig = {
        version: 1,
        autoDetect: true,
        agentHarnesses: ["zoocode"],
        standards: { codeflex: { enabled: true } },
        include: [],
        exclude: [],
        scopes: {},
        exceptions: [],
      };

      const resolvedSkills: ResolvedSkill[] = [
        { id: "codeflex-dotnet", slug: "codeflex-dotnet", source: "codeflex", scopes: ["src/**/*.cs"] },
      ];

      const result = await generateScopedRules({
        projectRoot: tempDir,
        config,
        resolvedSkills,
        harness: "zoocode",
      });

      expect(result.generated).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
      expect(result.generated[0]).toContain(join(".roo", "rules") + "");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should generate scoped rules for cline harness", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "scoped-rules-test-"));

    try {
      const config: EngineeringConfig = {
        version: 1,
        autoDetect: true,
        agentHarnesses: ["cline"],
        standards: { codeflex: { enabled: true } },
        include: [],
        exclude: [],
        scopes: {},
        exceptions: [],
      };

      const resolvedSkills: ResolvedSkill[] = [
        { id: "codeflex-dotnet", slug: "codeflex-dotnet", source: "codeflex", scopes: ["src/**/*.cs"] },
      ];

      const result = await generateScopedRules({
        projectRoot: tempDir,
        config,
        resolvedSkills,
        harness: "cline",
      });

      expect(result.generated).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
      expect(result.generated[0]).toContain(join(".clinerules") + "");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should return empty when no scoped rules exist", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "scoped-rules-test-"));

    try {
      const config: EngineeringConfig = {
        version: 1,
        autoDetect: true,
        agentHarnesses: ["codex"],
        standards: { codeflex: { enabled: true } },
        include: [],
        exclude: [],
        scopes: {},
        exceptions: [],
      };

      const resolvedSkills: ResolvedSkill[] = [
        { id: "codeflex-dotnet", slug: "codeflex-dotnet", source: "codeflex" },
      ];

      const result = await generateScopedRules({
        projectRoot: tempDir,
        config,
        resolvedSkills,
        harness: "claude-code",
      });

      expect(result.generated).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should generate .md files with paths frontmatter for claude-code", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "scoped-rules-format-test-"));

    try {
      const config: EngineeringConfig = {
        version: 1,
        autoDetect: true,
        agentHarnesses: ["claude-code"],
        standards: { codeflex: { enabled: true } },
        include: [],
        exclude: [],
        scopes: {},
        exceptions: [],
      };

      const resolvedSkills: ResolvedSkill[] = [
        { id: "codeflex-dotnet", slug: "codeflex-dotnet", source: "codeflex", scopes: ["src/**/*.cs"] },
      ];

      const result = await generateScopedRules({
        projectRoot: tempDir,
        config,
        resolvedSkills,
        harness: "claude-code",
      });

      expect(result.generated).toHaveLength(1);
      expect(result.generated[0]).toMatch(/\.md$/);
      expect(result.generated[0]).not.toMatch(/\.mdc$/);
      expect(result.generated[0]).not.toMatch(/\.instructions\.md$/);

      const content = await readFile(result.generated[0], "utf-8");
      expect(content).toContain("paths: src/**/*.cs");
      expect(content).not.toContain("applyTo:");
      expect(content).not.toContain("alwaysApply:");
      expect(content).not.toContain("globs:");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should generate .mdc files with globs and alwaysApply frontmatter for cursor", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "scoped-rules-format-test-"));

    try {
      const config: EngineeringConfig = {
        version: 1,
        autoDetect: true,
        agentHarnesses: ["cursor"],
        standards: { codeflex: { enabled: true } },
        include: [],
        exclude: [],
        scopes: {},
        exceptions: [],
      };

      const resolvedSkills: ResolvedSkill[] = [
        { id: "codeflex-dotnet", slug: "codeflex-dotnet", source: "codeflex", scopes: ["src/**/*.cs"] },
      ];

      const result = await generateScopedRules({
        projectRoot: tempDir,
        config,
        resolvedSkills,
        harness: "cursor",
      });

      expect(result.generated).toHaveLength(1);
      expect(result.generated[0]).toMatch(/\.mdc$/);

      const content = await readFile(result.generated[0], "utf-8");
      expect(content).toContain("globs: src/**/*.cs");
      expect(content).toContain("alwaysApply: false");
      expect(content).not.toContain("applyTo:");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should generate .instructions.md files with applyTo frontmatter for copilot", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "scoped-rules-format-test-"));

    try {
      const config: EngineeringConfig = {
        version: 1,
        autoDetect: true,
        agentHarnesses: ["copilot"],
        standards: { codeflex: { enabled: true } },
        include: [],
        exclude: [],
        scopes: {},
        exceptions: [],
      };

      const resolvedSkills: ResolvedSkill[] = [
        { id: "codeflex-dotnet", slug: "codeflex-dotnet", source: "codeflex", scopes: ["src/**/*.cs"] },
      ];

      const result = await generateScopedRules({
        projectRoot: tempDir,
        config,
        resolvedSkills,
        harness: "copilot",
      });

      expect(result.generated).toHaveLength(1);
      expect(result.generated[0]).toMatch(/\.instructions\.md$/);

      const content = await readFile(result.generated[0], "utf-8");
      expect(content).toContain("applyTo: src/**/*.cs");
      expect(content).not.toContain("globs:");
      expect(content).not.toContain("alwaysApply:");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should generate .md files with paths frontmatter for kilo", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "scoped-rules-format-test-"));

    try {
      const config: EngineeringConfig = {
        version: 1,
        autoDetect: true,
        agentHarnesses: ["kilo"],
        standards: { codeflex: { enabled: true } },
        include: [],
        exclude: [],
        scopes: {},
        exceptions: [],
      };

      const resolvedSkills: ResolvedSkill[] = [
        { id: "codeflex-dotnet", slug: "codeflex-dotnet", source: "codeflex", scopes: ["src/**/*.cs"] },
      ];

      const result = await generateScopedRules({
        projectRoot: tempDir,
        config,
        resolvedSkills,
        harness: "kilo",
      });

      expect(result.generated).toHaveLength(1);
      expect(result.generated[0]).toMatch(/\.md$/);
      expect(result.generated[0]).not.toMatch(/\.mdc$/);

      const content = await readFile(result.generated[0], "utf-8");
      expect(content).toContain("paths: src/**/*.cs");
      expect(content).not.toContain("applyTo:");
      expect(content).not.toContain("alwaysApply:");
      expect(content).not.toContain("globs:");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should generate .md files with globs frontmatter for windsurf", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "scoped-rules-format-test-"));

    try {
      const config: EngineeringConfig = {
        version: 1,
        autoDetect: true,
        agentHarnesses: ["devin"],
        standards: { codeflex: { enabled: true } },
        include: [],
        exclude: [],
        scopes: {},
        exceptions: [],
      };

      const resolvedSkills: ResolvedSkill[] = [
        { id: "codeflex-dotnet", slug: "codeflex-dotnet", source: "codeflex", scopes: ["src/**/*.cs"] },
      ];

      const result = await generateScopedRules({
        projectRoot: tempDir,
        config,
        resolvedSkills,
        harness: "devin",
      });

      expect(result.generated).toHaveLength(1);
      expect(result.generated[0]).toMatch(/\.md$/);

      const content = await readFile(result.generated[0], "utf-8");
      expect(content).toContain("globs: src/**/*.cs");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should generate .md files with globs frontmatter for cline", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "scoped-rules-format-test-"));

    try {
      const config: EngineeringConfig = {
        version: 1,
        autoDetect: true,
        agentHarnesses: ["cline"],
        standards: { codeflex: { enabled: true } },
        include: [],
        exclude: [],
        scopes: {},
        exceptions: [],
      };

      const resolvedSkills: ResolvedSkill[] = [
        { id: "codeflex-dotnet", slug: "codeflex-dotnet", source: "codeflex", scopes: ["src/**/*.cs"] },
      ];

      const result = await generateScopedRules({
        projectRoot: tempDir,
        config,
        resolvedSkills,
        harness: "cline",
      });

      expect(result.generated).toHaveLength(1);
      expect(result.generated[0]).toMatch(/\.md$/);

      const content = await readFile(result.generated[0], "utf-8");
      expect(content).toContain("globs: src/**/*.cs");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should generate .md files with globs frontmatter for roo", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "scoped-rules-format-test-"));

    try {
      const config: EngineeringConfig = {
        version: 1,
        autoDetect: true,
        agentHarnesses: ["zoocode"],
        standards: { codeflex: { enabled: true } },
        include: [],
        exclude: [],
        scopes: {},
        exceptions: [],
      };

      const resolvedSkills: ResolvedSkill[] = [
        { id: "codeflex-dotnet", slug: "codeflex-dotnet", source: "codeflex", scopes: ["src/**/*.cs"] },
      ];

      const result = await generateScopedRules({
        projectRoot: tempDir,
        config,
        resolvedSkills,
        harness: "zoocode",
      });

      expect(result.generated).toHaveLength(1);
      expect(result.generated[0]).toMatch(/\.md$/);

      const content = await readFile(result.generated[0], "utf-8");
      expect(content).toContain("globs: src/**/*.cs");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe("cleanStaleScopedRules", () => {
  const makeConfig = (harness: string): EngineeringConfig => ({
    version: 1,
    autoDetect: true,
    agentHarnesses: [harness],
    standards: { codeflex: { enabled: true } },
    include: [],
    exclude: [],
    scopes: {},
    exceptions: [],
  });

  it("should remove stale codeflex-scoped-*.md files not matching current scopes", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "clean-scoped-test-"));

    try {
      const rulesDir = join(tempDir, ".claude", "rules");
      await mkdir(rulesDir, { recursive: true });
      await writeFile(join(rulesDir, "codeflex-scoped-src------cs.md"), "current", "utf-8");
      await writeFile(join(rulesDir, "codeflex-scoped-tests--cs.md"), "stale", "utf-8");

      const config = makeConfig("claude-code");
      const resolvedSkills: ResolvedSkill[] = [
        { id: "codeflex-dotnet", slug: "codeflex-dotnet", source: "codeflex", scopes: ["src/**/*.cs"] },
      ];

      const result = await cleanStaleScopedRules({
        projectRoot: tempDir,
        config,
        resolvedSkills,
        harness: "claude-code",
      });

      expect(result.removed).toContain(join(".claude", "rules") + "/codeflex-scoped-tests--cs.md");
      expect(result.removed).not.toContain(join(".claude", "rules") + "/codeflex-scoped-src------cs.md");
      expect(result.errors).toHaveLength(0);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should preserve non-codeflex-scoped files", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "clean-scoped-test-"));

    try {
      const rulesDir = join(tempDir, ".claude", "rules");
      await mkdir(rulesDir, { recursive: true });
      await writeFile(join(rulesDir, "custom-rule.md"), "custom", "utf-8");
      await writeFile(join(rulesDir, "codeflex-scoped-old.md"), "stale", "utf-8");

      const config = makeConfig("claude-code");
      const resolvedSkills: ResolvedSkill[] = [];

      const result = await cleanStaleScopedRules({
        projectRoot: tempDir,
        config,
        resolvedSkills,
        harness: "claude-code",
      });

      expect(result.removed).toContain(join(".claude", "rules") + "/codeflex-scoped-old.md");

      const remaining = await readdir(rulesDir);
      expect(remaining).toContain("custom-rule.md");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should handle missing directory gracefully", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "clean-scoped-test-"));

    try {
      const config = makeConfig("claude-code");
      const resolvedSkills: ResolvedSkill[] = [];

      const result = await cleanStaleScopedRules({
        projectRoot: tempDir,
        config,
        resolvedSkills,
        harness: "claude-code",
      });

      expect(result.removed).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should return empty for unknown harness", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "clean-scoped-test-"));

    try {
      const config = makeConfig("unknown");
      const resolvedSkills: ResolvedSkill[] = [];

      const result = await cleanStaleScopedRules({
        projectRoot: tempDir,
        config,
        resolvedSkills,
        harness: "unknown",
      });

      expect(result.removed).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should work across different harness directories", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "clean-scoped-test-"));

    try {
      const kiloRulesDir = join(tempDir, ".kilo", "rules");
      await mkdir(kiloRulesDir, { recursive: true });
      await writeFile(join(kiloRulesDir, "codeflex-scoped-old-pattern.md"), "stale", "utf-8");

      const config = makeConfig("kilo");
      const resolvedSkills: ResolvedSkill[] = [
        { id: "codeflex-ts", slug: "codeflex-ts", source: "codeflex", scopes: ["src/**/*.ts"] },
      ];

      const result = await cleanStaleScopedRules({
        projectRoot: tempDir,
        config,
        resolvedSkills,
        harness: "kilo",
      });

      expect(result.removed).toContain(join(".kilo", "rules") + "/codeflex-scoped-old-pattern.md");
      expect(result.errors).toHaveLength(0);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should clean stale .mdc files for cursor harness", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "clean-scoped-test-"));

    try {
      const cursorRulesDir = join(tempDir, ".cursor", "rules");
      await mkdir(cursorRulesDir, { recursive: true });
      await writeFile(join(cursorRulesDir, "codeflex-scoped-src------cs.mdc"), "current", "utf-8");
      await writeFile(join(cursorRulesDir, "codeflex-scoped-stale.mdc"), "stale", "utf-8");
      await writeFile(join(cursorRulesDir, "codeflex-scoped-old.md"), "old-format", "utf-8");

      const config = makeConfig("cursor");
      const resolvedSkills: ResolvedSkill[] = [
        { id: "codeflex-dotnet", slug: "codeflex-dotnet", source: "codeflex", scopes: ["src/**/*.cs"] },
      ];

      const result = await cleanStaleScopedRules({
        projectRoot: tempDir,
        config,
        resolvedSkills,
        harness: "cursor",
      });

      expect(result.removed).toContain(join(".cursor", "rules") + "/codeflex-scoped-stale.mdc");
      expect(result.removed).not.toContain(join(".cursor", "rules") + "/codeflex-scoped-src------cs.mdc");
      expect(result.removed).not.toContain(join(".cursor", "rules") + "/codeflex-scoped-old.md");
      expect(result.errors).toHaveLength(0);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should clean stale .instructions.md files for copilot harness", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "clean-scoped-test-"));

    try {
      const copilotRulesDir = join(tempDir, ".github", "instructions");
      await mkdir(copilotRulesDir, { recursive: true });
      await writeFile(join(copilotRulesDir, "codeflex-scoped-src------cs.instructions.md"), "current", "utf-8");
      await writeFile(join(copilotRulesDir, "codeflex-scoped-stale.instructions.md"), "stale", "utf-8");
      await writeFile(join(copilotRulesDir, "codeflex-scoped-old.md"), "old-format", "utf-8");

      const config = makeConfig("copilot");
      const resolvedSkills: ResolvedSkill[] = [
        { id: "codeflex-dotnet", slug: "codeflex-dotnet", source: "codeflex", scopes: ["src/**/*.cs"] },
      ];

      const result = await cleanStaleScopedRules({
        projectRoot: tempDir,
        config,
        resolvedSkills,
        harness: "copilot",
      });

      expect(result.removed).toContain(join(".github", "instructions") + "/codeflex-scoped-stale.instructions.md");
      expect(result.removed).not.toContain(join(".github", "instructions") + "/codeflex-scoped-src------cs.instructions.md");
      expect(result.removed).not.toContain(join(".github", "instructions") + "/codeflex-scoped-old.md");
      expect(result.errors).toHaveLength(0);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
