import { join } from "node:path";
import type { Detector, DetectionContext, DetectorMatch } from "../types";
import { safeReadFile } from "../../utils/fs";
import { deriveScope } from "../scope-utils";

async function detectAndroid(
  context: DetectionContext,
  filePath: string
): Promise<DetectorMatch | undefined> {
  const content = await safeReadFile(join(context.projectRoot, filePath));
  if (!content) return undefined;

  const hasPlugin =
    content.includes("com.android.application") ||
    content.includes("com.android.library");
  if (!hasPlugin) return undefined;

  const versionMatch = content.match(/compileSdk(?:Version)?\s+(?:=|)\s*(\d+)/);
  const version = versionMatch?.[1];

  return {
    technology: "android",
    version,
    scope: deriveScope(filePath),
    matchedBy: filePath,
    confidence: "definite",
  };
}

export class MobileDetector implements Detector {
  readonly id = "mobile";
  readonly technology = "mobile";

  async detect(context: DetectionContext): Promise<DetectorMatch[]> {
    const matches: DetectorMatch[] = [];

    const gradleFiles = context.files.filter(
      (f) => f.endsWith("build.gradle") || f.endsWith("build.gradle.kts")
    );

    for (const gradleFile of gradleFiles) {
      const match = await detectAndroid(context, gradleFile);
      if (match) {
        matches.push(match);
      }
    }

    for (const file of context.files) {
      if (file.includes(".xcodeproj/") || file.includes(".xcworkspace/")) {
        matches.push({
          technology: "ios",
          scope: deriveScope(file),
          matchedBy: file,
          confidence: "definite",
        });
      }

      if (file.endsWith("/Podfile") || file.endsWith("\\Podfile") || file === "Podfile") {
        matches.push({
          technology: "ios-cocoapods",
          scope: deriveScope(file),
          matchedBy: file,
          confidence: "definite",
        });
      }

      if (file.endsWith("/Package.swift") || file.endsWith("\\Package.swift") || file === "Package.swift") {
        matches.push({
          technology: "ios-swift-package",
          scope: deriveScope(file),
          matchedBy: file,
          confidence: "definite",
        });
      }
    }

    return matches;
  }
}
