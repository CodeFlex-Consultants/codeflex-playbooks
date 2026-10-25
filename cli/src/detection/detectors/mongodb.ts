import type { Detector, DetectionContext, DetectorMatch } from "../types";
import { matchDatabasePackages, extractVersionFromRef, type PackageRefMatchSpec } from "../detector-helpers";

const mongoDbDriverSpec: PackageRefMatchSpec = {
  match: (include) => include.toLowerCase() === "mongodb.driver",
  technology: "mongodb",
  extractVersion: extractVersionFromRef,
};

export class MongoDbDetector implements Detector {
  readonly id = "mongodb";
  readonly technology = "mongodb";

  async detect(context: DetectionContext): Promise<DetectorMatch[]> {
    return matchDatabasePackages(context, "mongodb", {
      npmDependencies: ["mongodb", "mongoose"],
      csprojSpecs: [mongoDbDriverSpec],
    });
  }
}
