import type { DiagnosticSeverity as DiagnosticSeverityType } from "./enums";

/** A diagnostic message emitted during skill loading or processing. */
export interface Diagnostic {
  /** Severity level. */
  severity: DiagnosticSeverityType;
  /** Machine-readable diagnostic code. */
  code: string;
  /** Human-readable diagnostic message. */
  message: string;
  /** Additional context (e.g. file path). */
  detail?: string;
}

/** Shared context passed to CLI command implementations. */
export interface CommandContext {
  /** Absolute path to the project root. */
  projectRoot: string;
  /** Whether to perform a dry run (no filesystem writes). */
  dryRun: boolean;
  /** Accumulated diagnostics for the current command. */
  diagnostics: Diagnostic[];
}
