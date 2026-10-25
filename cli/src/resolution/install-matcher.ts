import type { InstallCondition, DetectionResult } from "../types/index";
import { satisfies, coerce } from "semver";
import { minimatch } from "minimatch";

export function matchesInstallConditions(
  conditions: InstallCondition[],
  detection: DetectionResult,
): boolean {
  return conditions.some((condition) => matchesSingleCondition(condition, detection));
}

function matchesSingleCondition(
  condition: InstallCondition,
  detection: DetectionResult,
): boolean {
  if (condition.packageReference) {
    return matchesPackageReference(condition.packageReference, detection);
  }

  if (condition.file) {
    return matchesDetectionMetadata(condition.file.pattern, detection);
  }

  return false;
}

function normalizeForComparison(s: string): string {
  return s.toLowerCase().replace(/[-_.]/g, "");
}

function matchesPackageReference(
  packageRef: { package: string; version: string },
  detection: DetectionResult,
): boolean {
  const packageName = packageRef.package.toLowerCase();
  const normalizedPackage = normalizeForComparison(packageName);
  const versionRange = packageRef.version;

  for (const tech of detection.technologies) {
    const actualPackage = extractPackageNameFromMatchedBy(tech.matchedBy);
    const normalizedTech = normalizeForComparison(tech.name);

    let nameMatches = false;

    if (actualPackage && normalizeForComparison(actualPackage) === normalizedPackage) {
      nameMatches = true;
    } else if (normalizedTech === normalizedPackage) {
      nameMatches = true;
    } else if (normalizedPackage.includes(normalizedTech) && !normalizedTech.includes(normalizedPackage)) {
      nameMatches = true;
    }

    if (!nameMatches) {
      continue;
    }

    if (!tech.version) {
      return true;
    }

    try {
      const coerced = coerce(tech.version);
      const versionToCheck = coerced ? coerced.version : tech.version;
      return satisfies(versionToCheck, versionRange);
    } catch {
      return true;
    }
  }

  return false;
}

const PACKAGE_NAME_PATTERN = /^[@a-zA-Z][a-zA-Z0-9.\-_/]*$/;

function extractPackageNameFromMatchedBy(matchedBy: string): string | undefined {
  const colonIndex = matchedBy.indexOf(":");
  if (colonIndex <= 0) return undefined;
  const candidate = matchedBy.substring(colonIndex + 1);
  return PACKAGE_NAME_PATTERN.test(candidate) ? candidate : undefined;
}

function matchesDetectionMetadata(
  metadataPattern: string,
  detection: DetectionResult,
): boolean {
  return detection.technologies.some((tech) => {
    if (minimatch(tech.matchedBy, metadataPattern)) {
      return true;
    }
    const colonIndex = tech.matchedBy.indexOf(":");
    if (colonIndex > 0) {
      const filePath = tech.matchedBy.substring(0, colonIndex);
      if (minimatch(filePath, metadataPattern)) {
        return true;
      }
    }
    return false;
  });
}
