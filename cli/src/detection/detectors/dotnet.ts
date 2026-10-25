import { join } from "node:path";
import type { Detector, DetectionContext, DetectorMatch } from "../types";
import { findElements, type XmlElement } from "../xml-parser";
import { readFileWithLimit } from "../../utils/fs";
import { deriveScope } from "../scope-utils";
import {
  getBasename,
  extractTfmsFromProjectFiles,
  getDotnetProjectFiles,
} from "../detector-helpers";

/**
 * Matches a base .NET TFM version, optionally followed by an OS-specific
 * platform suffix (e.g. `net8.0-windows`, `net8.0-android34.0`, `net8.0-ios17.2`).
 * See https://learn.microsoft.com/en-us/dotnet/standard/frameworks
 */
const NET_TFM_VERSION_PATTERN = /^net(\d+\.\d+)(?:-.+)?$/;

/**
 * Matches SDK-style .NET Framework TFMs without a dot (e.g. `net48`, `net472`).
 * SDK-style projects can target .NET Framework using these short-form TFMs.
 */
const NET_FRAMEWORK_TFM_PATTERN = /^net(\d{2,3})$/;

function extractTfmVersion(tfm: string): string | undefined {
  const m = tfm.match(NET_TFM_VERSION_PATTERN);
  if (m?.[1]) return m[1];

  const frameworkMatch = tfm.match(NET_FRAMEWORK_TFM_PATTERN);
  if (frameworkMatch?.[1]) {
    const digits = frameworkMatch[1];
    if (digits.length === 2) {
      return `${digits[0]}.${digits[1]}`;
    }
    return `${digits[0]}.${digits[1]}.${digits[2]}`;
  }

  return undefined;
}

function isSdkStyleProject(xml: XmlElement): boolean {
  const projectElements = findElements(xml, "Project");
  return projectElements.some((elem) => "Sdk" in elem.attributes);
}

const GLOBAL_JSON_SDK_MATCHED_BY_SUFFIX = ":Microsoft.NET.Sdk";

async function readGlobalJsonSdkMatch(
  projectRoot: string,
  file: string,
): Promise<DetectorMatch | undefined> {
  try {
    const content = await readFileWithLimit(join(projectRoot, file));
    const json = JSON.parse(content) as { sdk?: { version?: string } };
    const sdkVersion = json.sdk?.version;
    if (!sdkVersion) return undefined;

    return {
      technology: "dotnet-sdk",
      version: sdkVersion,
      matchedBy: `${file}${GLOBAL_JSON_SDK_MATCHED_BY_SUFFIX}`,
      confidence: "definite",
      scope: deriveScope(file),
    };
  } catch {
    return undefined;
  }
}

export class DotnetDetector implements Detector {
  readonly id = "dotnet";
  readonly technology = "dotnet";

  async detect(context: DetectionContext): Promise<DetectorMatch[]> {
    const matches: DetectorMatch[] = [];
    const solutionExts = new Set([".sln", ".slnx"]);

    const projectFiles = getDotnetProjectFiles(context);
    const globalJsonFiles: string[] = [];
    for (const file of context.files) {
      const dotIndex = file.lastIndexOf(".");
      if (dotIndex < 0) continue;
      const ext = file.substring(dotIndex);
      const scope = deriveScope(file);

      if (solutionExts.has(ext)) {
        matches.push({
          technology: "dotnet",
          matchedBy: file,
          confidence: "definite",
          scope,
        });
      }

      const basename = getBasename(file);

      if (basename === "global.json") {
        globalJsonFiles.push(file);
      }

      if (basename === "Directory.Build.props") {
        matches.push({
          technology: "dotnet",
          matchedBy: file,
          confidence: "likely",
          scope,
        });
      }
    }

    const globalJsonMatches = await Promise.all(
      globalJsonFiles.map((file) => readGlobalJsonSdkMatch(context.projectRoot, file)),
    );
    for (const match of globalJsonMatches) {
      if (match) matches.push(match);
    }

    const projectResults = await extractTfmsFromProjectFiles(context, projectFiles, isSdkStyleProject);
    for (const { file, scope, tfms } of projectResults) {
      matches.push({
        technology: "dotnet",
        matchedBy: file,
        confidence: "definite",
        scope,
      });

      for (const tfm of tfms) {
        const version = extractTfmVersion(tfm);
        if (version) {
          matches.push({
            technology: "dotnet",
            version,
            matchedBy: file,
            confidence: "definite",
            scope,
          });
        }
      }
    }

    return matches;
  }
}


