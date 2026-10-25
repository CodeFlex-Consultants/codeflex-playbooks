import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { DetectionConfidence } from "./types";
import { execFile } from "../../utils/exec";
import { isWindows, isMacOS } from "../../utils/platform";
import { pathExists } from "../../utils/fs";
import { ENV_VARS } from "../../utils/env-vars";
import { FILE_EXTENSIONS, CLI_FLAGS, RELIABILITY, CONFIG_DIRS, PATH_SEGMENTS } from "./constants";

const CLI_TIMEOUT_MS = 5_000;

/**
 * Execute a command asynchronously on Windows using cmd.exe wrapper.
 * This avoids the process tree hang issue with shell: true.
 */
function execWindowsCommand(command: string, args: string[], timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    // Build the command line for cmd.exe
    // /d = skip AutoRun, /s = modify /c to treat first/last quote as part of command
    // /c = run command and exit
    const cmdArgs = ["/d", "/s", "/c", command, ...args];
    
    const child = spawn("cmd.exe", cmdArgs, {
      windowsHide: true,
      windowsVerbatimArguments: true,
    });

    let stdout = "";
    let stderr = "";
    let timeoutId: NodeJS.Timeout | undefined;
    let settled = false;

    const settle = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      if (timeoutId) clearTimeout(timeoutId);
      fn();
    };

    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        settle(() => {
          child.kill();
          reject(new Error("Process timed out"));
        });
      }, timeout);
    }

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("error", (err) => {
      settle(() => reject(err));
    });

    child.on("close", (code) => {
      settle(() => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Process exited with code ${code}: ${stderr}`));
        }
      });
    });
  });
}

export async function checkCliWithVersion(
  binaryName: string,
): Promise<{ found: boolean; version?: string }> {
  // On Windows, npm global packages are installed as .cmd files
  // which require cmd.exe to execute. Use spawn with cmd.exe wrapper
  // instead of shell: true to avoid process tree hangs.
  const candidates = isWindows 
    ? [binaryName, `${binaryName}${FILE_EXTENSIONS.WINDOWS_CMD}`]
    : [binaryName];

  for (const candidate of candidates) {
    try {
      let stdout: string;
      
      if (isWindows) {
        // On Windows, invoke cmd.exe directly for .cmd/.bat files
        stdout = await execWindowsCommand(candidate, [CLI_FLAGS.VERSION], CLI_TIMEOUT_MS);
      } else {
        const result = await execFile(candidate, [CLI_FLAGS.VERSION], {
          timeout: CLI_TIMEOUT_MS,
        });
        stdout = result.stdout;
      }
      
      return { found: true, version: stdout.trim() };
    } catch {
      continue;
    }
  }
  
  return { found: false };
}

/**
 * A single detection signal fed into `calculateConfidence`, tagged with the
 * reliability tier from `references/harness-detection-plan.md`'s "Detection
 * signal types, ranked by trust" table (binary+version / extension folder /
 * app bundle = high; home-dir config file = medium; project native file as
 * an install signal = low) and whether that signal was actually observed.
 */
export interface ConfidenceSignal {
  readonly reliability: "high" | "medium" | "low";
  readonly found: boolean;
}

/**
 * Single shared confidence rule for all harness detectors, per the plan's
 * "Rule of thumb: require two agreeing signals before reporting 'high
 * confidence.' A lone stale config directory should surface as 'possible,'
 * not 'detected.'"
 *
 * - Two (or more) found high-reliability signals agree -> High.
 * - One found high-reliability signal plus at least one other found signal
 *   (medium or low reliability) agree -> High.
 * - A single found high-reliability signal alone -> Medium.
 * - Two or more found non-high signals agree (no high signal) -> Medium.
 * - A single found non-high signal alone (e.g. a lone stale config
 *   directory) -> Low ("possible", not "detected").
 * - Nothing found -> None.
 *
 * Callers pass every signal they checked (found or not); only `found`
 * signals affect the result. This is the generalization of the old
 * two-signal-only `twoSignalConfidence(primary, secondary)` rule (a High
 * when both found, Medium for primary alone, Low for secondary alone) to an
 * arbitrary number of signals, so harnesses with more than two surfaces
 * (Kilo's extension/CLI/config-dir/global-storage, Copilot's
 * extension/chat-extension/global-storage/JetBrains-plugin) can share the
 * same scoring instead of reimplementing it.
 */
export function calculateConfidence(
  signals: readonly ConfidenceSignal[],
): DetectionConfidence {
  const found = signals.filter((s) => s.found);
  const highFound = found.filter((s) => s.reliability === RELIABILITY.HIGH).length;
  const otherFound = found.length - highFound;

  if (highFound >= 2) {
    return DetectionConfidence.High;
  }
  if (highFound >= 1 && otherFound >= 1) {
    return DetectionConfidence.High;
  }
  if (highFound >= 1) {
    return DetectionConfidence.Medium;
  }
  if (otherFound >= 2) {
    return DetectionConfidence.Medium;
  }
  if (otherFound >= 1) {
    return DetectionConfidence.Low;
  }
  return DetectionConfidence.None;
}

export async function checkJetBrainsPlugin(
  pluginId: string,
  homeDir: string,
): Promise<boolean> {
  const baseDirs = getJetBrainsBaseDirs(homeDir);
  const lowerPluginId = pluginId.toLowerCase();

  for (const baseDir of baseDirs) {
    let ideEntries: string[];
    try {
      ideEntries = await readdir(baseDir);
    } catch {
      continue;
    }

    for (const ideEntry of ideEntries) {
      const pluginsDir = join(baseDir, ideEntry, CONFIG_DIRS.PLUGINS);
      let pluginEntries: string[];
      try {
        pluginEntries = await readdir(pluginsDir);
      } catch {
        continue;
      }

      for (const pluginEntry of pluginEntries) {
        if (pluginEntry.toLowerCase().includes(lowerPluginId)) {
          return true;
        }
      }
    }
  }

  return false;
}

function getJetBrainsBaseDirs(
  homeDir: string,
): string[] {
  const dirs: string[] = [];

  if (isWindows) {
    const appData = process.env[ENV_VARS.APPDATA];
    if (appData) {
      dirs.push(join(appData, CONFIG_DIRS.JETBRAINS));
    }
  } else if (isMacOS) {
    dirs.push(join(homeDir, PATH_SEGMENTS.LIBRARY, PATH_SEGMENTS.APPLICATION_SUPPORT, CONFIG_DIRS.JETBRAINS));
  } else {
    dirs.push(join(homeDir, PATH_SEGMENTS.LOCAL, PATH_SEGMENTS.SHARE, CONFIG_DIRS.JETBRAINS));
  }

  return dirs;
}

export function buildPlatformCandidates(basePath: string, ...subPaths: string[]): string[] {
  const candidates = [join(basePath, ...subPaths)];
  if (isWindows) {
    const userProfile = process.env[ENV_VARS.USERPROFILE];
    if (userProfile) {
      candidates.push(join(userProfile, ...subPaths));
    }
  }
  return candidates;
}

export async function findFirstExisting(candidates: string[]): Promise<string | undefined> {
  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }
  return undefined;
}
