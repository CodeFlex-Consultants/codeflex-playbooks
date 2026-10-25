import { homedir } from "node:os";
import { join } from "node:path";
import { AgentHarness } from "../../../types/index";
import { SurfaceType, type HarnessDetectionResult } from "../types";
import { HARNESS_SIGNAL_REGISTRY } from "../signal-registry";
import { checkCliWithVersion, buildPlatformCandidates, findFirstExisting } from "../helpers";
import { DetectorBuilder } from "../detector-builder";
import { pathExists } from "../../../utils/fs";
import { checkAppBundle } from "../app-bundle";
import { ENV_VARS } from "../../../utils/env-vars";
import { HARNESS_BINARIES, CONFIG_DIRS, PATH_SEGMENTS, DISPLAY_PATHS, SIGNAL_NAMES, RELIABILITY, APP_BUNDLES } from "../constants";

const signals = HARNESS_SIGNAL_REGISTRY[AgentHarness.ClaudeCode];

async function checkConfigDir(): Promise<{ found: boolean; path?: string; signalIndex: number }> {
  const envSignal = signals.find((s) => s.check === `$${ENV_VARS.CLAUDE_CONFIG_DIR}`);
  const envSignalIndex = envSignal ? signals.indexOf(envSignal) : -1;

  const envConfigDir = process.env[ENV_VARS.CLAUDE_CONFIG_DIR];
  if (envConfigDir) {
    if (await pathExists(envConfigDir)) {
      return { found: true, path: envConfigDir, signalIndex: envSignalIndex };
    }
  }

  const defaultSignal = signals.find((s) => s.check === CONFIG_DIRS.CLAUDE);
  const defaultSignalIndex = defaultSignal ? signals.indexOf(defaultSignal) : -1;

  const candidates = buildPlatformCandidates(homedir(), CONFIG_DIRS.CLAUDE);
  const foundPath = await findFirstExisting(candidates);
  
  if (foundPath) {
    return { found: true, path: foundPath, signalIndex: defaultSignalIndex };
  }

  return { found: false, signalIndex: -1 };
}

async function checkClaudeAppBundle(): Promise<{ found: boolean; path?: string }> {
  return checkAppBundle({
    darwin: () => [
      `/Applications/${APP_BUNDLES.CLAUDE_APP}`,
      join(homedir(), PATH_SEGMENTS.LOCAL, PATH_SEGMENTS.SHARE, CONFIG_DIRS.CLAUDE, APP_BUNDLES.CLAUDE_CODE_APP),
    ],
    win32: () => {
      const localAppData = process.env[ENV_VARS.LOCALAPPDATA];
      if (!localAppData) {
        return null;
      }
      return [join(localAppData, PATH_SEGMENTS.PROGRAMS, CONFIG_DIRS.CLAUDE_APP)];
    },
    linux: () => {
      const home = homedir();
      return [
        join(home, PATH_SEGMENTS.LOCAL, PATH_SEGMENTS.SHARE, PATH_SEGMENTS.APPLICATIONS, APP_BUNDLES.CLAUDE_DESKTOP),
        join(home, PATH_SEGMENTS.APPLICATIONS, APP_BUNDLES.CLAUDE_APPIMAGE),
      ];
    },
  });
}

export async function detectClaudeCode(): Promise<HarnessDetectionResult> {
  const builder = new DetectorBuilder(AgentHarness.ClaudeCode);

  const cliSignal = signals.find((s) => s.type === SurfaceType.CLI)!;
  const appBundleSignal = signals.find((s) => s.type === SurfaceType.AppBundle)!;

  const binaryResult = await checkCliWithVersion(HARNESS_BINARIES.CLAUDE);
  builder.addCheck({
    signal: cliSignal.description,
    value: binaryResult.version ?? cliSignal.check,
    found: binaryResult.found,
    surface: SurfaceType.CLI,
    reliability: cliSignal.reliability,
  });

  const appBundleResult = await checkClaudeAppBundle();
  builder.addCheck({
    signal: appBundleSignal.description,
    value: appBundleResult.path ?? `/Applications/${APP_BUNDLES.CLAUDE_APP}`,
    found: appBundleResult.found,
    surface: SurfaceType.AppBundle,
    reliability: appBundleSignal.reliability,
  });

  const configResult = await checkConfigDir();
  const configSignal = configResult.signalIndex >= 0 ? signals[configResult.signalIndex] : undefined;
  builder.addCheck({
    signal: configSignal?.description ?? SIGNAL_NAMES.CONFIG_DIR,
    value: configResult.path ?? DISPLAY_PATHS.CLAUDE,
    found: configResult.found,
    surface: SurfaceType.ConfigDir,
    reliability: configSignal?.reliability ?? RELIABILITY.MEDIUM,
  });

  return builder.build();
}
