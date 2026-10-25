/**
 * Directory substring patterns that indicate a YAML file is likely a Kubernetes/Helm manifest.
 * Shared by `file-scanner.ts` (deciding whether to run the broader `templates/**` scan) and
 * `detectors/kubernetes.ts` (deciding whether to read a candidate YAML file's contents) so the
 * two checks cannot drift apart.
 */
export const K8S_DIRECTORY_PATTERNS: readonly string[] = [
  "helm/",
  "/k8s/",
  "/kubernetes/",
  "/manifests/",
  "/deploy/",
  "/chart/",
  "/charts/",
];

/** Patterns that match `templates/` as a directory component at any position. */
export const K8S_TEMPLATES_PATTERNS: readonly string[] = [
  "templates/",
  "/templates/",
];

/** Whether `file`'s path contains one of the known Kubernetes/Helm directory signals. */
export function isInK8sDirectory(file: string): boolean {
  const normalizedFile = file.toLowerCase().replace(/\\/g, "/");
  return (
    K8S_DIRECTORY_PATTERNS.some((pattern) => normalizedFile.includes(pattern)) ||
    K8S_TEMPLATES_PATTERNS.some((pattern) =>
      pattern.startsWith("/")
        ? normalizedFile.includes(pattern)
        : normalizedFile.startsWith(pattern) || normalizedFile.includes(`/${pattern}`)
    )
  );
}
