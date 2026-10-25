import type { Detector, DetectionContext, DetectorMatch } from "../types";
import { matchPackageDependencies, matchConfigFileMarkers, getPackageJsonFiles } from "../detector-helpers";

const TAILWIND_CONFIG_FILES = [
  "tailwind.config.js",
  "tailwind.config.ts",
  "tailwind.config.mjs",
  "tailwind.config.cjs",
] as const;

export class TailwindDetector implements Detector {
  readonly id = "tailwind";
  readonly technology = "tailwind";

  async detect(context: DetectionContext): Promise<DetectorMatch[]> {
    const matches: DetectorMatch[] = [];
    const packageJsonFiles = getPackageJsonFiles(context);

    const pkgMatches = await matchPackageDependencies(context, packageJsonFiles, [
      { dependency: "tailwindcss", technology: "tailwind" },
      { dependency: "@tailwindcss/vite", technology: "tailwind" },
      { dependency: "@tailwindcss/postcss", technology: "tailwind" },
    ]);
    matches.push(...pkgMatches);

    matches.push(
      ...matchConfigFileMarkers(context.files, matches, "tailwind", TAILWIND_CONFIG_FILES),
    );

    return matches;
  }
}
