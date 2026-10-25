export enum DeprecationSeverity {
  Warning = "warning",
  Error = "error",
}

export enum DeprecationCategory {
  HarnessBootstrap = "harness-bootstrap",
  HarnessConfig = "harness-config",
  DirectoryStructure = "directory-structure",
  FileFormat = "file-format",
  CliUsage = "cli-usage",
}

export interface DeprecationEntry {
  id: string;
  category: DeprecationCategory;
  severity: DeprecationSeverity;
  title: string;
  description: string;
  replacement: string;
  migrationCommand?: string;
  detect: (projectRoot: string) => Promise<boolean>;
}

export interface DeprecationCheckResult {
  entry: DeprecationEntry;
  detected: boolean;
}

export interface DeprecationCheckOptions {
  projectRoot: string;
}

export interface DeprecationReport {
  results: DeprecationCheckResult[];
  warnings: DeprecationCheckResult[];
  errors: DeprecationCheckResult[];
  hasIssues: boolean;
}
