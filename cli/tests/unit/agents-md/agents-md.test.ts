import { describe, it, expect } from "vitest";
import { mkdtemp, rm, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { normalizeAgentsMd } from "../../../src/agents-md/normalizer";
import {
  generateClaudeMd,
  generateCursorRulesMd,
  generateZooCodeRulesMd,
  generateJetbrainsGuidelinesMd,
  generateClinerulesMd,
} from "../../../src/agents-md/bootstrap-generators";
import { BOOTSTRAP_REGISTRY } from "../../../src/agents-md/bootstrap-registry";
import { AgentHarness } from "../../../src/types/index";
import { MANAGED_SECTION_START, MANAGED_SECTION_END } from "../../../src/agents-md/markers";
import { generateManagedSection } from "../../../src/agents-md/section-generator";

describe("normalizeAgentsMd", () => {
  it("should create AGENTS.md if it doesn't exist", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "agents-test-"));

    try {
      const result = await normalizeAgentsMd({ projectRoot: tempDir });

      expect(result.action).toBe("created");

      const content = await readFile(join(tempDir, "AGENTS.md"), "utf-8");
      expect(content).toContain(MANAGED_SECTION_START);
      expect(content).toContain(MANAGED_SECTION_END);
      expect(content).toContain("TWO-STAGE SKILL LOADING");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should update existing AGENTS.md with managed section", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "agents-test-"));

    try {
      const agentsPath = join(tempDir, "AGENTS.md");
      await writeFile(agentsPath, "# Existing Content\n\nSome text here.\n", "utf-8");

      const result = await normalizeAgentsMd({ projectRoot: tempDir });

      expect(result.action).toBe("updated");

      const content = await readFile(agentsPath, "utf-8");
      expect(content).toContain("# Existing Content");
      expect(content).toContain(MANAGED_SECTION_START);
      expect(content).toContain("TWO-STAGE SKILL LOADING");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should not modify AGENTS.md if managed section is current", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "agents-test-"));

    try {
      await normalizeAgentsMd({ projectRoot: tempDir });

      const result = await normalizeAgentsMd({ projectRoot: tempDir });

      expect(result.action).toBe("unchanged");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should respect dryRun flag", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "agents-test-"));

    try {
      const result = await normalizeAgentsMd({ projectRoot: tempDir, dryRun: true });

      expect(result.action).toBe("created");
      expect(result.newContent).toBeDefined();

      let fileExists = false;
      try {
        await readFile(join(tempDir, "AGENTS.md"));
        fileExists = true;
      } catch {
        fileExists = false;
      }
      expect(fileExists).toBe(false);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should adopt legacy section without markers", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "agents-test-"));

    try {
      const agentsPath = join(tempDir, "AGENTS.md");
      const legacyContent = [
        "# My Project",
        "",
        "Some existing content.",
        "",
        "## CodeFlex Engineering Standards",
        "",
        "Old managed content here.",
        "",
        "## Other Section",
        "",
        "More content.",
        "",
      ].join("\n");
      await writeFile(agentsPath, legacyContent, "utf-8");

      const result = await normalizeAgentsMd({ projectRoot: tempDir });

      expect(result.action).toBe("updated");

      const content = await readFile(agentsPath, "utf-8");
      expect(content).toContain("# My Project");
      expect(content).toContain("Some existing content.");
      expect(content).toContain(MANAGED_SECTION_START);
      expect(content).toContain(MANAGED_SECTION_END);
      expect(content).toContain("## Other Section");
      expect(content).not.toContain("Old managed content here.");

      const startCount = (content.match(new RegExp(MANAGED_SECTION_START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
      expect(startCount).toBe(1);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should adopt legacy section at end of file", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "agents-test-"));

    try {
      const agentsPath = join(tempDir, "AGENTS.md");
      const legacyContent = [
        "# My Project",
        "",
        "## CodeFlex Engineering Standards",
        "",
        "Old content at the end.",
        "",
      ].join("\n");
      await writeFile(agentsPath, legacyContent, "utf-8");

      const result = await normalizeAgentsMd({ projectRoot: tempDir });

      expect(result.action).toBe("updated");

      const content = await readFile(agentsPath, "utf-8");
      expect(content).toContain("# My Project");
      expect(content).toContain(MANAGED_SECTION_START);
      expect(content).not.toContain("Old content at the end.");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should deduplicate multiple managed sections", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "agents-test-"));

    try {
      const agentsPath = join(tempDir, "AGENTS.md");
      const managedSection = generateManagedSection();
      const duplicatedContent = [
        "# My Project",
        "",
        "Some content.",
        "",
        managedSection,
        "",
        "Middle content.",
        "",
        managedSection,
        "",
        "End content.",
        "",
      ].join("\n");
      await writeFile(agentsPath, duplicatedContent, "utf-8");

      const result = await normalizeAgentsMd({ projectRoot: tempDir });

      expect(result.action).toBe("deduplicated");

      const content = await readFile(agentsPath, "utf-8");
      expect(content).toContain("# My Project");
      expect(content).toContain("Some content.");
      expect(content).toContain("Middle content.");
      expect(content).toContain("End content.");

      const startCount = (content.match(new RegExp(MANAGED_SECTION_START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
      expect(startCount).toBe(1);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe("generateClaudeMd", () => {
  it("should create CLAUDE.md if claude-code is in harnesses", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "claude-test-"));

    try {
      const result = await generateClaudeMd({
        projectRoot: tempDir,
        harnesses: ["codex", "claude-code"],
      });

      expect(result.action).toBe("created");

      const content = await readFile(join(tempDir, "CLAUDE.md"), "utf-8");
      expect(content).toContain("@AGENTS.md");
      expect(content).toContain("~/.agents/AGENTS.md");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should skip if claude-code is not in harnesses", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "claude-test-"));

    try {
      const result = await generateClaudeMd({
        projectRoot: tempDir,
        harnesses: ["codex", "kilo"],
      });

      expect(result.action).toBe("skipped");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should not modify CLAUDE.md if it already contains the bootstrap marker", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "claude-test-"));

    try {
      const claudePath = join(tempDir, "CLAUDE.md");
      await writeFile(claudePath, "<!-- codeflex-global-standards-reference -->\n@AGENTS.md\n", "utf-8");

      const result = await generateClaudeMd({
        projectRoot: tempDir,
        harnesses: ["claude-code"],
      });

      expect(result.action).toBe("unchanged");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should prepend @AGENTS.md to existing CLAUDE.md", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "claude-test-"));

    try {
      const claudePath = join(tempDir, "CLAUDE.md");
      await writeFile(claudePath, "# Custom Content\n", "utf-8");

      const result = await generateClaudeMd({
        projectRoot: tempDir,
        harnesses: ["claude-code"],
      });

      expect(result.action).toBe("updated");

      const content = await readFile(claudePath, "utf-8");
      expect(content).toContain("@AGENTS.md");
      expect(content).toContain("# Custom Content");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe("generateCursorRulesMd", () => {
  it("should create .cursor/rules/codeflex-bootstrap.mdc if cursor is in harnesses", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "cursor-test-"));

    try {
      const result = await generateCursorRulesMd({
        projectRoot: tempDir,
        harnesses: ["codex", "cursor"],
      });

      expect(result.action).toBe("created");

      const content = await readFile(join(tempDir, ".cursor", "rules", "codeflex-bootstrap.mdc"), "utf-8");
      expect(content).toContain("@~/.agents/AGENTS.md");
      expect(content).toContain("@AGENTS.md");
      // Cursor `.mdc` rules require frontmatter with `alwaysApply: true` or they
      // default to manual @-mention-only activation and never auto-load.
      expect(content).toMatch(/^---\n/);
      expect(content).toContain("alwaysApply: true");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should skip if cursor is not in harnesses", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "cursor-test-"));

    try {
      const result = await generateCursorRulesMd({
        projectRoot: tempDir,
        harnesses: ["codex", "kilo"],
      });

      expect(result.action).toBe("skipped");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should not modify .cursor/rules/codeflex-bootstrap.mdc if it already contains @~/.agents/AGENTS.md", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "cursor-test-"));

    try {
      const cursorDir = join(tempDir, ".cursor", "rules");
      await mkdir(cursorDir, { recursive: true });
      const cursorPath = join(cursorDir, "codeflex-bootstrap.mdc");
      await writeFile(cursorPath, "@~/.agents/AGENTS.md\n@AGENTS.md\n", "utf-8");

      const result = await generateCursorRulesMd({
        projectRoot: tempDir,
        harnesses: ["cursor"],
      });

      expect(result.action).toBe("unchanged");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should prepend @AGENTS.md to existing .cursor/rules/codeflex-bootstrap.mdc", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "cursor-test-"));

    try {
      const cursorDir = join(tempDir, ".cursor", "rules");
      await mkdir(cursorDir, { recursive: true });
      const cursorPath = join(cursorDir, "codeflex-bootstrap.mdc");
      await writeFile(cursorPath, "# Custom Cursor Rules\n", "utf-8");

      const result = await generateCursorRulesMd({
        projectRoot: tempDir,
        harnesses: ["cursor"],
      });

      expect(result.action).toBe("updated");

      const content = await readFile(cursorPath, "utf-8");
      expect(content).toContain("@AGENTS.md");
      expect(content).toContain("# Custom Cursor Rules");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

// Devin CLI reads project rules from `AGENTS.md` at the project root; it has no
// `.devin/rules/` file-discovery path (see https://docs.devin.ai/cli/extensibility/rules).
// No dedicated bootstrap-file generator exists for Devin, and it must never be
// re-added to BOOTSTRAP_REGISTRY, since Devin would never read the generated file.
describe("Devin bootstrap file", () => {
  it("has no dedicated bootstrap-file generator (Devin reads AGENTS.md natively)", () => {
    const devinEntry = BOOTSTRAP_REGISTRY.find((entry) => entry.harness === AgentHarness.Devin);
    expect(devinEntry).toBeUndefined();
  });
});

// Aider only loads AGENTS.md when explicitly listed under `read:` in
// `.aider.conf.yml` (see `ensureAiderReadsAgentsMd` in `../../../src/agents-md/aider-config.ts`
// and https://agents.md/). It has no bootstrap-file or rules-directory convention.
describe("Aider bootstrap file", () => {
  it("has no dedicated bootstrap-file generator (Aider requires .aider.conf.yml wiring instead)", () => {
    const aiderEntry = BOOTSTRAP_REGISTRY.find((entry) => entry.harness === AgentHarness.Aider);
    expect(aiderEntry).toBeUndefined();
  });
});

describe("generateZooCodeRulesMd", () => {
  it("should create .roo/rules/codeflex-bootstrap.md if roo is in harnesses", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "roo-test-"));

    try {
      const result = await generateZooCodeRulesMd({
        projectRoot: tempDir,
        harnesses: ["codex", "zoocode"],
      });

      expect(result.action).toBe("created");

      const content = await readFile(join(tempDir, ".roo", "rules", "codeflex-bootstrap.md"), "utf-8");
      expect(content).toContain("@~/.agents/AGENTS.md");
      expect(content).toContain("@AGENTS.md");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should skip if roo is not in harnesses", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "roo-test-"));

    try {
      const result = await generateZooCodeRulesMd({
        projectRoot: tempDir,
        harnesses: ["codex", "kilo"],
      });

      expect(result.action).toBe("skipped");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should not modify codeflex-bootstrap.md if it already contains @~/.agents/AGENTS.md", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "roo-test-"));

    try {
      const rooDir = join(tempDir, ".roo", "rules");
      await mkdir(rooDir, { recursive: true });
      const rooPath = join(rooDir, "codeflex-bootstrap.md");
      await writeFile(rooPath, "@~/.agents/AGENTS.md\n@AGENTS.md\n", "utf-8");

      const result = await generateZooCodeRulesMd({
        projectRoot: tempDir,
        harnesses: ["zoocode"],
      });

      expect(result.action).toBe("unchanged");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should prepend @AGENTS.md to existing codeflex-bootstrap.md", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "roo-test-"));

    try {
      const rooDir = join(tempDir, ".roo", "rules");
      await mkdir(rooDir, { recursive: true });
      const rooPath = join(rooDir, "codeflex-bootstrap.md");
      await writeFile(rooPath, "# Custom Roo Rules\n", "utf-8");

      const result = await generateZooCodeRulesMd({
        projectRoot: tempDir,
        harnesses: ["zoocode"],
      });

      expect(result.action).toBe("updated");

      const content = await readFile(rooPath, "utf-8");
      expect(content).toContain("@AGENTS.md");
      expect(content).toContain("# Custom Roo Rules");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe("generateJetbrainsGuidelinesMd", () => {
  it("should skip because Junie reads AGENTS.md from project root natively", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "jetbrains-test-"));

    try {
      const result = await generateJetbrainsGuidelinesMd({
        projectRoot: tempDir,
        harnesses: ["codex", "jetbrains"],
      });

      expect(result.action).toBe("skipped");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should skip if jetbrains is not in harnesses", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "jetbrains-test-"));

    try {
      const result = await generateJetbrainsGuidelinesMd({
        projectRoot: tempDir,
        harnesses: ["codex", "kilo"],
      });

      expect(result.action).toBe("skipped");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe("generateClinerulesMd", () => {
  it("should create .clinerules/codeflex-bootstrap.md if cline is in harnesses", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "cline-test-"));

    try {
      const result = await generateClinerulesMd({
        projectRoot: tempDir,
        harnesses: ["codex", "cline"],
      });

      expect(result.action).toBe("created");

      const content = await readFile(join(tempDir, ".clinerules", "codeflex-bootstrap.md"), "utf-8");
      expect(content).toContain("@~/.agents/AGENTS.md");
      expect(content).toContain("@AGENTS.md");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should skip if cline is not in harnesses", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "cline-test-"));

    try {
      const result = await generateClinerulesMd({
        projectRoot: tempDir,
        harnesses: ["codex", "kilo"],
      });

      expect(result.action).toBe("skipped");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should not modify .clinerules/codeflex-bootstrap.md if it already contains @~/.agents/AGENTS.md", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "cline-test-"));

    try {
      const clinerulesPath = join(tempDir, ".clinerules", "codeflex-bootstrap.md");
      await mkdir(dirname(clinerulesPath), { recursive: true });
      await writeFile(clinerulesPath, "@~/.agents/AGENTS.md\n@AGENTS.md\n", "utf-8");

      const result = await generateClinerulesMd({
        projectRoot: tempDir,
        harnesses: ["cline"],
      });

      expect(result.action).toBe("unchanged");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should prepend @AGENTS.md to existing .clinerules/codeflex-bootstrap.md", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "cline-test-"));

    try {
      const clinerulesPath = join(tempDir, ".clinerules", "codeflex-bootstrap.md");
      await mkdir(dirname(clinerulesPath), { recursive: true });
      await writeFile(clinerulesPath, "# Custom Cline Rules\n", "utf-8");

      const result = await generateClinerulesMd({
        projectRoot: tempDir,
        harnesses: ["cline"],
      });

      expect(result.action).toBe("updated");

      const content = await readFile(clinerulesPath, "utf-8");
      expect(content).toContain("@AGENTS.md");
      expect(content).toContain("# Custom Cline Rules");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe("generateManagedSection", () => {
  it("separates cross-cutting and technology-specific skills", () => {
    const section = generateManagedSection(
      ["codeflex-security", "codeflex-dotnet", "codeflex-angular"],
      ["codeflex-security"]
    );

    expect(section).toContain("ALWAYS LOAD (Cross-Cutting)");
    expect(section).toContain("`codeflex-security`");
    expect(section).toContain("LOAD WHEN RELEVANT (Technology-Specific)");
    expect(section).toContain("`codeflex-dotnet`");
    expect(section).toContain("`codeflex-angular`");
  });

  it("shows placeholder when no cross-cutting skills exist", () => {
    const section = generateManagedSection(["codeflex-dotnet"], []);

    expect(section).toContain("No cross-cutting skills resolved");
    expect(section).toContain("`codeflex-dotnet`");
  });

  it("shows placeholder when no technology-specific skills exist", () => {
    const section = generateManagedSection(["codeflex-security"], ["codeflex-security"]);

    expect(section).toContain("`codeflex-security`");
    expect(section).toContain("No technology-specific skills resolved");
  });

  it("references the global ~/.agents/AGENTS.md file", () => {
    const section = generateManagedSection(["codeflex-dotnet"], []);
    expect(section).toContain("~/.agents/AGENTS.md");
    expect(section).toContain("global");
  });

  it("includes two-stage loading structure", () => {
    const section = generateManagedSection(
      ["codeflex-security", "codeflex-dotnet"],
      ["codeflex-security"]
    );

    expect(section).toContain("STAGE 1 — BEFORE EXPLORATION");
    expect(section).toContain("STAGE 2 — AFTER EXPLORATION, BEFORE DESIGN");
  });

  it("includes subagent delegation section", () => {
    const section = generateManagedSection(
      ["codeflex-security", "codeflex-dotnet"],
      ["codeflex-security"]
    );

    expect(section).toContain("SUBAGENT DELEGATION — HARD REQUIREMENT");
    expect(section).toContain("Subagents do NOT inherit your loaded skills");
    expect(section).toContain("Skill assignment by subagent type");
    expect(section).toContain("MANDATORY: Load these skills");
  });

  it("includes harness-specific anchoring section", () => {
    const section = generateManagedSection(["codeflex-dotnet"], []);

    expect(section).toContain("HARNESS-SPECIFIC ANCHORING");
    expect(section).toContain("harness-native checkpoints");
  });

  it("includes example subagent prompts with skill lists", () => {
    const section = generateManagedSection(
      ["codeflex-security", "codeflex-dotnet", "codeflex-angular"],
      ["codeflex-security"]
    );

    expect(section).toContain("Example: Explore subagent prompt");
    expect(section).toContain("Example: Implementation subagent prompt");
    expect(section).toContain("- codeflex-security");
  });

  it("includes verification checklist with both stages", () => {
    const section = generateManagedSection(["codeflex-dotnet"], []);

    expect(section).toContain("Stage 1 (before exploration)");
    expect(section).toContain("Stage 2 (after exploration, before design/implementation)");
  });

  it("includes cross-cutting skills in example explore subagent prompt", () => {
    const section = generateManagedSection(
      ["codeflex-security", "codeflex-dotnet"],
      ["codeflex-security"]
    );

    const explorePromptMatch = section.match(/Example: Explore subagent prompt[\s\S]*?Scope:/);
    expect(explorePromptMatch).not.toBeNull();
    expect(explorePromptMatch![0]).toContain("- codeflex-security");
  });

  it("includes technology-specific skills in example implementation subagent prompt", () => {
    const section = generateManagedSection(
      ["codeflex-security", "codeflex-dotnet", "codeflex-angular"],
      ["codeflex-security"]
    );

    const implPromptMatch = section.match(/Example: Implementation subagent prompt[\s\S]*?Scope:/);
    expect(implPromptMatch).not.toBeNull();
    expect(implPromptMatch![0]).toContain("- codeflex-dotnet");
  });
});
