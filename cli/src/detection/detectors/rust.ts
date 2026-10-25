import type { Detector, DetectionContext, DetectorMatch } from "../types";
import { detectByMarkerFilesAndExtension } from "../detector-helpers";

const RUST_SPEC = {
  technology: "rust",
  markerBasenames: ["Cargo.toml", "Cargo.lock"] as const,
  fileExtension: ".rs",
  fileLabel: "Rust",
};

export class RustDetector implements Detector {
  readonly id = "rust";
  readonly technology = "rust";

  async detect(context: DetectionContext): Promise<DetectorMatch[]> {
    return detectByMarkerFilesAndExtension(context.files, RUST_SPEC);
  }
}
