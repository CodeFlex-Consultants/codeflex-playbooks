import type { Detector, DetectionContext, DetectorMatch } from "./types";

export class DetectorRegistry {
  private detectors: Detector[] = [];

  register(detector: Detector): void {
    this.detectors.push(detector);
  }

  async detectAll(context: DetectionContext): Promise<DetectorMatch[]> {
    const detectorEntries = this.detectors.map((detector) => ({
      detector,
      promise: detector.detect(context),
    }));

    const results = await Promise.allSettled(
      detectorEntries.map((entry) => entry.promise),
    );

    const allMatches: DetectorMatch[] = [];
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const detector = detectorEntries[i]?.detector;
      if (!result || !detector) continue;

      if (result.status === "fulfilled") {
        allMatches.push(...result.value);
      } else {
        const reason = result.reason;
        console.error(`Detector '${detector.id}' failed:`, reason instanceof Error ? reason.message : String(reason));
      }
    }

    return allMatches.sort((a, b) => {
      if (a.confidence !== b.confidence) {
        return a.confidence === "definite" ? -1 : 1;
      }
      return a.technology.localeCompare(b.technology);
    });
  }
}
