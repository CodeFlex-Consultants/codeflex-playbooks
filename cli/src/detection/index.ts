import type { DetectionResult, DetectedTechnology } from "../types/index";
import type { DetectorMatch } from "./types";
import type { XmlElement } from "./xml-parser";
import { DetectorRegistry } from "./registry";
import { scanProjectFiles } from "./file-scanner";
import { deriveCapabilities } from "./capabilities";
import { parseAllPackageJsons } from "./detector-helpers";
import { filesEndingWith } from "./types";
import { DotnetDetector } from "./detectors/dotnet";
import { DotnetFrameworkDetector } from "./detectors/dotnet-framework";
import { EntityFrameworkDetector } from "./detectors/entity-framework";
import { AngularDetector } from "./detectors/angular";
import { ReactDetector } from "./detectors/react";
import { AspNetDetector } from "./detectors/aspnet";
import { CloudDetector } from "./detectors/cloud";
import { TestingDetector } from "./detectors/testing";
import { MobileDetector } from "./detectors/mobile";
import { VueDetector } from "./detectors/vue";
import { SvelteDetector } from "./detectors/svelte";
import { PythonDetector } from "./detectors/python";
import { GoDetector } from "./detectors/go";
import { RustDetector } from "./detectors/rust";
import { JavaDetector } from "./detectors/java";
import { KubernetesDetector } from "./detectors/kubernetes";
import { PlaywrightDetector } from "./detectors/playwright";
import { PrismaDetector } from "./detectors/prisma";
import { TailwindDetector } from "./detectors/tailwind";
import { KotlinDetector } from "./detectors/kotlin";
import { SwiftDetector } from "./detectors/swift";
import { RedisDetector } from "./detectors/redis";
import { PostgresDetector } from "./detectors/postgres";
import { MongoDbDetector } from "./detectors/mongodb";

/**
 * Scans a project directory and detects technologies, frameworks, and capabilities.
 * @param projectRoot - Absolute path to the project root directory to scan
 * @returns Detection result containing matched technologies, scopes, and derived capabilities
 */
export async function detectProject(projectRoot: string): Promise<DetectionResult> {
  const files = await scanProjectFiles(projectRoot);
  const packageJsonFiles = filesEndingWith(files, "package.json");
  const csprojFiles = filesEndingWith(files, ".csproj");
  const packageJsonCache = await parseAllPackageJsons({ projectRoot, files }, packageJsonFiles);
  const projectFileXmlCache = new Map<string, Promise<XmlElement | null>>();
  const context = {
    projectRoot,
    files,
    packageJsonCache,
    projectFileXmlCache,
    packageJsonFiles,
    csprojFiles,
  };

  const registry = new DetectorRegistry();

  registry.register(new DotnetDetector());
  registry.register(new DotnetFrameworkDetector());
  registry.register(new EntityFrameworkDetector());
  registry.register(new AngularDetector());
  registry.register(new ReactDetector());
  registry.register(new AspNetDetector());
  registry.register(new CloudDetector());
  registry.register(new TestingDetector());
  registry.register(new MobileDetector());
  registry.register(new VueDetector());
  registry.register(new SvelteDetector());
  registry.register(new PythonDetector());
  registry.register(new GoDetector());
  registry.register(new RustDetector());
  registry.register(new JavaDetector());
  registry.register(new KubernetesDetector());
  registry.register(new PlaywrightDetector());
  registry.register(new PrismaDetector());
  registry.register(new TailwindDetector());
  registry.register(new KotlinDetector());
  registry.register(new SwiftDetector());
  registry.register(new RedisDetector());
  registry.register(new PostgresDetector());
  registry.register(new MongoDbDetector());

  const matches = await registry.detectAll(context);

  return buildDetectionResult(matches);
}

function buildDetectionResult(matches: DetectorMatch[]): DetectionResult {
  const technologies: DetectedTechnology[] = [];
  const scopes: Record<string, string[]> = {};
  const scopeSets = new Map<string, Set<string>>();

  const seen = new Set<string>();

  for (const match of matches) {
    const key = `${match.technology}:${match.scope ?? ""}:${match.version ?? ""}`;

    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    technologies.push({
      name: match.technology,
      version: match.version,
      scope: match.scope,
      matchedBy: match.matchedBy,
    });

    if (match.scope) {
      let scopeSet = scopeSets.get(match.technology);
      if (!scopeSet) {
        scopeSet = new Set<string>();
        scopeSets.set(match.technology, scopeSet);
      }
      if (!scopeSet.has(match.scope)) {
        scopeSet.add(match.scope);
        scopes[match.technology] = [...scopeSet];
      }
    }
  }

  const capabilities = deriveCapabilities(technologies);

  return { technologies, scopes, capabilities };
}
