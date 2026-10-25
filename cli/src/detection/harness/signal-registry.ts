import { AgentHarness } from "../../types/index";
import { SurfaceType } from "./types";
import type { HarnessSignalDefinition } from "./types";

export const HARNESS_SIGNAL_REGISTRY: Record<AgentHarness, HarnessSignalDefinition[]> = {
  [AgentHarness.Codex]: [
    {
      type: SurfaceType.CLI,
      description: "codex CLI on PATH",
      reliability: "high",
      check: "codex",
    },
    {
      type: SurfaceType.AppBundle,
      description: "ChatGPT/Codex application bundle",
      reliability: "high",
      check: "ChatGPT",
    },
    {
      type: SurfaceType.ConfigDir,
      description: "~/.codex config directory",
      reliability: "medium",
      check: ".codex",
    },
  ],

  [AgentHarness.ClaudeCode]: [
    {
      type: SurfaceType.CLI,
      description: "claude CLI on PATH",
      reliability: "high",
      check: "claude",
    },
    {
      type: SurfaceType.AppBundle,
      description: "Claude application bundle",
      reliability: "high",
      check: "Claude",
    },
    {
      type: SurfaceType.ConfigDir,
      description: "~/.claude config directory",
      reliability: "medium",
      check: ".claude",
    },
    {
      type: SurfaceType.ConfigDir,
      description: "$CLAUDE_CONFIG_DIR override",
      reliability: "medium",
      check: "$CLAUDE_CONFIG_DIR",
    },
  ],

  [AgentHarness.OpenCode]: [
    {
      type: SurfaceType.CLI,
      description: "opencode CLI on PATH",
      reliability: "high",
      check: "opencode",
    },
    {
      type: SurfaceType.ConfigDir,
      description: "opencode config (~/.config/opencode/)",
      reliability: "medium",
      check: ".config/opencode",
    },
    {
      type: SurfaceType.ConfigDir,
      description: "opencode config ($XDG_CONFIG_HOME/opencode/)",
      reliability: "medium",
      check: "$XDG_CONFIG_HOME/opencode",
    },
    {
      type: SurfaceType.ConfigDir,
      description: "opencode config ($OPENCODE_CONFIG_DIR)",
      reliability: "medium",
      check: "$OPENCODE_CONFIG_DIR",
    },
    {
      type: SurfaceType.ConfigDir,
      description: "opencode config (%APPDATA%/opencode/)",
      reliability: "medium",
      check: "$APPDATA/opencode",
    },
  ],

  [AgentHarness.Kilo]: [
    {
      type: SurfaceType.VSCodeExtension,
      description: "Kilo Code VS Code extension",
      reliability: "high",
      check: "kilocode.kilo-code",
    },
    {
      type: SurfaceType.CLI,
      description: "kilo CLI on PATH",
      reliability: "high",
      check: "kilo",
    },
    {
      type: SurfaceType.ConfigDir,
      description: "kilo config (~/.config/kilo/)",
      reliability: "medium",
      check: ".config/kilo",
    },
    {
      type: SurfaceType.ConfigDir,
      description: "~/.kilocode/ config directory",
      reliability: "medium",
      check: ".kilocode",
    },
    {
      type: SurfaceType.ConfigDir,
      description: "~/.kilocode/cli config directory (legacy CLI)",
      reliability: "medium",
      check: ".kilocode/cli",
    },
  ],

  [AgentHarness.Copilot]: [
    {
      type: SurfaceType.VSCodeExtension,
      description: "GitHub Copilot VS Code extension",
      reliability: "high",
      check: "GitHub.copilot",
    },
    {
      type: SurfaceType.VSCodeExtension,
      description: "GitHub Copilot Chat VS Code extension",
      reliability: "high",
      check: "GitHub.copilot-chat",
    },
    {
      type: SurfaceType.JetBrainsPlugin,
      description: "GitHub Copilot JetBrains plugin",
      reliability: "medium",
      check: "copilot",
    },
  ],

  [AgentHarness.Cursor]: [
    {
      type: SurfaceType.AppBundle,
      description: "Cursor application bundle",
      reliability: "high",
      check: "Cursor",
    },
    {
      type: SurfaceType.ConfigDir,
      description: "~/.cursor config directory",
      reliability: "medium",
      check: ".cursor",
    },
  ],

  [AgentHarness.ZooCode]: [
    {
      type: SurfaceType.VSCodeExtension,
      description: "Zoo Code VS Code extension",
      reliability: "high",
      check: "zoocodeorganization.zoo-code",
    },
    {
      type: SurfaceType.ConfigDir,
      description: "~/.roo config directory",
      reliability: "medium",
      check: ".roo",
    },
  ],

  [AgentHarness.Devin]: [
    {
      type: SurfaceType.AppBundle,
      description: "Devin application bundle",
      reliability: "high",
      check: "Devin",
    },
    {
      type: SurfaceType.ConfigDir,
      description: "~/.config/devin config directory",
      reliability: "medium",
      check: ".config/devin",
    },
  ],

  [AgentHarness.Cline]: [
    {
      type: SurfaceType.VSCodeExtension,
      description: "Cline VS Code extension",
      reliability: "high",
      check: "saoudrizwan.claude-dev",
    },
    {
      type: SurfaceType.ConfigDir,
      description: "~/.cline config directory",
      reliability: "medium",
      check: ".cline",
    },
  ],

  [AgentHarness.JetBrains]: [
    {
      type: SurfaceType.JetBrainsPlugin,
      description: "Junie JetBrains plugin",
      reliability: "high",
      check: "junie",
    },
    {
      type: SurfaceType.ProjectFile,
      description: ".junie project directory",
      reliability: "medium",
      check: ".junie",
    },
  ],

  [AgentHarness.Aider]: [
    {
      type: SurfaceType.CLI,
      description: "aider CLI on PATH",
      reliability: "high",
      check: "aider",
    },
    {
      type: SurfaceType.ConfigDir,
      description: "~/.aider.conf.yml config file",
      reliability: "medium",
      check: ".aider.conf.yml",
    },
    {
      type: SurfaceType.ProjectFile,
      description: ".aider.conf.yml project config",
      reliability: "medium",
      check: ".aider.conf.yml",
    },
  ],

  [AgentHarness.GeminiCli]: [
    {
      type: SurfaceType.CLI,
      description: "gemini CLI on PATH (also installed by Google Antigravity)",
      reliability: "high",
      check: "gemini",
    },
    {
      type: SurfaceType.ConfigDir,
      description: "~/.gemini config directory (shared with Google Antigravity)",
      reliability: "medium",
      check: ".gemini",
    },
    {
      type: SurfaceType.ProjectFile,
      description: ".gemini project directory",
      reliability: "medium",
      check: ".gemini",
    },
  ],

  [AgentHarness.Antigravity]: [
    {
      type: SurfaceType.CLI,
      description: "agy CLI on PATH (Google Antigravity CLI)",
      reliability: "high",
      check: "agy",
    },
    {
      type: SurfaceType.AppBundle,
      description: "Antigravity IDE application bundle",
      reliability: "high",
      check: "Antigravity IDE",
    },
    {
      type: SurfaceType.ConfigDir,
      description: "~/.gemini/antigravity-cli config directory",
      reliability: "medium",
      check: ".gemini/antigravity-cli",
    },
  ],

  [AgentHarness.Amp]: [
    {
      type: SurfaceType.CLI,
      description: "amp CLI on PATH",
      reliability: "high",
      check: "amp",
    },
    {
      type: SurfaceType.ConfigDir,
      description: "~/.config/amp config directory",
      reliability: "medium",
      check: ".config/amp",
    },
    {
      type: SurfaceType.AppBundle,
      description: "Amp application bundle",
      reliability: "high",
      check: "Amp",
    },
  ],

  [AgentHarness.Zed]: [
    {
      type: SurfaceType.ConfigDir,
      description: "Zed config (~/.config/zed/)",
      reliability: "medium",
      check: ".config/zed",
    },
    {
      type: SurfaceType.AppBundle,
      description: "Zed application bundle",
      reliability: "high",
      check: "Zed",
    },
  ],

  [AgentHarness.Warp]: [
    {
      type: SurfaceType.ConfigDir,
      description: "~/.warp config directory",
      reliability: "medium",
      check: ".warp",
    },
    {
      type: SurfaceType.AppBundle,
      description: "Warp application bundle",
      reliability: "high",
      check: "Warp",
    },
  ],

  [AgentHarness.FactoryAi]: [
    {
      type: SurfaceType.CLI,
      description: "droid CLI on PATH",
      reliability: "high",
      check: "droid",
    },
    {
      type: SurfaceType.ProjectFile,
      description: ".factory project directory",
      reliability: "medium",
      check: ".factory",
    },
    {
      type: SurfaceType.AppBundle,
      description: "Factory AI application bundle",
      reliability: "high",
      check: "Droid",
    },
  ],

  [AgentHarness.Augment]: [
    {
      type: SurfaceType.CLI,
      description: "auggie CLI on PATH",
      reliability: "high",
      check: "auggie",
    },
    {
      type: SurfaceType.ConfigDir,
      description: "~/.augment config directory",
      reliability: "medium",
      check: ".augment",
    },
  ],
};
