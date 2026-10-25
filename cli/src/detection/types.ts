import type { PackageJson } from "../utils/package-json";
import type { XmlElement } from "./xml-parser";

export interface Detector {
  readonly id: string;
  readonly technology: string;
  detect(context: DetectionContext): Promise<DetectorMatch[]>;
}

export interface DetectionContext {
  projectRoot: string;
  files: string[];
  packageJsonCache?: Map<string, PackageJson>;
  projectFileXmlCache?: Map<string, Promise<XmlElement | null>>;
  /** Pre-computed list of `package.json` files in `files`, shared across detectors to avoid
    * redundant `filesEndingWith` scans. Falls back to computing on demand when absent. */
  packageJsonFiles?: string[];
  /** Pre-computed list of `.csproj` files in `files`, shared across detectors to avoid
    * redundant `filesEndingWith` scans. Falls back to computing on demand when absent. */
  csprojFiles?: string[];
  /** Pre-computed list of .NET project files (.csproj, .fsproj, .vbproj) in `files`,
    * shared across detectors to avoid redundant scans. Falls back to computing on demand when absent. */
  dotnetProjectFiles?: string[];
}

export interface DetectorMatch {
  technology: string;
  version?: string;
  scope?: string;
  matchedBy: string;
  confidence: "definite" | "likely";
}

export function filesEndingWith(files: string[], suffix: string): string[] {
  return files.filter((f) => f.endsWith(suffix));
}
