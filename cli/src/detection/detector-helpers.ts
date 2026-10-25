import { join } from "node:path";
import type { DetectionContext, DetectorMatch } from "./types";
import { filesEndingWith } from "./types";
import { parsePackageJson, findDependencyVersion, stripVersionPrefix, type PackageJson } from "../utils/package-json";
import { readFileWithLimit } from "../utils/fs";
import { parseSimpleXml, findElements, getTextContent, type XmlElement } from "./xml-parser";
import { normalizeVersion } from "../utils/version";
import { deriveScope } from "./scope-utils";

/**
 * File extensions used by both SDK-style and old-style .NET project files
 * (.csproj, .fsproj, .vbproj). Shared by the `dotnet` and `dotnet-framework`
 * detectors so the supported extension set cannot drift between them.
 */
export const DOTNET_PROJECT_EXTENSIONS = new Set([".csproj", ".fsproj", ".vbproj"]);

/**
 * Returns the project's `package.json` files, reusing the pre-computed list on
 * `DetectionContext` when available instead of re-scanning `context.files` for every caller.
 */
export function getPackageJsonFiles(context: DetectionContext): string[] {
  return context.packageJsonFiles ?? filesEndingWith(context.files, "package.json");
}

/**
 * Returns the project's `.csproj` files, reusing the pre-computed list on
 * `DetectionContext` when available instead of re-scanning `context.files` for every caller.
 */
export function getCsprojFiles(context: DetectionContext): string[] {
  return context.csprojFiles ?? filesEndingWith(context.files, ".csproj");
}

/**
 * Returns the project's .NET project files (.csproj, .fsproj, .vbproj),
 * reusing the pre-computed list on `DetectionContext` when available instead
 * of re-scanning `context.files` for every caller.
 */
export function getDotnetProjectFiles(context: DetectionContext): string[] {
  return context.dotnetProjectFiles ?? context.files.filter((file) => {
    const dotIndex = file.lastIndexOf(".");
    if (dotIndex < 0) return false;
    const ext = file.substring(dotIndex);
    return DOTNET_PROJECT_EXTENSIONS.has(ext);
  });
}

export async function parseAllPackageJsons(
  context: DetectionContext,
  packageJsonFiles: string[],
): Promise<Map<string, PackageJson>> {
  if (context.packageJsonCache) {
    const cached = new Map<string, PackageJson>();
    for (const pkgFile of packageJsonFiles) {
      const pkg = context.packageJsonCache.get(pkgFile);
      if (pkg) {
        cached.set(pkgFile, pkg);
      }
    }
    return cached;
  }

  const results = await Promise.all(
    packageJsonFiles.map(async (pkgFile) => {
      const pkg = await parsePackageJson(context.projectRoot, pkgFile);
      return pkg ? [pkgFile, pkg] as const : null;
    }),
  );
  const parsed = new Map<string, PackageJson>();
  for (const result of results) {
    if (result) {
      parsed.set(result[0], result[1]);
    }
  }
  return parsed;
}

export function getBasename(file: string): string {
  const lastSlash = Math.max(file.lastIndexOf("/"), file.lastIndexOf("\\"));
  return file.substring(lastSlash + 1);
}

export interface DependencyMatchSpec {
  dependency: string;
  technology: string;
  matchedBy?: string;
}

function matchSpecsAgainstPackage(
  pkg: PackageJson,
  pkgFile: string,
  scope: string | undefined,
  specs: readonly DependencyMatchSpec[],
): DetectorMatch[] {
  const matches: DetectorMatch[] = [];
  for (const spec of specs) {
    const version = findDependencyVersion(pkg, spec.dependency);
    if (version) {
      matches.push({
        technology: spec.technology,
        version: stripVersionPrefix(version),
        scope,
        matchedBy: spec.matchedBy ?? `${pkgFile}:${spec.dependency}`,
        confidence: "definite",
      });
    }
  }
  return matches;
}

export async function matchPackageDependencies(
  context: DetectionContext,
  packageJsonFiles: string[],
  specs: readonly DependencyMatchSpec[],
): Promise<DetectorMatch[]> {
  const matches: DetectorMatch[] = [];

  for (const pkgFile of packageJsonFiles) {
    const pkg = context.packageJsonCache?.get(pkgFile) ?? await parsePackageJson(context.projectRoot, pkgFile);
    if (!pkg) continue;

    const scope = deriveScope(pkgFile);
    matches.push(...matchSpecsAgainstPackage(pkg, pkgFile, scope, specs));
  }

  return matches;
}

export interface PackageRefMatchSpec {
  match: (include: string) => boolean;
  technology: string;
  extractVersion?: (ref: XmlElement) => string | undefined;
}

async function getOrParseProjectXml(
  context: DetectionContext,
  file: string,
): Promise<XmlElement | null> {
  if (context.projectFileXmlCache) {
    const cached = context.projectFileXmlCache.get(file);
    if (cached) return cached;
  }

  const parsePromise = (async (): Promise<XmlElement | null> => {
    try {
      const content = await readFileWithLimit(join(context.projectRoot, file));
      return parseSimpleXml(content);
    } catch {
      return null;
    }
  })();

  context.projectFileXmlCache?.set(file, parsePromise);
  return parsePromise;
}

export async function matchCsprojPackageReferences(
  context: DetectionContext,
  csprojFiles: string[],
  specs: PackageRefMatchSpec[],
): Promise<DetectorMatch[]> {
  const matches: DetectorMatch[] = [];

  for (const file of csprojFiles) {
    const scope = deriveScope(file);

    const root = await getOrParseProjectXml(context, file);
    if (!root) continue;

    const packageRefs = findElements(root, "PackageReference");

    for (const ref of packageRefs) {
      const include = ref.attributes["Include"];
      if (!include) continue;

      for (const spec of specs) {
        if (!spec.match(include)) continue;

        let version: string | undefined;
        if (spec.extractVersion) {
          version = spec.extractVersion(ref);
        } else {
          version = ref.attributes["Version"];
        }

        matches.push({
          technology: spec.technology,
          version,
          matchedBy: `${file}:${include}`,
          confidence: "definite",
          scope,
        });
      }
    }
  }

  return matches;
}

export function extractVersionFromRef(ref: XmlElement): string | undefined {
  let version = ref.attributes["Version"];
  if (!version) {
    for (const child of ref.children) {
      if (child.tag === "Version") {
        const text = getTextContent(child);
        if (text) version = text.trim();
      }
    }
  }
  return version ? normalizeVersion(version) : undefined;
}

export interface MarkerAndExtensionSpec {
  technology: string;
  markerBasenames: readonly string[];
  fileExtension: string;
  fileLabel: string;
  /**
   * Optional override for marker-file identification. When provided, this is
   * used instead of a plain `markerBasenames.includes(basename)` check, so
   * detectors can match on path fragments (e.g. `.xcodeproj/`) rather than an
   * exact basename.
   */
  isMarkerFile?: (file: string, basename: string) => boolean;
  /**
   * Optional override for the "language extension" check. When provided,
   * this is used instead of `file.endsWith(spec.fileExtension)`, so
   * detectors can match on more than one extension (e.g. `.kt` or `.kts`).
   */
  isExtensionFile?: (file: string) => boolean;
  /**
   * When true, only the first marker-file match is pushed (matching a
   * legacy global-flag dedup behavior), instead of pushing one definite
   * match per matching marker file.
   */
  dedupeMarkerMatchesGlobally?: boolean;
}

export function detectByMarkerFilesAndExtension(
  files: readonly string[],
  spec: MarkerAndExtensionSpec,
): DetectorMatch[] {
  const matches: DetectorMatch[] = [];
  const detectedScopes = new Set<string>();
  let markerMatched = false;

  for (const file of files) {
    const basename = getBasename(file);
    const isMarker = spec.isMarkerFile
      ? spec.isMarkerFile(file, basename)
      : spec.markerBasenames.includes(basename);
    const isExtensionFile = spec.isExtensionFile
      ? spec.isExtensionFile(file)
      : file.endsWith(spec.fileExtension);

    if (isMarker) {
      if (spec.dedupeMarkerMatchesGlobally && markerMatched) {
        continue;
      }
      const scope = deriveScope(file);
      matches.push({
        technology: spec.technology,
        matchedBy: file,
        confidence: "definite",
        scope,
      });
      detectedScopes.add(`${spec.technology}:${scope}`);
      markerMatched = true;
    } else if (isExtensionFile) {
      const scope = deriveScope(file);
      const key = `${spec.technology}:${scope}`;
      if (! detectedScopes.has(key)) {
        detectedScopes.add(key);
        matches.push({
          technology: spec.technology,
          matchedBy: `${spec.fileLabel} files found: ${file}`,
          confidence: "likely",
          scope,
        });
      }
    }
  }

  return matches;
}

export interface ContentSniffSpec {
  /** Sub-technology reported when this sniff is satisfied. */
  technology: string;
  /** `matchedBy` string used for the resulting definite match. */
  matchedBy: string;
  /** Tested against the content of each file in `sniffBasenames` (OR'd across files). */
  test?: (content: string) => boolean;
  /**
   * If any file with one of these basenames is present in the project, the
   * sniff is satisfied unconditionally (no content read required).
   */
  triggerBasenames?: readonly string[];
}

export interface MarkerExtensionContentSpec extends MarkerAndExtensionSpec {
  /**
   * Basenames of files whose content should be read for sniffing. Defaults
   * to `markerBasenames` when omitted.
   */
  sniffBasenames?: readonly string[];
  contentSniffs?: readonly ContentSniffSpec[];
}

/**
 * Combines `detectByMarkerFilesAndExtension` with an optional content-sniff
 * pass: after the marker/extension matches are computed, the contents of
 * `sniffBasenames` files (or the marker files themselves by default) are
 * read in parallel and tested against each `contentSniffs` entry to surface
 * definite sub-technology matches (e.g. Spring Boot within a Java project).
 */
export async function detectByMarkerFilesExtensionAndContent(
  context: DetectionContext,
  spec: MarkerExtensionContentSpec,
): Promise<DetectorMatch[]> {
  const matches = detectByMarkerFilesAndExtension(context.files, spec);

  if (!spec.contentSniffs || spec.contentSniffs.length === 0) {
    return matches;
  }

  const sniffBasenames = spec.sniffBasenames ?? spec.markerBasenames;
  const sniffFiles = context.files.filter((file) => sniffBasenames.includes(getBasename(file)));

  const contents = sniffFiles.length > 0
    ? await Promise.all(
        sniffFiles.map((file) =>
          readFileWithLimit(join(context.projectRoot, file)).catch(() => null),
        ),
      )
    : [];

  for (const sniff of spec.contentSniffs) {
    let detected = sniff.triggerBasenames
      ? context.files.some((file) => sniff.triggerBasenames!.includes(getBasename(file)))
      : false;

    if (!detected && sniff.test) {
      detected = contents.some((content) => content != null && sniff.test!(content));
    }

    if (detected) {
      matches.push({
        technology: sniff.technology,
        matchedBy: sniff.matchedBy,
        confidence: "definite",
      });
    }
  }

  return matches;
}

/**
 * Matches files against a set of known config-file basenames for a given
 * technology, deduping against `existingMatches` (and matches already pushed
 * within this call) by `(technology, scope)` using an O(1) Set lookup, and
 * returns newly discovered definite matches.
 */
export function matchConfigFileMarkers(
  files: readonly string[],
  existingMatches: readonly DetectorMatch[],
  technology: string,
  configBasenames: readonly string[] | ((file: string, basename: string) => boolean),
): DetectorMatch[] {
  const newMatches: DetectorMatch[] = [];
  const detectedScopes = new Set<string>(
    existingMatches
      .filter((m) => m.technology === technology)
      .map((m) => `${m.technology}:${m.scope}`),
  );
  const isMatch: (file: string, basename: string) => boolean =
    typeof configBasenames === "function"
      ? configBasenames
      : (_file: string, basename: string): boolean => configBasenames.includes(basename);

  for (const file of files) {
    const basename = getBasename(file);
    if (!isMatch(file, basename)) continue;

    const scope = deriveScope(file);
    const key = `${technology}:${scope}`;
    if (detectedScopes.has(key)) continue;

    detectedScopes.add(key);
    newMatches.push({
      technology,
      matchedBy: file,
      confidence: "definite",
      scope,
    });
  }

  return newMatches;
}

/**
 * Fallback detection for technologies signaled purely by source-file
 * extension (e.g. `.svelte`, `.vue`) when no stronger package.json or
 * config-file marker match already exists for that `(technology, scope)`.
 * Only the first matching file per undetected scope is reported, at
 * "likely" confidence, matching prior per-detector fallback behavior.
 */
export function matchByFileExtensionFallback(
  files: readonly string[],
  existingMatches: readonly DetectorMatch[],
  technology: string,
  fileExtension: string,
): DetectorMatch[] {
  const newMatches: DetectorMatch[] = [];
  const detectedScopes = new Set<string>(
    existingMatches
      .filter((m) => m.technology === technology)
      .map((m) => `${m.technology}:${m.scope}`),
  );

  for (const file of files) {
    if (!file.endsWith(fileExtension)) continue;

    const scope = deriveScope(file);
    const key = `${technology}:${scope}`;
    if (detectedScopes.has(key)) continue;

    detectedScopes.add(key);
    newMatches.push({
      technology,
      matchedBy: `${technology} files found: ${file}`,
      confidence: "likely",
      scope,
    });
  }

  return newMatches;
}

export interface ProjectFileTfms {
  file: string;
  scope: string | undefined;
  xml: XmlElement;
  tfms: string[];
}

export async function extractTfmsFromProjectFiles(
  context: DetectionContext,
  projectFiles: string[],
  projectFilter: (xml: XmlElement) => boolean,
): Promise<ProjectFileTfms[]> {
  const results = await Promise.all(
    projectFiles.map(async (file): Promise<ProjectFileTfms | null> => {
      const xml = await getOrParseProjectXml(context, file);
      if (!xml) return null;
      if (!projectFilter(xml)) return null;

      const scope = deriveScope(file);
      const tfmElements = [
        ...findElements(xml, "TargetFramework"),
        ...findElements(xml, "TargetFrameworks"),
      ];

      const tfms: string[] = [];
      for (const elem of tfmElements) {
        const text = getTextContent(elem);
        if (text) {
          for (const tfm of text.split(";")) {
            const trimmed = tfm.trim();
            if (trimmed) tfms.push(trimmed);
          }
        }
      }

      return { file, scope, xml, tfms };
    }),
  );

  return results.filter((r): r is ProjectFileTfms => r !== null);
}

export interface DatabaseDetectorSpec {
  npmDependencies: string[];
  csprojSpecs: PackageRefMatchSpec[];
}

export async function matchDatabasePackages(
  context: DetectionContext,
  technology: string,
  spec: DatabaseDetectorSpec,
): Promise<DetectorMatch[]> {
  const matches: DetectorMatch[] = [];
  const packageJsonFiles = getPackageJsonFiles(context);

  const npmSpecs: DependencyMatchSpec[] = spec.npmDependencies.map((dep) => ({
    dependency: dep,
    technology,
  }));
  const pkgMatches = await matchPackageDependencies(context, packageJsonFiles, npmSpecs);
  matches.push(...pkgMatches);

  const csprojFiles = getCsprojFiles(context);
  const csprojMatches = await matchCsprojPackageReferences(context, csprojFiles, spec.csprojSpecs);
  matches.push(...csprojMatches);

  return matches;
}
