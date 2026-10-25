import type { Detector, DetectionContext, DetectorMatch } from "../types";
import { matchDatabasePackages, extractVersionFromRef, type PackageRefMatchSpec } from "../detector-helpers";

const npgsqlSpec: PackageRefMatchSpec = {
  match: (include) => include.toLowerCase() === "npgsql",
  technology: "postgresql",
  extractVersion: extractVersionFromRef,
};

const npgsqlEfCoreSpec: PackageRefMatchSpec = {
  match: (include) => include.toLowerCase() === "npgsql.entityframeworkcore.postgresql",
  technology: "postgresql",
  extractVersion: extractVersionFromRef,
};

export class PostgresDetector implements Detector {
  readonly id = "postgresql";
  readonly technology = "postgresql";

  async detect(context: DetectionContext): Promise<DetectorMatch[]> {
    return matchDatabasePackages(context, "postgresql", {
      npmDependencies: ["pg", "postgres", "pg-native"],
      csprojSpecs: [npgsqlSpec, npgsqlEfCoreSpec],
    });
  }
}
