export const HARNESS_BINARIES = {
  KILO: "kilo",
  CODEX: "codex",
  CLAUDE: "claude",
  GEMINI: "gemini",
} as const;

export const CONFIG_DIRS = {
  CODEFLEX: ".codeflex",
  ENGINEERING_SKILLS: "engineering-skills",
  SKILLS: "skills",
  KILO_CONFIG: "kilo",
  KILOCODE: ".kilocode",
  CLAUDE: ".claude",
  GEMINI: ".gemini",
  CODEX: ".codex",
  CONFIG: ".config",
  CLI: "cli",
  JETBRAINS: "JetBrains",
  PLUGINS: "plugins",
  OPENAI: "OpenAI",
  CODEX_APP: "Codex",
  CLAUDE_APP: "Claude",
} as const;

export const PATH_SEGMENTS = {
  PARENT: "..",
  LIBRARY: "Library",
  APPLICATION_SUPPORT: "Application Support",
  LOCAL: ".local",
  SHARE: "share",
  PROGRAMS: "Programs",
  APPLICATIONS: "Applications",
  GLOBAL_STORAGE: "globalStorage",
} as const;

export const FILE_EXTENSIONS = {
  WINDOWS_CMD: ".cmd",
} as const;

export const CLI_FLAGS = {
  VERSION: "--version",
} as const;

export const RELIABILITY = {
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
} as const;

export const DISPLAY_PATHS = {
  KILO_CONFIG: "~/.config/kilo/",
  KILOCODE: "~/.kilocode/",
  KILOCODE_CLI: "~/.kilocode/cli/",
  CLAUDE: "~/.claude",
  GEMINI: "~/.gemini",
  GEMINI_PROJECT: ".gemini",
} as const;

export const SIGNAL_NAMES = {
  EXTENSION_GLOBAL_STORAGE: "extension-global-storage",
  CONFIG_DIR: "config-dir",
} as const;

export const CONFIG_FILES = {
  CODEX_CONFIG: "config.toml",
} as const;

export const APP_BUNDLES = {
  CHATGPT: "ChatGPT",
  CLAUDE_APP: "Claude.app",
  CLAUDE_CODE_APP: "ClaudeCode.app",
  CLAUDE_DESKTOP: "claude.desktop",
  CLAUDE_APPIMAGE: "Claude.AppImage",
} as const;
