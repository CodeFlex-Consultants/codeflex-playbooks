import type { Detector, DetectionContext, DetectorMatch } from "../types";
import { detectByMarkerFilesExtensionAndContent } from "../detector-helpers";

const KOTLIN_ANDROID_MARKERS = ["AndroidManifest.xml"] as const;

const KOTLIN_SPEC = {
  technology: "kotlin",
  markerBasenames: ["build.gradle.kts", "settings.gradle.kts"] as const,
  fileExtension: ".kt",
  fileLabel: "Kotlin",
  isExtensionFile: (file: string): boolean => file.endsWith(".kt") || file.endsWith(".kts"),
  dedupeMarkerMatchesGlobally: true,
  contentSniffs: [
    {
      technology: "kotlin-android",
      matchedBy: "Android project markers found",
      triggerBasenames: KOTLIN_ANDROID_MARKERS,
      test: (content: string): boolean => content.toLowerCase().includes("android"),
    },
  ],
};

export class KotlinDetector implements Detector {
  readonly id = "kotlin";
  readonly technology = "kotlin";

  async detect(context: DetectionContext): Promise<DetectorMatch[]> {
    return detectByMarkerFilesExtensionAndContent(context, KOTLIN_SPEC);
  }
}
