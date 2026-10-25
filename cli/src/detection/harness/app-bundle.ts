import { homedir, platform } from "node:os";
import { join } from "node:path";
import { pathExists } from "../../utils/fs";

/**
 * Per-platform candidate path resolvers for app bundle detection. Each
 * resolver returns the ordered list of paths to probe for that platform, or
 * `null`/an empty array when the platform's prerequisites (e.g.
 * `%LOCALAPPDATA%` on Windows) aren't available.
 */
export interface AppBundlePlatformCandidates {
  readonly darwin: () => string[];
  readonly win32: () => string[] | null;
  readonly linux: () => string[];
}

/**
 * Checks each candidate path for the current platform in order and returns
 * the first one that exists. Shared by all detectors that probe for a
 * desktop/native app bundle (Codex, Cursor, Claude Code, ...).
 */
export async function checkAppBundle(
  candidates: AppBundlePlatformCandidates,
): Promise<{ found: boolean; path?: string }> {
  let paths: string[] | null;

  switch (platform()) {
    case "darwin":
      paths = candidates.darwin();
      break;
    case "win32":
      paths = candidates.win32();
      break;
    case "linux":
      paths = candidates.linux();
      break;
    default:
      paths = null;
  }

  if (!paths) {
    return { found: false };
  }

  for (const candidate of paths) {
    if (await pathExists(candidate)) {
      return { found: true, path: candidate };
    }
  }

  return { found: false };
}

/**
 * Per-platform display names used to build both the standard candidate
 * paths and the human-readable evidence value string. Casing intentionally
 * varies per platform to match each app's actual install conventions (e.g.
 * Cursor ships as `/Applications/Cursor.app` on macOS but installs to
 * `%LOCALAPPDATA%/Programs/cursor/` on Windows and `cursor.desktop` on
 * Linux).
 */
export interface AppBundleNames {
  /** macOS: `/Applications/{mac}.app` */
  readonly mac: string;
  /** Windows: `%LOCALAPPDATA%/Programs/{windows}/` and `%LOCALAPPDATA%/{windows}/` */
  readonly windows: string;
  /** Linux: `~/.local/share/applications/{linuxDesktop}.desktop` */
  readonly linuxDesktop: string;
  /** Linux: `~/Applications/{linuxAppImage}.AppImage` */
  readonly linuxAppImage: string;
}

/**
 * Builds the standard cross-platform candidate resolver for an app that
 * follows the conventional install locations (macOS `.app` bundle, Windows
 * `%LOCALAPPDATA%` install, Linux `.desktop`/`.AppImage`). Apps with
 * additional or non-standard candidates (e.g. Claude Code's macOS-only
 * native CLI wrapper) should call `checkAppBundle` directly with a custom
 * `AppBundlePlatformCandidates` instead of this helper.
 */
export function standardAppBundleCandidates(
  names: AppBundleNames,
): AppBundlePlatformCandidates {
  return {
    darwin: (): string[] => [`/Applications/${names.mac}.app`],
    win32: (): string[] | null => {
      const localAppData = process.env["LOCALAPPDATA"];
      if (!localAppData) {
        return null;
      }
      return [
        join(localAppData, "Programs", names.windows),
        join(localAppData, names.windows),
      ];
    },
    linux: (): string[] => {
      const home = homedir();
      return [
        join(home, ".local", "share", "applications", `${names.linuxDesktop}.desktop`),
        join(home, "Applications", `${names.linuxAppImage}.AppImage`),
      ];
    },
  };
}

/**
 * Builds the generic, platform-descriptive evidence value string for
 * detectors that report the class of candidate paths checked rather than
 * the specific resolved path (e.g. Codex, Cursor).
 */
export function standardAppBundleValue(names: AppBundleNames): string {
  switch (platform()) {
    case "darwin":
      return `/Applications/${names.mac}.app`;
    case "win32":
      return `%LOCALAPPDATA%/Programs/${names.windows}/`;
    case "linux":
      return `${names.linuxDesktop}.desktop / ${names.linuxAppImage}.AppImage`;
    default:
      return "unknown";
  }
}

export function appNameCandidates(appName: string): AppBundlePlatformCandidates {
  const lowerName = appName.toLowerCase();
  return {
    darwin: (): string[] => [
      `/Applications/${appName}.app`,
      join(homedir(), "Applications", `${appName}.app`),
    ],
    win32: (): string[] | null => {
      const localAppData = process.env["LOCALAPPDATA"];
      const programFiles = process.env["ProgramFiles"];
      const programFilesX86 = process.env["ProgramFiles(x86)"];
      const paths: string[] = [];

      if (localAppData) {
        paths.push(join(localAppData, "Programs", appName, `${appName}.exe`));
        paths.push(join(localAppData, "Programs", appName, `${lowerName}.exe`));
        paths.push(join(localAppData, appName, `${appName}.exe`));
      }
      if (programFiles) {
        paths.push(join(programFiles, appName, `${appName}.exe`));
      }
      if (programFilesX86) {
        paths.push(join(programFilesX86, appName, `${appName}.exe`));
      }

      return paths.length > 0 ? paths : null;
    },
    linux: (): string[] => {
      const home = homedir();
      return [
        `/usr/bin/${lowerName}`,
        `/usr/local/bin/${lowerName}`,
        join(home, ".local", "bin", lowerName),
        join(home, ".local", "share", "applications", `${lowerName}.desktop`),
        `/usr/share/applications/${lowerName}.desktop`,
        join(home, "Applications", `${appName}.AppImage`),
        join(home, ".local", "share", appName),
      ];
    },
  };
}
