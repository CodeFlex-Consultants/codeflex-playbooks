import type { Detector, DetectionContext, DetectorMatch } from "../types";
import { detectByMarkerFilesExtensionAndContent } from "../detector-helpers";

const JAVA_SPEC = {
  technology: "java",
  markerBasenames: ["pom.xml", "build.gradle", "build.gradle.kts"] as const,
  fileExtension: ".java",
  fileLabel: "Java",
  contentSniffs: [
    {
      technology: "spring-boot",
      matchedBy: "spring-boot dependency found",
      test: (content: string): boolean => content.toLowerCase().includes("spring-boot"),
    },
  ],
};

export class JavaDetector implements Detector {
  readonly id = "java";
  readonly technology = "java";

  async detect(context: DetectionContext): Promise<DetectorMatch[]> {
    return detectByMarkerFilesExtensionAndContent(context, JAVA_SPEC);
  }
}
