import { AgentHarness } from "../../types/index";

export enum DetectionConfidence {
  High = "high",
  Medium = "medium",
  Low = "low",
  None = "none",
}

export enum SurfaceType {
  CLI = "cli",
  VSCodeExtension = "vscode-extension",
  JetBrainsPlugin = "jetbrains-plugin",
  AppBundle = "app-bundle",
  ConfigDir = "config-dir",
  ProjectFile = "project-file",
}

export interface DetectionEvidence {
  signal: string;
  value: string;
  found: boolean;
}

export interface HarnessDetectionResult {
  harness: AgentHarness;
  surfaces: SurfaceType[];
  confidence: DetectionConfidence;
  evidence: DetectionEvidence[];
}

export interface HarnessSignalDefinition {
  type: SurfaceType;
  description: string;
  reliability: "high" | "medium" | "low";
  check: string;
}


