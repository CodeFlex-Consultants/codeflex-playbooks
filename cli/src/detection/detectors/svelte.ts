import type { Detector, DetectionContext, DetectorMatch } from "../types";
import { matchPackageDependencies, matchConfigFileMarkers, matchByFileExtensionFallback, getPackageJsonFiles } from "../detector-helpers";

const SVELTE_CONFIG_FILES = ["svelte.config.js", "svelte.config.ts"] as const;

export class SvelteDetector implements Detector {
  readonly id = "svelte";
  readonly technology = "svelte";

  async detect(context: DetectionContext): Promise<DetectorMatch[]> {
    const matches: DetectorMatch[] = [];
    const packageJsonFiles = getPackageJsonFiles(context);

    const pkgMatches = await matchPackageDependencies(context, packageJsonFiles, [
      { dependency: "svelte", technology: "svelte" },
      { dependency: "@sveltejs/kit", technology: "sveltekit" },
    ]);
    matches.push(...pkgMatches);

    matches.push(
      ...matchByFileExtensionFallback(context.files, matches, "svelte", ".svelte"),
    );

    matches.push(
      ...matchConfigFileMarkers(context.files, matches, "svelte", SVELTE_CONFIG_FILES),
    );

    return matches;
  }
}
