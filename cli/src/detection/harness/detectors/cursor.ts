import { homedir } from "node:os";
import { join } from "node:path";
import { AgentHarness } from "../../../types/index";
import { SurfaceType, type HarnessDetectionResult } from "../types";
import { HARNESS_SIGNAL_REGISTRY } from "../signal-registry";
import { DetectorBuilder } from "../detector-builder";
import { pathExists } from "../../../utils/fs";
import {
  checkAppBundle,
  standardAppBundleCandidates,
  standardAppBundleValue,
} from "../app-bundle";

const signals = HARNESS_SIGNAL_REGISTRY[AgentHarness.Cursor];

const APP_BUNDLE_NAMES = {
  mac: "Cursor",
  windows: "cursor",
  linuxDesktop: "cursor",
  linuxAppImage: "cursor",
};

export async function detectCursor(): Promise<HarnessDetectionResult> {
  const builder = new DetectorBuilder(AgentHarness.Cursor);

  const appBundleSignal = signals.find((s) => s.type === SurfaceType.AppBundle)!;
  const configSignal = signals.find((s) => s.type === SurfaceType.ConfigDir)!;

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

  const configDirExists = await pathExists(join(homedir(), ".cursor"));
  builder.addCheck({
    signal: configSignal.description,
    value: "~/.cursor/",
    found: configDirExists,
    surface: SurfaceType.ConfigDir,
    reliability: configSignal.reliability,
  });

  return builder.build();
}
