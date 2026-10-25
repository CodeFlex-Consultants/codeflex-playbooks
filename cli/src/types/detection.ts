/** A project capability string (e.g. "ef-core", "jwt-auth") derived from detected technologies. */
export type Capability = string;

/** Result of scanning a project for technologies, frameworks, and capabilities. */
export interface DetectionResult {
  /** Individual technologies detected in the project. */
  technologies: DetectedTechnology[];
  /** Map of technology name to applicable path scopes. */
  scopes: Record<string, string[]>;
  /** Derived capability strings used for skill applicability filtering. */
  capabilities: Capability[];
}

/** A single technology detected in the project. */
export interface DetectedTechnology {
  /** Technology name (e.g. "dotnet", "angular", "react"). */
  name: string;
  /** Detected version, if available. */
  version?: string;
  /** Scope within the project (e.g. a subdirectory), if applicable. */
  scope?: string;
  /** Description of what file or pattern triggered the detection. */
  matchedBy: string;
}
