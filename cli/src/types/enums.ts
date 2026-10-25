/** Origin of a loaded skill. */
export enum SkillSource {
  /** From the CodeFlex engineering baseline. */
  CodeFlex = "codeflex",
  /** From a client-mandated standards source. */
  Client = "client",
  /** From a repository-local standards source. */
  Repository = "repository",
}

/** Whether a CodeFlex skill's rules can be overridden by higher-priority sources. */
export enum OverridePolicy {
  /** Rules may be overridden by client or repository standards. */
  Allowed = "allowed",
  /** Rules must always be enforced regardless of higher-priority sources. */
  Required = "required",
}

/** Transport type for the CodeFlex engineering baseline source. */
export enum CodeFlexSourceType {
  /** Local filesystem path. */
  Local = "local",
  /** Git repository. */
  Git = "git",
  /** Signed release artifact (tar.gz). */
  Release = "release",
}

/** Transport type for a client standards source. */
export enum ClientSourceType {
  /** Local filesystem path relative to the project. */
  Repository = "repository",
  /** Remote git repository. */
  Git = "git",
}

/** Release channel controlling default branch selection and stability guarantees. */
export enum ReleaseChannel {
  /** Production-ready releases from the `main` branch. */
  Stable = "stable",
  /** Pre-release or bleeding-edge releases from the `dev` branch. */
  Canary = "canary",
}

/** Severity level for diagnostics emitted during skill loading and resolution. */
export enum DiagnosticSeverity {
  /** Informational message. */
  Info = "info",
  /** Non-fatal issue that may affect results. */
  Warning = "warning",
  /** Fatal issue that prevents completion. */
  Error = "error",
}

/** Supported coding agent harnesses that can consume projected skills. */
export enum AgentHarness {
  Codex = "codex",
  ClaudeCode = "claude-code",
  OpenCode = "opencode",
  Kilo = "kilo",
  Copilot = "copilot",
  Cursor = "cursor",
  ZooCode = "zoocode",
  Devin = "devin",
  Cline = "cline",
  JetBrains = "jetbrains",
  Aider = "aider",
  GeminiCli = "gemini-cli",
  Antigravity = "antigravity",
  Amp = "amp",
  Zed = "zed",
  Warp = "warp",
  FactoryAi = "factory-ai",
  Augment = "augment",
}

/** Format variants for harness-specific scoped rule files. */
export enum ScopedRuleFormat {
  Claude = "claude",
  Kilo = "kilo",
  Copilot = "copilot",
  Cursor = "cursor",
  ZooCode = "zoocode",
  Devin = "devin",
  Cline = "cline",
}

/** Terminal output styling categories for CLI display. */
export enum OutputStyle {
  Bold = "bold",
  Dim = "dim",
  Success = "success",
  Warning = "warning",
  Error = "error",
}
