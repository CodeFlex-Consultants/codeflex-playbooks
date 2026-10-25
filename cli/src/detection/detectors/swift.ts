import type { Detector, DetectionContext, DetectorMatch } from "../types";
import { detectByMarkerFilesExtensionAndContent } from "../detector-helpers";

const IOS_SDK_MARKERS = ["iphoneos", "iPhoneOS", "iOS", "UIKit", "iphone"] as const;

function hasIosMarkers(content: string): boolean {
  return IOS_SDK_MARKERS.some((marker) => content.includes(marker));
}

const SWIFT_SPEC = {
  technology: "swift",
  markerBasenames: ["Package.swift"] as const,
  isMarkerFile: (file: string, basename: string): boolean =>
    basename === "Package.swift" || file.includes(".xcodeproj/") || file.includes(".xcodeproj\\") || file.includes(".xcworkspace/") || file.includes(".xcworkspace\\"),
  fileExtension: ".swift",
  fileLabel: "Swift",
  sniffBasenames: ["Info.plist"] as const,
  contentSniffs: [
    {
      technology: "swift-ios",
      matchedBy: "iOS project markers found",
      test: hasIosMarkers,
    },
  ],
};

export class SwiftDetector implements Detector {
  readonly id = "swift";
  readonly technology = "swift";

  async detect(context: DetectionContext): Promise<DetectorMatch[]> {
    return detectByMarkerFilesExtensionAndContent(context, SWIFT_SPEC);
  }
}
