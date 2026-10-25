import { AgentHarness } from "../../types/index";
import { SurfaceType, type DetectionEvidence, type HarnessDetectionResult } from "./types";
import { calculateConfidence, type ConfidenceSignal } from "./helpers";

export class DetectorBuilder {
  private readonly harness: AgentHarness;
  private readonly evidence: DetectionEvidence[] = [];
  private readonly surfaces: Set<SurfaceType> = new Set();
  private readonly confidenceSignals: ConfidenceSignal[] = [];

  constructor(harness: AgentHarness) {
    this.harness = harness;
  }

  addCheck(params: {
    signal: string;
    value: string;
    found: boolean;
    surface?: SurfaceType;
    reliability: "high" | "medium" | "low";
  }): void {
    this.evidence.push({
      signal: params.signal,
      value: params.value,
      found: params.found,
    });

    if (params.found && params.surface) {
      this.surfaces.add(params.surface);
    }

    this.confidenceSignals.push({
      reliability: params.reliability,
      found: params.found,
    });
  }

  build(): HarnessDetectionResult {
    return {
      harness: this.harness,
      surfaces: [...this.surfaces],
      confidence: calculateConfidence(this.confidenceSignals),
      evidence: this.evidence,
    };
  }
}
