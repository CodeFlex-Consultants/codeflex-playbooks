import { AgentHarness, ScopedRuleFormat } from "../types/index";
import { GLOBAL_AGENTS_DIR_NAME, GLOBAL_SKILLS_DIR_NAME } from "../agents-md/global-paths";
import { AGENTS_MD_FILENAME } from "../constants";

const GLOBAL_SKILLS_PATH = `~/${GLOBAL_AGENTS_DIR_NAME}/${GLOBAL_SKILLS_DIR_NAME}`;
const CLAUDE_SKILLS_PATH = "~/.claude/skills";

/**
 * Describes the file-system capabilities and conventions of an agent harness.
 *
 * IMPORTANT: `nativeSkillPaths` and `compatibilityPaths` must only ever contain
 * *directory* paths. `calculateProjectionTopology` (`../projection/topology.js`)
 * treats every entry in these two arrays as a skill-projection target directory,
 * and `projectSkills` (`./projector.js`) atomically renames a prepared temp
  * directory over each target path via `swapDirectory`. If a *file* path (such as
 * `~/.agents/AGENTS.md`) were added here, running `init`/`sync` would rename
 * that file out of the way and replace it with a directory of skill folders,
 * destroying its contents. Use `readsGlobalAgentsMd` to record that a harness
 * natively reads the global `~/.agents/AGENTS.md` file — that flag is metadata
 * only and is never consumed by the projection topology/projector.
 */
export interface HarnessCapability {
  /** Harness identifier. */
  name: string;
  /** Relative path to the harness bootstrap file (e.g. AGENTS.md, CLAUDE.md). */
  bootstrapFile: string;
  /** Previous bootstrap file paths that may still exist on older projects. */
  legacyBootstrapFiles?: string[];
  /** Skill directories natively discovered by this harness. */
  nativeSkillPaths: string[];
  /** Additional skill directories used for cross-harness compatibility. */
  compatibilityPaths: string[];
  /**
   * Whether this harness natively discovers and reads the global
   * `~/.agents/AGENTS.md` file on its own (i.e. without relying on the
   * per-project bootstrap file's marker text). Documentation/detection
   * metadata only; never fed into skill-directory projection.
   */
  readsGlobalAgentsMd?: boolean;
  /** Whether the harness supports path-scoped rule files. */
  supportsNativeScoping: boolean;
  /** Format to use for scoped rule files, or null if scoping is not supported. */
  scopedRuleFormat: ScopedRuleFormat | null;
}

/**
 * Complete registry of all supported agent harnesses and their filesystem capabilities.
 * Maps each {@link AgentHarness} to its {@link HarnessCapability} definition.
 */
export const HARNESS_REGISTRY: Record<AgentHarness, HarnessCapability> = {
  [AgentHarness.Codex]: {
    name: AgentHarness.Codex,
    bootstrapFile: "AGENTS.md",
    nativeSkillPaths: [GLOBAL_SKILLS_PATH],
    compatibilityPaths: [],
    readsGlobalAgentsMd: true,
    supportsNativeScoping: false,
    scopedRuleFormat: null,
  },
  [AgentHarness.ClaudeCode]: {
    name: AgentHarness.ClaudeCode,
    bootstrapFile: "CLAUDE.md",
    nativeSkillPaths: [CLAUDE_SKILLS_PATH],
    compatibilityPaths: [],
    supportsNativeScoping: true,
    scopedRuleFormat: ScopedRuleFormat.Claude,
  },
  [AgentHarness.OpenCode]: {
    name: AgentHarness.OpenCode,
    bootstrapFile: "AGENTS.md",
    nativeSkillPaths: ["~/.config/opencode/skills"],
    compatibilityPaths: [GLOBAL_SKILLS_PATH, CLAUDE_SKILLS_PATH],
    readsGlobalAgentsMd: true,
    supportsNativeScoping: false,
    scopedRuleFormat: null,
  },
  [AgentHarness.Kilo]: {
    name: AgentHarness.Kilo,
    bootstrapFile: "AGENTS.md",
    nativeSkillPaths: ["~/.kilo/skills"],
    compatibilityPaths: [GLOBAL_SKILLS_PATH, CLAUDE_SKILLS_PATH],
    readsGlobalAgentsMd: true,
    supportsNativeScoping: true,
    scopedRuleFormat: ScopedRuleFormat.Kilo,
  },
  [AgentHarness.Copilot]: {
    name: AgentHarness.Copilot,
    bootstrapFile: "AGENTS.md",
    nativeSkillPaths: ["~/.copilot/skills"],
    compatibilityPaths: [GLOBAL_SKILLS_PATH, CLAUDE_SKILLS_PATH],
    readsGlobalAgentsMd: true,
    supportsNativeScoping: true,
    scopedRuleFormat: ScopedRuleFormat.Copilot,
  },
  [AgentHarness.Cursor]: {
    name: AgentHarness.Cursor,
    bootstrapFile: ".cursor/rules/codeflex-bootstrap.mdc",
    legacyBootstrapFiles: [".cursorrules"],
    nativeSkillPaths: ["~/.cursor/skills"],
    compatibilityPaths: [GLOBAL_SKILLS_PATH],
    supportsNativeScoping: true,
    scopedRuleFormat: ScopedRuleFormat.Cursor,
  },
  [AgentHarness.ZooCode]: {
    name: AgentHarness.ZooCode,
    bootstrapFile: ".roo/rules/codeflex-bootstrap.md",
    nativeSkillPaths: ["~/.roo/skills"],
    compatibilityPaths: [GLOBAL_SKILLS_PATH],
    supportsNativeScoping: true,
    scopedRuleFormat: ScopedRuleFormat.ZooCode,
  },
  [AgentHarness.Devin]: {
    name: AgentHarness.Devin,
    // Devin CLI reads AGENTS.md automatically at the project root (the
    // recommended approach). It also reads rules from `.devin/rules/*.md` as a
    // separate, still-active discovery path, so any previously projected
    // `.devin/rules/codeflex-bootstrap.md` must be listed as legacy below or it
    // will keep being loaded alongside AGENTS.md. See
    // https://docs.devin.ai/cli/extensibility/rules
    bootstrapFile: "AGENTS.md",
    legacyBootstrapFiles: [".devin/rules/codeflex-bootstrap.md"],
    // Devin's global skills directory follows the XDG convention, not `~/.devin/`.
    // See https://docs.devin.ai/cli/extensibility/skills/overview
    nativeSkillPaths: ["~/.config/devin/skills"],
    // Devin reads from the Windsurf config directory matching its own channel:
    // stable reads from `~/.codeium/windsurf/`, next from `~/.codeium/windsurf-next/`,
    // insiders from `~/.codeium/windsurf-insiders/`. See
    // https://docs.devin.ai/cli/reference/configuration/read-config-from
    compatibilityPaths: [
      GLOBAL_SKILLS_PATH,
      "~/.codeium/windsurf/skills",
      "~/.codeium/windsurf-next/skills",
      "~/.codeium/windsurf-insiders/skills",
    ],
    supportsNativeScoping: true,
    scopedRuleFormat: ScopedRuleFormat.Devin,
  },
  [AgentHarness.Cline]: {
    name: AgentHarness.Cline,
    // NOTE: nativeSkillPaths is projected as a directory that gets atomically
    // replaced by projectSkills(). The bootstrap file must live at a distinct
    // path *inside* that directory (not the directory path itself) to avoid a
    // file/directory collision (EISDIR) when both are generated together. See
    // Roo's identical pattern (".roo/rules/codeflex-bootstrap.md" inside
    // ".roo/rules").
    bootstrapFile: ".clinerules/codeflex-bootstrap.md",
    nativeSkillPaths: ["~/.cline/skills"],
    compatibilityPaths: [GLOBAL_SKILLS_PATH],
    // Cline natively reads both project-root AGENTS.md and the global
    // ~/.agents/AGENTS.md file on its own; see https://docs.cline.bot/customization/cline-rules
    readsGlobalAgentsMd: true,
    supportsNativeScoping: true,
    scopedRuleFormat: ScopedRuleFormat.Cline,
  },
  [AgentHarness.JetBrains]: {
    name: AgentHarness.JetBrains,
    // JetBrains Junie reads AGENTS.md from the project root per the agents.md
    // standard (https://agents.md/). Verified against official Junie docs at
    // https://www.jetbrains.com/help/ai-assistant/junie-agent.html (2026-08).
    // Junie has no native skills directory convention.
    bootstrapFile: "AGENTS.md",
    legacyBootstrapFiles: [".junie/AGENTS.md", ".junie/guidelines.md"],
    nativeSkillPaths: [],
    compatibilityPaths: [GLOBAL_SKILLS_PATH],
    supportsNativeScoping: false,
    scopedRuleFormat: null,
  },
  [AgentHarness.Aider]: {
    name: AgentHarness.Aider,
    // Aider has no bootstrap-file, rules-directory, or skills-directory
    // convention. It only reads `AGENTS.md` when explicitly listed under
    // `read:` in `.aider.conf.yml` (wired by `ensureAiderReadsAgentsMd` in
    // `../agents-md/aider-config.js`). Skills can be loaded as read-only
    // context files via the `read:` config option, but Aider does not
    // auto-discover skills from any directory.
    bootstrapFile: AGENTS_MD_FILENAME,
    nativeSkillPaths: [],
    compatibilityPaths: [GLOBAL_SKILLS_PATH],
    supportsNativeScoping: false,
    scopedRuleFormat: null,
  },
  [AgentHarness.GeminiCli]: {
    name: AgentHarness.GeminiCli,
    // Gemini CLI's default context file is `GEMINI.md` but is configurable
    // to `AGENTS.md` via `context.fileName` in `~/.gemini/settings.json`.
    // Has hierarchical JIT context discovery (scans for context files when
    // tools access directories). Note: Gemini CLI is the predecessor to
    // Google Antigravity; both share the `~/.gemini/` config directory.
    // Global context lives at `~/.gemini/GEMINI.md`, not `~/.agents/AGENTS.md`
    // (per antigravity.google/docs/cli/gcli-migration, which documents Gemini
    // CLI's legacy global-context path), so `readsGlobalAgentsMd` is false.
    bootstrapFile: "GEMINI.md",
    nativeSkillPaths: ["~/.gemini/skills"],
    compatibilityPaths: [GLOBAL_SKILLS_PATH],
    readsGlobalAgentsMd: false,
    supportsNativeScoping: false,
    scopedRuleFormat: null,
  },
  [AgentHarness.Antigravity]: {
    name: AgentHarness.Antigravity,
    // Google Antigravity is the successor product to Gemini CLI (brew
    // formula `gemini-cli` is deprecated with replacement `antigravity-cli`).
    // The CLI binary is `agy`. The IDE ships as "Antigravity IDE.app".
    // All Antigravity products share `~/.gemini/` with Gemini CLI;
    // Antigravity-specific state lives under `~/.gemini/antigravity/`.
    // Reads both `AGENTS.md` and `GEMINI.md` natively at project root
    // and in subdirectories (no bootstrap file needed). Global skills
    // path is `~/.gemini/antigravity-cli/skills/`. Workspace skills
    // path is `.agents/skills/`. Verified at antigravity.google/docs/rules
    // and antigravity.google/docs/cli/gcli-migration. Global *rules*
    // sources are exhaustively documented at antigravity.google/docs/rules
    // as `~/.gemini/AGENTS.md`, `~/.gemini/GEMINI.md`,
    // `~/.gemini/config/AGENTS.md`/`GEMINI.md`, and
    // `~/.gemini/config/rules/*.md` — never `~/.agents/AGENTS.md` — so
    // `readsGlobalAgentsMd` is false.
    bootstrapFile: AGENTS_MD_FILENAME,
    nativeSkillPaths: ["~/.gemini/antigravity-cli/skills", ".agents/skills"],
    compatibilityPaths: [GLOBAL_SKILLS_PATH],
    readsGlobalAgentsMd: false,
    supportsNativeScoping: false,
    scopedRuleFormat: null,
  },
  [AgentHarness.Amp]: {
    name: AgentHarness.Amp,
    // Amp (ampcode.com) is an independent product with CLI (`amp`) and
    // desktop app. Reads `AGENTS.md` natively. Has "Orbs" remote agent
    // system. Documents an explicit skill discovery precedence (highest
    // to lowest): `~/.config/agents/skills/`, `~/.agents/skills/`,
    // `~/.config/amp/skills/`, `.agents/skills/` (project, searched in
    // parent directories), `.claude/skills/`, `~/.claude/skills/`,
    // `~/.claude/plugins/cache/`, configured `amp.skills.path` entries,
    // then built-in/personal/workspace skills. `~/.agents/skills/` is
    // therefore a genuinely native discovery path, not merely a
    // cross-harness compatibility fallback. Verified at
    // ampcode.com/docs/customize/skills. Global *AGENTS.md* discovery is
    // separate and documented at ampcode.com/docs/customize/agents-md as
    // `$HOME/.config/amp/AGENTS.md` and `$HOME/.config/AGENTS.md` — never
    // `~/.agents/AGENTS.md` — so `readsGlobalAgentsMd` is false.
    bootstrapFile: AGENTS_MD_FILENAME,
    nativeSkillPaths: [GLOBAL_SKILLS_PATH],
    compatibilityPaths: [],
    readsGlobalAgentsMd: false,
    supportsNativeScoping: false,
    scopedRuleFormat: null,
  },
  [AgentHarness.Zed]: {
    name: AgentHarness.Zed,
    // Zed reads `AGENTS.md` as primary instruction file, plus 8 other
    // compatible formats (`.rules`, `.cursorrules`, `.windsurfrules`,
    // `.clinerules`, `.github/copilot-instructions.md`, `AGENT.md`,
    // `CLAUDE.md`, `GEMINI.md`). Personal instructions at
    // `~/.config/zed/AGENTS.md`, not `~/.agents/AGENTS.md`, so
    // `readsGlobalAgentsMd` is false. Has native "Zed Agent" plus "External
    // Agents" via ACP. Verified at zed.dev/docs/ai/instructions. Zed's
    // *skills* system is a distinct feature from instructions: per
    // zed.dev/docs/ai/skills, Zed loads skills from exactly two locations,
    // `~/.agents/skills/` (global) and `<worktree>/.agents/skills/`
    // (project-local) — there is no other skills mechanism, so
    // `~/.agents/skills/` is genuinely native here, not a compatibility
    // fallback (mirrors the Amp entry above).
    bootstrapFile: AGENTS_MD_FILENAME,
    nativeSkillPaths: [GLOBAL_SKILLS_PATH],
    compatibilityPaths: [],
    readsGlobalAgentsMd: false,
    supportsNativeScoping: false,
    scopedRuleFormat: null,
  },
  [AgentHarness.Warp]: {
    name: AgentHarness.Warp,
    // Warp uses `AGENTS.md` (or `WARP.md` for backwards compatibility).
    // If both exist, `WARP.md` takes priority, and it remains fully
    // supported (not stale/superseded) per Warp's own docs, so it must
    // NOT be listed in `legacyBootstrapFiles` — that would cause
    // `--remove-legacy` to back up and delete a file the harness still
    // actively prefers over `AGENTS.md`. Filename must be ALL CAPS.
    // Has a dedicated skills system with multiple supported directories
    // (`.agents/skills/`, `.warp/skills/`, etc.) per
    // docs.warp.dev/agents/capabilities/skills. Global skills paths include
    // `~/.warp/skills/` and `~/.agents/skills/`. Verified at
    // docs.warp.dev/agents/capabilities/rules and
    // docs.warp.dev/agents/capabilities/skills.
    bootstrapFile: AGENTS_MD_FILENAME,
    nativeSkillPaths: ["~/.warp/skills", GLOBAL_SKILLS_PATH],
    compatibilityPaths: [],
    readsGlobalAgentsMd: false,
    supportsNativeScoping: false,
    scopedRuleFormat: null,
  },
  [AgentHarness.FactoryAi]: {
    name: AgentHarness.FactoryAi,
    // Factory AI (Droid) searches `.factory/`, `.agents/`, `.agent/`
    // context directories. Reads `AGENTS.md`, `agents.md`, `Agents.md`,
    // `CLAUDE.md`, `Claude.md`. Has Skills, Subagents, Plugins, and Hooks
    // systems. Native skill scopes are `.factory/skills/` (project) and
    // `~/.factory/skills/` (personal); `.agents/skills/` is a documented
    // compatibility scope, not the native one. Verified at
    // docs.factory.ai/docs/harness/agents-md and
    // docs.factory.ai/docs/harness/skills.
    bootstrapFile: AGENTS_MD_FILENAME,
    nativeSkillPaths: [".factory/skills", "~/.factory/skills"],
    compatibilityPaths: [GLOBAL_SKILLS_PATH],
    readsGlobalAgentsMd: true,
    supportsNativeScoping: false,
    scopedRuleFormat: null,
  },
  [AgentHarness.Augment]: {
    name: AgentHarness.Augment,
    // Augment Code (Auggie) has hierarchical discovery of `AGENTS.md` and
    // `CLAUDE.md` in subdirectories. Also reads `.augment/rules/`
    // (workspace) and `~/.augment/rules/` (user). User rules are always
    // `always_apply`. Global scope is `~/.augment/rules/`, not
    // `~/.agents/AGENTS.md` — the documented precedence order (--rules flag,
    // CLAUDE.md, AGENTS.md, .augment-guidelines, .augment/rules/,
    // ~/.augment/rules/) has no home-directory AGENTS.md entry, so
    // `readsGlobalAgentsMd` is false. Verified at docs.augmentcode.com/cli/rules.
    bootstrapFile: AGENTS_MD_FILENAME,
    nativeSkillPaths: [],
    compatibilityPaths: [GLOBAL_SKILLS_PATH],
    readsGlobalAgentsMd: false,
    supportsNativeScoping: false,
    scopedRuleFormat: null,
  },
};
