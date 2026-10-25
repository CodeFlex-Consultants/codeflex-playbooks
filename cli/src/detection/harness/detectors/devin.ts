import { homedir } from "node:os";
import { join } from "node:path";
import { AgentHarness } from "../../../types/index";
import { SurfaceType, type HarnessDetectionResult } from "../types";
import { HARNESS_SIGNAL_REGISTRY } from "../signal-registry";
import { DetectorBuilder } from "../detector-builder";
import { pathExists } from "../../../utils/fs";
import { resolveConfigPaths } from "../platform-paths";
import {
  checkAppBundle,
  standardAppBundleCandidates,
  standardAppBundleValue,
} from "../app-bundle";

const DEVIN_CONFIG_FILE = "config.json";

const signals = HARNESS_SIGNAL_REGISTRY[AgentHarness.Devin];

const APP_BUNDLE_NAMES = {
  mac: "Devin",
  windows: "Devin",
  linuxDesktop: "devin",
  linuxAppImage: "Devin",
};

export async function detectDevin(): Promise<HarnessDetectionResult> {
  const builder = new DetectorBuilder(AgentHarness.Devin);

  const appBundleSignal = signals.find((s) => s.type === SurfaceType.AppBundle);
  const configSignal = signals.find((s) => s.type === SurfaceType.ConfigDir);

  if (appBundleSignal) {
    const appBundleResult = await checkAppBundle(
      standardAppBundleCandidates(APP_BUNDLE_NAMES),
    );
    builder.addCheck({
      signal: appBundleSignal.description,
      value: standardAppBundleValue(APP_BUNDLE_NAMES),
      found: appBundleResult.found,
      surface: SurfaceType.AppBundle,
      reliability: appBundleSignal.reliability,
    });
  }

  if (configSignal) {
    const candidates = resolveConfigPaths(".config/devin", homedir(), process.platform);
    let configExists = false;
    for (const candidate of candidates) {
      if (await pathExists(join(candidate, DEVIN_CONFIG_FILE))) {
        configExists = true;
        break;
      }
    }
    builder.addCheck({
      signal: configSignal.description,
      value: "~/.config/devin/config.json",
      found: configExists,
      surface: SurfaceType.ConfigDir,
      reliability: configSignal.reliability,
    });
  }

  return builder.build();
}
