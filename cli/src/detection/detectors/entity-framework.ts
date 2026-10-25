import type { Detector, DetectionContext, DetectorMatch } from "../types";
import { matchCsprojPackageReferences, extractVersionFromRef, getCsprojFiles, type PackageRefMatchSpec } from "../detector-helpers";

const efCoreSpec: PackageRefMatchSpec = {
  match: (include) => include.toLowerCase() === "microsoft.entityframeworkcore",
  technology: "entity-framework-core",
  extractVersion: extractVersionFromRef,
};

const ef6Spec: PackageRefMatchSpec = {
  match: (include) => include.toLowerCase() === "entityframework",
  technology: "entity-framework-6",
  extractVersion: extractVersionFromRef,
};

export class EntityFrameworkDetector implements Detector {
  readonly id = "entity-framework";
  readonly technology = "entity-framework";

  async detect(context: DetectionContext): Promise<DetectorMatch[]> {
    const csprojFiles = getCsprojFiles(context);
    return matchCsprojPackageReferences(context, csprojFiles, [efCoreSpec, ef6Spec]);
  }
}
