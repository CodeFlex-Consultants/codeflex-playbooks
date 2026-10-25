import type { Detector, DetectionContext, DetectorMatch } from "../types";
import { findElements, getTextContent, type XmlElement } from "../xml-parser";
import { deriveScope } from "../scope-utils";
import { getBasename, extractTfmsFromProjectFiles, getDotnetProjectFiles } from "../detector-helpers";

const FRAMEWORK_TFM_PATTERN = /^net(\d{2,3})$/;

function extractFrameworkVersion(tfm: string): string | undefined {
  const m = tfm.match(FRAMEWORK_TFM_PATTERN);
  if (!m?.[1]) return undefined;
  const digits = m[1];
  if (digits.length === 2) {
    return `${digits[0]}.${digits[1]}`;
  }
  return `${digits[0]}.${digits[1]}.${digits[2]}`;
}

function isOldStyleProject(xml: XmlElement): boolean {
  const projectElements = findElements(xml, "Project");
  return projectElements.length > 0 && !projectElements.some((elem) => "Sdk" in elem.attributes);
}

export class DotnetFrameworkDetector implements Detector {
  readonly id = "dotnet-framework";
  readonly technology = "dotnet-framework";

  async detect(context: DetectionContext): Promise<DetectorMatch[]> {
    const matches: DetectorMatch[] = [];

    const projectFiles = getDotnetProjectFiles(context);
    for (const file of context.files) {
      const basename = getBasename(file);

      if (basename === "packages.config") {
        const scope = deriveScope(file);
        matches.push({
          technology: "dotnet-framework",
          matchedBy: file,
          confidence: "definite",
          scope,
        });
      }
    }

    const projectResults = await extractTfmsFromProjectFiles(context, projectFiles, isOldStyleProject);
    for (const { file, scope, xml, tfms } of projectResults) {
      matches.push({
        technology: "dotnet-framework",
        matchedBy: file,
        confidence: "definite",
        scope,
      });

      for (const tfm of tfms) {
        const version = extractFrameworkVersion(tfm);
        if (version) {
          matches.push({
            technology: "dotnet-framework",
            version,
            matchedBy: file,
            confidence: "definite",
            scope,
          });
        }
      }

      const tfvElements = findElements(xml, "TargetFrameworkVersion");
      for (const elem of tfvElements) {
        const text = getTextContent(elem);
        if (text) {
          const version = text.trim().replace(/^v/, "");
          if (version) {
            matches.push({
              technology: "dotnet-framework",
              version,
              matchedBy: file,
              confidence: "definite",
              scope,
            });
          }
        }
      }
    }

    return matches;
  }
}
