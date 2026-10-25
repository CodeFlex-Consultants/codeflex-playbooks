import { detectHarnesses } from "../detection/harness/index";
import { filterHighMediumHarnesses, mergeDetectedHarnesses, saveConfig } from "../config/index";
import type { EngineeringConfig } from "../types/index";
import type { Reporter } from "./reporter";

/**
 * Re-runs harness detection and reconciles the result with `agentHarnesses`.
 *
 * Policy: detection may only ADD newly-found harnesses to the configured
 * list. It never removes a harness that is already configured, because
 * absence of a detection signal (e.g. no harness CLIs/extensions installed on
 * this machine/CI runner) is not proof the harness was uninstalled - see
 * `references/harness-detection-plan.md`. Harnesses that were configured but
 * not re-detected this run are kept and reported so a human can decide
 * whether to remove them manually from `engineering.yaml`.
 */
export async function autoDetectHarnesses(
  projectRoot: string,
  config: EngineeringConfig,
  reporter: Reporter,
): Promise<EngineeringConfig> {
  if (!config.autoDetect) {
    return config;
  }

  reporter.info("Re-detecting harnesses...");
  const harnessResults = await detectHarnesses(projectRoot);
  const detectedHarnesses = filterHighMediumHarnesses(harnessResults);

  const { merged, added, notRedetected } = mergeDetectedHarnesses(
    config.agentHarnesses,
    detectedHarnesses,
  );

  if (notRedetected.length > 0) {
    reporter.warn(
      `Note: ${notRedetected.join(", ")} configured in agentHarnesses but not detected this run. ` +
        "Detection is a convenience signal, not proof of removal, so these were kept unchanged. " +
        "Remove them from engineering.yaml manually if they're no longer used.",
    );
  }

  if (added.length === 0) {
    reporter.info("No new harnesses detected.");
    return config;
  }

  reporter.info(`Added harnesses: ${added.join(", ")}`);

  const updatedConfig = { ...config, agentHarnesses: merged };
  await saveConfig(projectRoot, updatedConfig);
  reporter.info("Updated agentHarnesses in engineering.yaml");
  return updatedConfig;
}
