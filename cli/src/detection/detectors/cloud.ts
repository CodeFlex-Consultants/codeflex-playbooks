import { join } from "node:path";
import type { Detector, DetectionContext, DetectorMatch } from "../types";
import { safeReadFile } from "../../utils/fs";
import { deriveScope } from "../scope-utils";

export class CloudDetector implements Detector {
  readonly id = "cloud";
  readonly technology = "cloud";

  async detect(context: DetectionContext): Promise<DetectorMatch[]> {
    const matches: DetectorMatch[] = [];

    for (const file of context.files) {
      if (file.endsWith(".bicep")) {
        matches.push({
          technology: "bicep",
          scope: deriveScope(file),
          matchedBy: `Bicep file: ${file}`,
          confidence: "definite",
        });
      }

      if (file.endsWith(".tf")) {
        matches.push({
          technology: "terraform",
          scope: deriveScope(file),
          matchedBy: `Terraform file: ${file}`,
          confidence: "definite",
        });
      }

      if (file.endsWith("Dockerfile") || file.endsWith("docker-compose.yml")) {
        matches.push({
          technology: "docker",
          scope: deriveScope(file),
          matchedBy: `Docker file: ${file}`,
          confidence: "definite",
        });
      }

      if (file === "azure-pipelines.yml" || file.endsWith("/azure-pipelines.yml") || file.endsWith("\\azure-pipelines.yml")) {
        matches.push({
          technology: "azure-devops",
          scope: deriveScope(file),
          matchedBy: `Azure Pipelines: ${file}`,
          confidence: "definite",
        });
      }

      if (file.startsWith(".github/workflows/") && file.endsWith(".yml")) {
        const content = await safeReadFile(join(context.projectRoot, file));
        if (content?.includes("azure")) {
          matches.push({
            technology: "azure-devops",
            scope: deriveScope(file),
            matchedBy: `Azure GitHub Actions workflow: ${file}`,
            confidence: "likely",
          });
        }
      }
    }

    return matches;
  }
}
