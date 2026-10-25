import type { AgentHarness } from "../types/index";
import type { HarnessDetectionResult } from "../detection/harness/types";
import { DetectionConfidence } from "../detection/harness/types";

export function filterHighMediumHarnesses(
  results: readonly HarnessDetectionResult[],
): AgentHarness[] {
  return results
    .filter((r) => r.confidence === DetectionConfidence.High || r.confidence === DetectionConfidence.Medium)
    .map((r) => r.harness);
}

export interface HarnessMergeResult {
  merged: AgentHarness[];
  added: AgentHarness[];
  notRedetected: AgentHarness[];
}

export function mergeDetectedHarnesses(
  current: AgentHarness[],
  detected: AgentHarness[],
): HarnessMergeResult {
  const currentSet = new Set(current);
  const detectedSet = new Set(detected);

  const added = detected.filter((h) => !currentSet.has(h));
  const notRedetected = current.filter((h) => !detectedSet.has(h));

  return {
    merged: [...current, ...added],
    added,
    notRedetected,
  };
}
