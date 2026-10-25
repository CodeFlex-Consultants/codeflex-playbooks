import type { Detector, DetectionContext, DetectorMatch } from "../types";
import { matchPackageDependencies, matchCsprojPackageReferences, getPackageJsonFiles, getCsprojFiles } from "../detector-helpers";
import { parsePackageJson, stripVersionPrefix, type PackageJson } from "../../utils/package-json";
import { deriveScope } from "../scope-utils";

function findTestingLibraryDeps(pkg: PackageJson): string[] {
  const found: string[] = [];
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const name of Object.keys(allDeps)) {
    if (name.startsWith("@testing-library/")) {
      found.push(name);
    }
  }
  return found;
}

const DOTNET_TEST_FRAMEWORKS = ["xunit", "NUnit", "MSTest"];

export class TestingDetector implements Detector {
  readonly id = "testing";
  readonly technology = "testing";

  async detect(context: DetectionContext): Promise<DetectorMatch[]> {
    const matches: DetectorMatch[] = [];
    const packageJsonFiles = getPackageJsonFiles(context);
    const csprojFiles = getCsprojFiles(context);

    const pkgMatches = await matchPackageDependencies(context, packageJsonFiles, [
      { dependency: "vitest", technology: "vitest" },
      { dependency: "jest", technology: "jest" },
    ]);
    matches.push(...pkgMatches);

    for (const pkgFile of packageJsonFiles) {
      const pkg = await parsePackageJson(context.projectRoot, pkgFile);
      if (!pkg) continue;
      const scope = deriveScope(pkgFile);
      const testingLibraryDeps = findTestingLibraryDeps(pkg);
      for (const dep of testingLibraryDeps) {
        matches.push({
          technology: "testing-library",
          scope,
          matchedBy: `${pkgFile}:${dep}`,
          confidence: "definite",
        });
      }
    }

    const csprojMatches = await matchCsprojPackageReferences(context, csprojFiles, [
      {
        match: (include): boolean => DOTNET_TEST_FRAMEWORKS.includes(include),
        technology: "dotnet-test",
        extractVersion: (ref): string | undefined => {
          const version = ref.attributes["Version"];
          return version ? stripVersionPrefix(version) : undefined;
        },
      },
    ]);
    matches.push(...csprojMatches);

    return matches;
  }
}
