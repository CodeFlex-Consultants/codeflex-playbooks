import { AgentHarness } from "../types/index";
import type { BootstrapFileConfig } from "./bootstrap-file";
import { GLOBAL_AND_PROJECT_MARKER, LEGACY_UNIVERSAL_MARKER } from "./markers";

export interface HarnessBootstrapConfig extends BootstrapFileConfig {
  harness: AgentHarness;
}

const GLOBAL_AND_PROJECT_INSTRUCTION = "Read the global standards file first, then the project standards file. Load global cross-cutting skills before project-level skills:";

// The bare `@path` marker syntax is a functional, auto-expanding import only
// for Claude Code (see https://code.claude.com/docs/en/memory). Cursor's
// `@file` syntax only attaches relative files referenced from within
// `.cursor/rules/*.mdc` and does not support tilde/home-directory paths (and
// is reported broken as of late 2025 — see https://forum.cursor.com/t/does-file-syntax-works-in-mdc-rules/135663).
// ZooCode/Roo and Cline have no `@path` import mechanism at all for arbitrary
// files. For every harness other than Claude Code, the marker lines below are
// inert reference text unless the underlying LLM chooses to read them as an
// instruction — so an explicit natural-language instruction is prepended to
// make that intent unambiguous for every harness, not just Claude Code.
const GLOBAL_AND_PROJECT_REFERENCE = [
  GLOBAL_AND_PROJECT_INSTRUCTION,
  GLOBAL_AND_PROJECT_MARKER,
  LEGACY_UNIVERSAL_MARKER,
  "",
].join("\n");

// Claude Code's `@path` import does not reliably expand tilde (`~`) paths.
// See https://github.com/anthropics/claude-code/issues/8765 (closed NOT_PLANNED).
// For Claude Code specifically, we omit the `@~/.agents/AGENTS.md` import and
// instead use a natural-language instruction. The `@AGENTS.md` relative import
// works correctly. An HTML comment marker is used for detection since it's
// present in new content but not in legacy content (`@AGENTS.md\n`).
const CLAUDE_MARKER = "<!-- codeflex-global-standards-reference -->";
const CLAUDE_BOOTSTRAP_CONTENT = [
  CLAUDE_MARKER,
  "Read `~/.agents/AGENTS.md` FIRST for global CodeFlex Engineering Standards.",
  "Then read `AGENTS.md` in the project root for project-specific standards.",
  "Load global cross-cutting skills before project-level skills:",
  LEGACY_UNIVERSAL_MARKER,
  "",
].join("\n");

// Cursor `.mdc` rule files require YAML frontmatter to control activation. Without
// it, Cursor defaults to "manual @-mention only" and never auto-loads the rule
// (see https://cursor.com/docs/rules). `alwaysApply: true` makes this bootstrap
// rule load in every conversation, matching the other harnesses' always-on behavior.
const CURSOR_BOOTSTRAP_FRONTMATTER = [
  "---",
  "description: CodeFlex Engineering Standards bootstrap",
  "alwaysApply: true",
  "---",
  "",
].join("\n");

const CURSOR_BOOTSTRAP_CONTENT = CURSOR_BOOTSTRAP_FRONTMATTER + GLOBAL_AND_PROJECT_REFERENCE;

/** Creates a standard bootstrap config referencing global and project AGENTS.md files. */
function standardBootstrap(
  harness: AgentHarness,
  relativePath: string,
  ensureParentDir = false,
): HarnessBootstrapConfig {
  return {
    harness,
    relativePath,
    harnessName: harness,
    expectedContent: GLOBAL_AND_PROJECT_REFERENCE,
    marker: GLOBAL_AND_PROJECT_MARKER,
    ...(ensureParentDir ? { ensureParentDir: true } : {}),
  };
}

// NOTE: Devin, Aider, Antigravity, Amp, Zed, Warp, FactoryAi, and Augment are
// intentionally absent from this registry. All of these harnesses read
// `AGENTS.md`/a configured conventions file directly rather than a dedicated
// bootstrap file (see `HARNESS_REGISTRY` in `../projection/registry.js` for details),
// so no separate bootstrap generator is needed for them.
export const BOOTSTRAP_REGISTRY: HarnessBootstrapConfig[] = [
  {
    harness: AgentHarness.ClaudeCode,
    relativePath: "CLAUDE.md",
    harnessName: AgentHarness.ClaudeCode,
    expectedContent: CLAUDE_BOOTSTRAP_CONTENT,
    marker: CLAUDE_MARKER,
  },
  {
    harness: AgentHarness.Cursor,
    relativePath: ".cursor/rules/codeflex-bootstrap.mdc",
    harnessName: AgentHarness.Cursor,
    expectedContent: CURSOR_BOOTSTRAP_CONTENT,
    marker: GLOBAL_AND_PROJECT_MARKER,
    ensureParentDir: true,
  },
  standardBootstrap(AgentHarness.ZooCode, ".roo/rules/codeflex-bootstrap.md", true),
  // NOTE: JetBrains Junie reads AGENTS.md from the project root natively
  // (verified at https://www.jetbrains.com/help/ai-assistant/junie-agent.html),
  // so no dedicated bootstrap file is generated for it (same as Devin/Aider).
  // Legacy .junie/AGENTS.md and .junie/guidelines.md files are cleaned up via
  // legacyBootstrapFiles in HARNESS_REGISTRY.
  // Lives inside the ".clinerules" directory (which is also the Cline
  // native skill projection target) rather than at ".clinerules" itself,
  // to avoid a file/directory collision with projected skills.
  standardBootstrap(AgentHarness.Cline, ".clinerules/codeflex-bootstrap.md", true),
  // Gemini CLI's default context file is `GEMINI.md` (configurable to
  // `AGENTS.md` via `context.fileName` in `~/.gemini/settings.json`).
  // The bootstrap file instructs Gemini to read global and project standards.
  standardBootstrap(AgentHarness.GeminiCli, "GEMINI.md"),
];
