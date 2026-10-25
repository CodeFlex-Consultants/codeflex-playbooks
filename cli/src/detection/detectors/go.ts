import type { Detector, DetectionContext, DetectorMatch } from "../types";
import { detectByMarkerFilesAndExtension } from "../detector-helpers";

const GO_SPEC = {
  technology: "go",
  markerBasenames: ["go.mod", "go.sum"] as const,
  fileExtension: ".go",
  fileLabel: "Go",
};

export class GoDetector implements Detector {
  readonly id = "go";
  readonly technology = "go";

  async detect(context: DetectionContext): Promise<DetectorMatch[]> {
    return detectByMarkerFilesAndExtension(context.files, GO_SPEC);
  }
}
