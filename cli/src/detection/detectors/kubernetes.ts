import { join } from "node:path";
import type { Detector, DetectionContext, DetectorMatch } from "../types";
import { safeReadFileWithLimit } from "../../utils/fs";
import { deriveScope } from "../scope-utils";
import { getBasename } from "../detector-helpers";
import { isInK8sDirectory } from "../k8s-patterns";

const K8S_KINDS = [
  "kind: Deployment",
  "kind: Service",
  "kind: ConfigMap",
  "kind: StatefulSet",
  "kind: DaemonSet",
  "kind: Ingress",
  "kind: Job",
  "kind: CronJob",
  "kind: Namespace",
  "kind: PersistentVolumeClaim",
];

export class KubernetesDetector implements Detector {
  readonly id = "kubernetes";
  readonly technology = "kubernetes";

  async detect(context: DetectionContext): Promise<DetectorMatch[]> {
    const matches: DetectorMatch[] = [];
    const yamlFilesToCheck: string[] = [];

    for (const file of context.files) {
      const basename = getBasename(file);

      if (basename === "Chart.yaml") {
        matches.push({
          technology: "helm",
          matchedBy: file,
          confidence: "definite",
          scope: deriveScope(file),
        });
      }

      if (basename === "kustomization.yaml" || basename === "kustomization.yml" || basename === "Kustomization") {
        matches.push({
          technology: "kustomize",
          matchedBy: file,
          confidence: "definite",
          scope: deriveScope(file),
        });
      }

      if (
        (file.endsWith(".yaml") || file.endsWith(".yml")) &&
        basename !== "Chart.yaml" &&
        basename !== "kustomization.yaml" &&
        basename !== "kustomization.yml" &&
        !isNonK8sYaml(file, basename) &&
        isInK8sDirectory(file)
      ) {
        yamlFilesToCheck.push(file);
      }
    }

    const contents = await Promise.all(
      yamlFilesToCheck.map((file) => safeReadFileWithLimit(join(context.projectRoot, file))),
    );

    for (let i = 0; i < yamlFilesToCheck.length; i++) {
      const content = contents[i];
      if (content && K8S_KINDS.some((kind) => content.includes(kind))) {
        matches.push({
          technology: "kubernetes",
          matchedBy: `Kubernetes manifest: ${yamlFilesToCheck[i]}`,
          confidence: "definite",
          scope: deriveScope(yamlFilesToCheck[i]!),
        });
      }
    }

    return matches;
  }
}

const NON_K8S_YAML_BASENAMES = new Set([
  "docker-compose.yml",
  "docker-compose.yaml",
  "compose.yml",
  "compose.yaml",
  "azure-pipelines.yml",
  "azure-pipelines.yaml",
  ".gitlab-ci.yml",
  ".gitlab-ci.yaml",
  ".prettierrc.yml",
  ".prettierrc.yaml",
  ".eslintrc.yml",
  ".eslintrc.yaml",
]);

function isNonK8sYaml(file: string, basename: string): boolean {
  if (NON_K8S_YAML_BASENAMES.has(basename)) return true;
  if (file.startsWith(".github/") || file.includes("/.github/")) return true;
  if (file.startsWith(".gitlab/") || file.includes("/.gitlab/")) return true;
  return false;
}
