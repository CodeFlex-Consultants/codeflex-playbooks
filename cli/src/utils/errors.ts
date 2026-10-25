/** Base error class for all CodeFlex CLI errors, carrying a machine-readable code and process exit code. */
export class CodeFlexError extends Error {
  /** Machine-readable error code (e.g. `CONFIG_VALIDATION_ERROR`). */
  public readonly code: string;
  /** Optional human-readable detail providing additional context. */
  public readonly detail?: string;
  /** Process exit code to use when this error is unhandled. */
  public readonly exitCode: number;

  constructor(message: string, code: string, detail?: string, exitCode: number = 1) {
    super(message);
    this.name = "CodeFlexError";
    this.code = code;
    this.detail = detail;
    this.exitCode = exitCode;
  }
}

/** Thrown when engineering.yaml or engineering.lock fails schema or version validation. Exit code 2. */
export class ConfigValidationError extends CodeFlexError {
  constructor(message: string, detail?: string) {
    super(message, "CONFIG_VALIDATION_ERROR", detail, 2);
    this.name = "ConfigValidationError";
  }
}

/** Thrown when engineering.lock is expected but doesn't exist. Suggests running `init` or `sync`. */
export class LockfileMissingError extends CodeFlexError {
  constructor(message?: string) {
    super(
      message ?? "No engineering.lock found. Run 'codeflex-playbooks init' or 'codeflex-playbooks sync' first.",
      "LOCKFILE_MISSING",
    );
    this.name = "LockfileMissingError";
  }
}

/** Thrown when a trusted release fails integrity verification (hash mismatch, unverified attestation, etc.). */
export class IntegrityError extends CodeFlexError {
  constructor(message: string, detail?: string) {
    super(message, "INTEGRITY_ERROR", detail);
    this.name = "IntegrityError";
  }
}

/** Thrown when skill resolution produces irreconcilable rule conflicts. */
export class ResolutionConflictError extends CodeFlexError {
  constructor(message: string, detail?: string) {
    super(message, "RESOLUTION_CONFLICT", detail);
    this.name = "ResolutionConflictError";
  }
}

/** Thrown when a standards source (git repo, release artifact, local path) cannot be fetched. */
export class SourceFetchError extends CodeFlexError {
  constructor(message: string, detail?: string) {
    super(message, "SOURCE_FETCH_ERROR", detail);
    this.name = "SourceFetchError";
  }
}

/** Thrown when an update would drop client-mandated standards that were previously locked. */
export class ClientStandardsDroppedError extends CodeFlexError {
  constructor(message: string, detail?: string) {
    super(message, "CLIENT_STANDARDS_DROPPED", detail);
    this.name = "ClientStandardsDroppedError";
  }
}

/** Signals a clean exit with a specific exit code and no error output. */
export class SilentExitError extends Error {
  public readonly exitCode: number;

  constructor(exitCode: number) {
    super("");
    this.name = "SilentExitError";
    this.exitCode = exitCode;
  }
}

/** Thrown when YAML frontmatter in a SKILL.md file cannot be parsed. */
export class FrontmatterParseError extends ConfigValidationError {
  constructor(message: string) {
    super(message, "Failed to parse YAML frontmatter from skill file");
    this.name = "FrontmatterParseError";
  }
}

/** Extracts a human-readable message from an unknown error value. */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Wraps an unknown error into a SourceFetchError with a prefix message and optional detail. */
export function wrapSourceFetchError(err: unknown, prefix: string, detail?: string): never {
  throw new SourceFetchError(`${prefix}: ${errorMessage(err)}`, detail);
}
