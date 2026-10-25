import type { Detector, DetectionContext, DetectorMatch } from "../types";
import { matchPackageDependencies, matchConfigFileMarkers, getPackageJsonFiles } from "../detector-helpers";

const PLAYWRIGHT_CONFIG_FILES = [
  "playwright.config.ts",
  "playwright.config.js",
  "playwright.config.mjs",
  "playwright.config.cjs",
] as const;

export class PlaywrightDetector implements Detector {
  readonly id = "playwright";
  readonly technology = "playwright";

  async detect(context: DetectionContext): Promise<DetectorMatch[]> {
    const matches: DetectorMatch[] = [];
    const packageJsonFiles = getPackageJsonFiles(context);

    const pkgMatches = await matchPackageDependencies(context, packageJsonFiles, [
      { dependency: "@playwright/test", technology: "playwright" },
    ]);
    matches.push(...pkgMatches);

    matches.push(
      ...matchConfigFileMarkers(context.files, matches, "playwright", PLAYWRIGHT_CONFIG_FILES),
    );

    return matches;
  }
}
