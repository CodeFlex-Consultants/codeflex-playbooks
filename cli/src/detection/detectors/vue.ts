import type { Detector, DetectionContext, DetectorMatch } from "../types";
import { matchPackageDependencies, matchConfigFileMarkers, matchByFileExtensionFallback, getPackageJsonFiles } from "../detector-helpers";

const NUXT_CONFIG_FILES = ["nuxt.config.ts", "nuxt.config.js", "nuxt.config.mjs"] as const;

export class VueDetector implements Detector {
  readonly id = "vue";
  readonly technology = "vue";

  async detect(context: DetectionContext): Promise<DetectorMatch[]> {
    const matches: DetectorMatch[] = [];
    const packageJsonFiles = getPackageJsonFiles(context);

    const pkgMatches = await matchPackageDependencies(context, packageJsonFiles, [
      { dependency: "vue", technology: "vue" },
      { dependency: "nuxt", technology: "nuxt" },
    ]);
    matches.push(...pkgMatches);

    matches.push(
      ...matchByFileExtensionFallback(context.files, matches, "vue", ".vue"),
    );

    matches.push(
      ...matchConfigFileMarkers(context.files, matches, "nuxt", NUXT_CONFIG_FILES),
    );

    return matches;
  }
}
