import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";
import { AgentHarness } from "../../../types/index";
import { SurfaceType, type HarnessDetectionResult } from "../types";
import { HARNESS_SIGNAL_REGISTRY } from "../signal-registry";
import { checkCliWithVersion } from "../helpers";
import { DetectorBuilder } from "../detector-builder";
import { pathExists } from "../../../utils/fs";
import { isWindows, isMacOS, isLinux } from "../../../utils/platform";

const signals = HARNESS_SIGNAL_REGISTRY[AgentHarness.OpenCode];

function isSafeConfigPath(candidate: string): boolean {
  if (!isAbsolute(candidate)) return false;
  if (candidate.includes("..")) return false;
  return true;
}

// OpenCode intentionally does not use the shared `resolveConfigPaths` helper (see
// codex.ts/devin.ts): it needs multiple filename variants (opencode.json/.jsonc) and a
// project-local cwd fallback that `resolveConfigPaths` does not support. Keep this list in
// sync with https://opencode.ai/docs/config/ if OpenCode's resolution order changes.
async function checkConfigFile(): Promise<{ found: boolean; path?: string }> {
  const candidates: string[] = [];

  const xdgConfigHome = process.env["XDG_CONFIG_HOME"];
  if (xdgConfigHome) {
    candidates.push(join(xdgConfigHome, "opencode", "opencode.json"));
    candidates.push(join(xdgConfigHome, "opencode", "opencode.jsonc"));
  }

  candidates.push(join(homedir(), ".config", "opencode", "opencode.json"));
  candidates.push(join(homedir(), ".config", "opencode", "opencode.jsonc"));

  const customConfigPath = process.env["OPENCODE_CONFIG"];
  if (customConfigPath && isSafeConfigPath(customConfigPath)) {
    candidates.push(customConfigPath);
  }

  const customConfigDir = process.env["OPENCODE_CONFIG_DIR"];
  if (customConfigDir && isSafeConfigPath(customConfigDir)) {
    candidates.push(join(customConfigDir, "opencode.json"));
    candidates.push(join(customConfigDir, "opencode.jsonc"));
  }

  candidates.push(join(process.cwd(), "opencode.json"));
  candidates.push(join(process.cwd(), "opencode.jsonc"));

  candidates.push(join(process.cwd(), ".opencode", "opencode.json"));
  candidates.push(join(process.cwd(), ".opencode", "opencode.jsonc"));

  if (isWindows) {
    const appData = process.env["APPDATA"];
    if (appData) {
      candidates.push(join(appData, "opencode", "opencode.json"));
      candidates.push(join(appData, "opencode", "opencode.jsonc"));
    }
  }

  if (isMacOS) {
    candidates.push("/Library/Application Support/opencode/opencode.json");
    candidates.push("/Library/Application Support/opencode/opencode.jsonc");
  } else if (isLinux) {
    candidates.push("/etc/opencode/opencode.json");
    candidates.push("/etc/opencode/opencode.jsonc");
  } else if (isWindows) {
    const programData = process.env["ProgramData"];
    if (programData) {
      candidates.push(join(programData, "opencode", "opencode.json"));
      candidates.push(join(programData, "opencode", "opencode.jsonc"));
    }
  }

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return { found: true, path: candidate };
    }
  }

  return { found: false };
}

export async function detectOpenCode(): Promise<HarnessDetectionResult> {
  const builder = new DetectorBuilder(AgentHarness.OpenCode);

  const cliSignal = signals.find((s) => s.type === SurfaceType.CLI);
  const configSignal = signals.find((s) => s.type === SurfaceType.ConfigDir);

  if (cliSignal) {
    const binaryResult = await checkCliWithVersion("opencode");
    builder.addCheck({
      signal: cliSignal.description,
      value: binaryResult.version ?? cliSignal.check,
      found: binaryResult.found,
      surface: SurfaceType.CLI,
      reliability: cliSignal.reliability,
    });
  }

  if (configSignal) {
    const configResult = await checkConfigFile();
    builder.addCheck({
      signal: configSignal.description,
      value: configResult.path ?? "opencode.json",
      found: configResult.found,
      surface: SurfaceType.ConfigDir,
      reliability: configSignal.reliability,
    });
  }

  return builder.build();
}
