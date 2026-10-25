import type { Detector, DetectionContext, DetectorMatch } from "../types";
import { matchPackageDependencies, matchConfigFileMarkers, getPackageJsonFiles } from "../detector-helpers";

const PRISMA_SCHEMA_FILENAMES = ["schema.prisma", "contract.prisma"] as const;

const isPrismaSchemaFile = (_file: string, basename: string): boolean => {
  return PRISMA_SCHEMA_FILENAMES.some((name) => basename === name);
};

const PRISMA_CONFIG_EXTENSIONS = [".ts", ".js", ".mjs", ".cjs", ".mts", ".cts"] as const;

const isPrismaConfigFile = (file: string, basename: string): boolean => {
  for (const ext of PRISMA_CONFIG_EXTENSIONS) {
    if (basename === `prisma.config${ext}` || basename === `.config/prisma${ext}`) {
      return true;
    }
    if (file.endsWith(`/prisma.config${ext}`) || file.endsWith(`\\prisma.config${ext}`) || file.endsWith(`/.config/prisma${ext}`) || file.endsWith(`\\.config\\prisma${ext}`)) {
      return true;
    }
  }
  return false;
};

export class PrismaDetector implements Detector {
  readonly id = "prisma";
  readonly technology = "prisma";

  async detect(context: DetectionContext): Promise<DetectorMatch[]> {
    const matches: DetectorMatch[] = [];
    const packageJsonFiles = getPackageJsonFiles(context);

    const pkgMatches = await matchPackageDependencies(context, packageJsonFiles, [
      { dependency: "prisma", technology: "prisma" },
    ]);
    matches.push(...pkgMatches);

    matches.push(
      ...matchConfigFileMarkers(context.files, matches, "prisma", (file, basename) => isPrismaSchemaFile(file, basename)),
    );

    matches.push(
      ...matchConfigFileMarkers(context.files, matches, "prisma", (file, basename) => isPrismaConfigFile(file, basename)),
    );

    return matches;
  }
}
