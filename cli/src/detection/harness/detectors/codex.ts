import { homedir } from "node:os";
import { join } from "node:path";
import { AgentHarness } from "../../../types/index";
import { SurfaceType, type HarnessDetectionResult } from "../types";
import { HARNESS_SIGNAL_REGISTRY } from "../signal-registry";
import { checkCliWithVersion, buildPlatformCandidates, findFirstExisting } from "../helpers";
import { DetectorBuilder } from "../detector-builder";
import {
  checkAppBundle,
  standardAppBundleCandidates,
  standardAppBundleValue,
} from "../app-bundle";
import { isWindows } from "../../../utils/platform";
import { ENV_VARS } from "../../../utils/env-vars";
import { HARNESS_BINARIES, CONFIG_DIRS, CONFIG_FILES, APP_BUNDLES } from "../constants";

const CODEX_CONFIG_FILE = CONFIG_FILES.CODEX_CONFIG;

const signals = HARNESS_SIGNAL_REGISTRY[AgentHarness.Codex];

const APP_BUNDLE_NAMES = {
  mac: APP_BUNDLES.CHATGPT,
  windows: APP_BUNDLES.CHATGPT,
  linuxDesktop: HARNESS_BINARIES.CODEX,
  linuxAppImage: CONFIG_DIRS.CODEX_APP,
};

export async function detectCodex(): Promise<HarnessDetectionResult> {
  const builder = new DetectorBuilder(AgentHarness.Codex);

  const cliSignal = signals.find((s) => s.type === SurfaceType.CLI);
  const appBundleSignal = signals.find((s) => s.type === SurfaceType.AppBundle);
  const configSignal = signals.find((s) => s.type === SurfaceType.ConfigDir);

  if (cliSignal) {
    const binaryResult = await checkCliWithVersion(HARNESS_BINARIES.CODEX);
    builder.addCheck({
      signal: cliSignal.description,
      value: binaryResult.version ?? cliSignal.check,
      found: binaryResult.found,
      surface: SurfaceType.CLI,
      reliability: cliSignal.reliability,
    });
  }

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
    const configCandidates = buildPlatformCandidates(homedir(), CONFIG_DIRS.CODEX, CODEX_CONFIG_FILE);
    if (isWindows) {
      const programData = process.env[ENV_VARS.PROGRAM_DATA];
      if (programData) {
        configCandidates.push(join(programData, CONFIG_DIRS.OPENAI, CONFIG_DIRS.CODEX_APP, CODEX_CONFIG_FILE));
      }
    }

    const foundPath = await findFirstExisting(configCandidates);

    builder.addCheck({
      signal: configSignal.description,
      value: foundPath ?? configCandidates[0] ?? join(homedir(), CONFIG_DIRS.CODEX, CODEX_CONFIG_FILE),
      found: foundPath !== undefined,
      surface: SurfaceType.ConfigDir,
      reliability: configSignal.reliability,
    });
  }

  return builder.build();
}
