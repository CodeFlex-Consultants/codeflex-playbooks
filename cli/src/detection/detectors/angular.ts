import type { Detector, DetectionContext, DetectorMatch } from "../types";
import { matchPackageDependencies, getPackageJsonFiles } from "../detector-helpers";

const PACKAGE_DEP_SPECS = [
  { dependency: "@angular/core", technology: "angular" },
  { dependency: "@ngxs/store", technology: "ngxs" },
  { dependency: "@angular/material", technology: "angular-material" },
] as const;

export class AngularDetector implements Detector {
  readonly id = "angular";
  readonly technology = "angular";

  async detect(context: DetectionContext): Promise<DetectorMatch[]> {
    const matches: DetectorMatch[] = [];
    const angularFiles = context.files.filter(
      (f) => f === "angular.json" || f === ".angular.json" || f.endsWith("/angular.json") || f.endsWith("/.angular.json") || f.endsWith("\\angular.json") || f.endsWith("\\.angular.json")
    );
    const packageJsonFiles = getPackageJsonFiles(context);

    for (const file of angularFiles) {
      matches.push({
        technology: "angular",
        matchedBy: file,
        confidence: "definite",
      });
    }

    const pkgMatches = await matchPackageDependencies(context, packageJsonFiles, PACKAGE_DEP_SPECS);
    matches.push(...pkgMatches);

    return matches;
  }
}
