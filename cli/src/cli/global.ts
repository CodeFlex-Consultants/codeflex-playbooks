import { normalizeGlobalAgentsMd } from "../agents-md/global-normalizer";
import type { Reporter } from "./reporter";
import { consoleReporter } from "./reporter";
import { OutputStyle } from "../types/index";
import { formatHumanReadable } from "./output-formatter";
import type { OutputLine } from "./output-formatter";
import { loadLock } from "../config/index";

export interface RunGlobalOptions {
  dryRun?: boolean;
  reporter?: Reporter;
  projectRoot?: string;
  crossCuttingSlugs?: string[];
}

export async function runGlobal(options: RunGlobalOptions = {}): Promise<void> {
  const dryRun = options.dryRun ?? false;
  const reporter = options.reporter ?? consoleReporter;
  const crossCuttingSlugs = options.crossCuttingSlugs ?? await resolveCrossCuttingSlugs(options.projectRoot);

  if (dryRun) {
    reporter.info("Dry run - no changes made.");
    reporter.info("Would normalize ~/.agents/AGENTS.md");
    return;
  }

  reporter.info("Normalizing global ~/.agents/AGENTS.md...");
  const result = await normalizeGlobalAgentsMd({ crossCuttingSlugs });

  const lines: OutputLine[] = [
    { indent: 0, text: "Global AGENTS.md operation complete!", style: OutputStyle.Success },
    { indent: 0, text: "" },
    { indent: 1, text: `Action: ${result.action}` },
    { indent: 1, text: `Path: ${result.path}` },
  ];

  reporter.info(formatHumanReadable(lines));
}

async function resolveCrossCuttingSlugs(projectRoot?: string): Promise<string[]> {
  if (!projectRoot) return [];
  const lock = await loadLock(projectRoot);
  return lock?.crossCuttingSkills ?? [];
}

async function handleGlobalFlag(options: { dryRun?: boolean; projectRoot?: string }, reporter: Reporter): Promise<void> {
  await runGlobal({ dryRun: options.dryRun, reporter, projectRoot: options.projectRoot });
}

/**
 * Handles the shared `--global` flag for commands (init, sync) that can
 * optionally operate on the global `~/.agents/AGENTS.md` file instead of
 * the project-local configuration.
 *
 * Returns `true` when the `--global` flag was set and handling is complete
 * (the caller should return immediately), or `false` when the caller should
 * proceed with its normal project-local flow.
 */
export async function tryHandleGlobalFlag(
  options: { global?: boolean; dryRun?: boolean; projectRoot?: string },
  reporter: Reporter,
): Promise<boolean> {
  if (!options.global) {
    return false;
  }

  await handleGlobalFlag({ dryRun: options.dryRun, projectRoot: options.projectRoot }, reporter);
  return true;
}
