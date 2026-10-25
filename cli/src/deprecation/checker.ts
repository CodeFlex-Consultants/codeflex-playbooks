import { DEPRECATION_REGISTRY } from "./registry";
import { DeprecationSeverity, type DeprecationCheckOptions, type DeprecationCheckResult, type DeprecationReport } from "./types";

export async function checkDeprecations(options: DeprecationCheckOptions): Promise<DeprecationReport> {
  const { projectRoot } = options;

  const results: DeprecationCheckResult[] = await Promise.all(
    DEPRECATION_REGISTRY.map(async (entry) => {
      const detected = await entry.detect(projectRoot);
      return { entry, detected };
    }),
  );

  const warnings = results.filter(
    (r) => r.detected && r.entry.severity === DeprecationSeverity.Warning,
  );
  const errors = results.filter(
    (r) => r.detected && r.entry.severity === DeprecationSeverity.Error,
  );

  return {
    results,
    warnings,
    errors,
    hasIssues: warnings.length > 0 || errors.length > 0,
  };
}

export function hasDeprecationErrors(report: DeprecationReport): boolean {
  return report.errors.length > 0;
}
