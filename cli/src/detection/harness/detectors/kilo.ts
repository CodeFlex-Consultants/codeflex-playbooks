import { homedir } from "node:os";
import { join } from "node:path";
import { AgentHarness } from "../../../types/index";
import { SurfaceType, type HarnessDetectionResult } from "../types";
import { HARNESS_SIGNAL_REGISTRY } from "../signal-registry";
import { checkCliWithVersion, buildPlatformCandidates, findFirstExisting } from "../helpers";
import { DetectorBuilder } from "../detector-builder";
import { pathExists } from "../../../utils/fs";
import { VSCODE_EXTENSION_DIRS } from "../vscode-utils";
import { isWindows } from "../../../utils/platform";
import { ENV_VARS } from "../../../utils/env-vars";
import { HARNESS_BINARIES, CONFIG_DIRS, PATH_SEGMENTS, DISPLAY_PATHS, SIGNAL_NAMES, RELIABILITY } from "../constants";

const signals = HARNESS_SIGNAL_REGISTRY[AgentHarness.Kilo];

export async function detectKilo(
  vsCodeExtensions: Set<string>,
): Promise<HarnessDetectionResult> {
  const builder = new DetectorBuilder(AgentHarness.Kilo);

  const extensionSignal = signals.find((s) => s.type === SurfaceType.VSCodeExtension)!;
  const cliSignal = signals.find((s) => s.type === SurfaceType.CLI)!;
  const modernConfigSignal = signals.find(
    (s) => s.type === SurfaceType.ConfigDir && s.check === `${CONFIG_DIRS.CONFIG}/${CONFIG_DIRS.KILO_CONFIG}`,
  )!;
  const kilocodeDirSignal = signals.find(
    (s) => s.type === SurfaceType.ConfigDir && s.check === CONFIG_DIRS.KILOCODE,
  )!;
  const legacyConfigSignal = signals.find(
    (s) => s.type === SurfaceType.ConfigDir && s.check === `${CONFIG_DIRS.KILOCODE}/${CONFIG_DIRS.CLI}`,
  )!;

  const extensionFound = vsCodeExtensions.has(extensionSignal.check);
  builder.addCheck({
    signal: extensionSignal.description,
    value: extensionSignal.check,
    found: extensionFound,
    surface: SurfaceType.VSCodeExtension,
    reliability: extensionSignal.reliability,
  });

  const binaryResult = await checkCliWithVersion(HARNESS_BINARIES.KILO);
  builder.addCheck({
    signal: cliSignal.description,
    value: binaryResult.version ?? cliSignal.check,
    found: binaryResult.found,
    surface: SurfaceType.CLI,
    reliability: cliSignal.reliability,
  });

  const modernConfigCandidates = buildPlatformCandidates(homedir(), CONFIG_DIRS.CONFIG, CONFIG_DIRS.KILO_CONFIG);
  if (isWindows) {
    const programData = process.env[ENV_VARS.PROGRAM_DATA];
    if (programData) {
      modernConfigCandidates.push(join(programData, CONFIG_DIRS.KILO_CONFIG));
    }
  }
  const modernConfigPath = await findFirstExisting(modernConfigCandidates);
  
  builder.addCheck({
    signal: modernConfigSignal.description,
    value: modernConfigPath ?? DISPLAY_PATHS.KILO_CONFIG,
    found: modernConfigPath !== undefined,
    surface: SurfaceType.ConfigDir,
    reliability: modernConfigSignal.reliability,
  });

  const kilocodeCandidates = buildPlatformCandidates(homedir(), CONFIG_DIRS.KILOCODE);
  const kilocodePath = await findFirstExisting(kilocodeCandidates);
  
  builder.addCheck({
    signal: kilocodeDirSignal.description,
    value: kilocodePath ?? DISPLAY_PATHS.KILOCODE,
    found: kilocodePath !== undefined,
    surface: SurfaceType.ConfigDir,
    reliability: kilocodeDirSignal.reliability,
  });

  const legacyCandidates = buildPlatformCandidates(homedir(), CONFIG_DIRS.KILOCODE, CONFIG_DIRS.CLI);
  const legacyPath = await findFirstExisting(legacyCandidates);
  
  builder.addCheck({
    signal: legacyConfigSignal.description,
    value: legacyPath ?? DISPLAY_PATHS.KILOCODE_CLI,
    found: legacyPath !== undefined,
    surface: SurfaceType.ConfigDir,
    reliability: legacyConfigSignal.reliability,
  });

  let extensionGlobalStorageFound = false;
  for (const extensionDir of VSCODE_EXTENSION_DIRS) {
    const found = await pathExists(
      join(
        homedir(),
        extensionDir,
        extensionSignal.check,
        PATH_SEGMENTS.GLOBAL_STORAGE,
        extensionSignal.check,
      ),
    );
    if (found) {
      extensionGlobalStorageFound = true;
      break;
    }
  }
  builder.addCheck({
    signal: SIGNAL_NAMES.EXTENSION_GLOBAL_STORAGE,
    value: `${PATH_SEGMENTS.GLOBAL_STORAGE}/${extensionSignal.check}/`,
    found: extensionGlobalStorageFound,
    reliability: RELIABILITY.MEDIUM,
  });

  return builder.build();
}
