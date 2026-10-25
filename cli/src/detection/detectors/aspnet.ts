import { join } from "node:path";
import type { Detector, DetectionContext, DetectorMatch } from "../types";
import { filesEndingWith } from "../types";
import { matchCsprojPackageReferences, getCsprojFiles } from "../detector-helpers";
import { safeReadFile } from "../../utils/fs";
import { deriveScope } from "../scope-utils";

export class AspNetDetector implements Detector {
  readonly id = "aspnet";
  readonly technology = "aspnet-core";

  async detect(context: DetectionContext): Promise<DetectorMatch[]> {
    const matches: DetectorMatch[] = [];
    const csprojFiles = getCsprojFiles(context);
    const programFiles = filesEndingWith(context.files, "Program.cs");

    for (const csproj of csprojFiles) {
      const content = await safeReadFile(join(context.projectRoot, csproj));
      if (!content) continue;

      if (content.includes('Sdk="Microsoft.NET.Sdk.Web"')) {
        matches.push({
          technology: "aspnet-core",
          scope: deriveScope(csproj),
          matchedBy: `Project SDK: ${csproj}`,
          confidence: "definite",
        });
      }
    }

    const csprojMatches = await matchCsprojPackageReferences(context, csprojFiles, [
      {
        match: (include): boolean => include.startsWith("Microsoft.AspNetCore."),
        technology: "aspnet-core",
      },
    ]);
    matches.push(...csprojMatches);

    for (const programFile of programFiles) {
      const content = await safeReadFile(join(context.projectRoot, programFile));
      if (!content) continue;

      if (content.includes("WebApplication.CreateBuilder")) {
        matches.push({
          technology: "aspnet-core",
          scope: deriveScope(programFile),
          matchedBy: `WebApplication.CreateBuilder in ${programFile}`,
          confidence: "definite",
        });
      }
    }

    return matches;
  }
}
