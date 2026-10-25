import type { Detector, DetectionContext, DetectorMatch } from "../types";
import { matchDatabasePackages, extractVersionFromRef, type PackageRefMatchSpec } from "../detector-helpers";

const stackExchangeRedisSpec: PackageRefMatchSpec = {
  match: (include) => include.toLowerCase() === "stackexchange.redis",
  technology: "redis",
  extractVersion: extractVersionFromRef,
};

const msExtensionsCachingRedisSpec: PackageRefMatchSpec = {
  match: (include) => include.toLowerCase() === "microsoft.extensions.caching.stackexchangeredis",
  technology: "redis",
  extractVersion: extractVersionFromRef,
};

export class RedisDetector implements Detector {
  readonly id = "redis";
  readonly technology = "redis";

  async detect(context: DetectionContext): Promise<DetectorMatch[]> {
    return matchDatabasePackages(context, "redis", {
      npmDependencies: ["ioredis", "redis"],
      csprojSpecs: [stackExchangeRedisSpec, msExtensionsCachingRedisSpec],
    });
  }
}
