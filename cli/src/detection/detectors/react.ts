import type { Detector, DetectionContext, DetectorMatch } from "../types";
import { matchPackageDependencies, getPackageJsonFiles } from "../detector-helpers";

const PACKAGE_DEP_SPECS = [
  { dependency: "react", technology: "react" },
  { dependency: "react-native", technology: "react-native" },
  { dependency: "next", technology: "nextjs" },
] as const;

export class ReactDetector implements Detector {
  readonly id = "react";
  readonly technology = "react";

  async detect(context: DetectionContext): Promise<DetectorMatch[]> {
    const packageJsonFiles = getPackageJsonFiles(context);

    return matchPackageDependencies(context, packageJsonFiles, PACKAGE_DEP_SPECS);
  }
}
