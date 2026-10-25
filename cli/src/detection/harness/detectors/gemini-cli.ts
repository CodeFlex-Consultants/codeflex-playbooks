import { homedir } from "node:os";
import { join } from "node:path";
import { AgentHarness } from "../../../types/index";
import { SurfaceType, type HarnessDetectionResult } from "../types";
import { HARNESS_SIGNAL_REGISTRY } from "../signal-registry";
import { checkCliWithVersion, buildPlatformCandidates, findFirstExisting } from "../helpers";
import { DetectorBuilder } from "../detector-builder";
import { pathExists } from "../../../utils/fs";
import { HARNESS_BINARIES, CONFIG_DIRS, DISPLAY_PATHS } from "../constants";

const signals = HARNESS_SIGNAL_REGISTRY[AgentHarness.GeminiCli];

async function checkConfigDir(): Promise<{ found: boolean; path?: string }> {
  const candidates = buildPlatformCandidates(homedir(), CONFIG_DIRS.GEMINI);
  const foundPath = await findFirstExisting(candidates);
  
  if (foundPath) {
    return { found: true, path: foundPath };
  }

  return { found: false };
}

async function checkProjectDir(projectRoot: string): Promise<{ found: boolean; path?: string }> {
  const projectGemini = join(projectRoot, CONFIG_DIRS.GEMINI);
  if (await pathExists(projectGemini)) {
    return { found: true, path: projectGemini };
  }
  return { found: false };
}

export async function detectGeminiCli(projectRoot?: string): Promise<HarnessDetectionResult> {
  const builder = new DetectorBuilder(AgentHarness.GeminiCli);

  const cliSignal = signals.find((s) => s.type === SurfaceType.CLI)!;
  const configSignal = signals.find((s) => s.type === SurfaceType.ConfigDir)!;
  const projectSignal = signals.find((s) => s.type === SurfaceType.ProjectFile)!;

  const binaryResult = await checkCliWithVersion(HARNESS_BINARIES.GEMINI);
  builder.addCheck({
    signal: cliSignal.description,
    value: binaryResult.version ?? cliSignal.check,
    found: binaryResult.found,
    surface: SurfaceType.CLI,
    reliability: cliSignal.reliability,
  });

  const configResult = await checkConfigDir();
  builder.addCheck({
    signal: configSignal.description,
    value: configResult.path ?? DISPLAY_PATHS.GEMINI,
    found: configResult.found,
    surface: SurfaceType.ConfigDir,
    reliability: configSignal.reliability,
  });

  if (projectRoot) {
    const projectResult = await checkProjectDir(projectRoot);
    builder.addCheck({
      signal: projectSignal.description,
      value: projectResult.path ?? DISPLAY_PATHS.GEMINI_PROJECT,
      found: projectResult.found,
      surface: SurfaceType.ProjectFile,
      reliability: projectSignal.reliability,
    });
  }

  return builder.build();
}
