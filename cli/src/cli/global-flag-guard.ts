import type { Reporter } from "./reporter";

/**
 * Shared call-site guard for commands (init, sync) that support an optional
 * `--global` flag to operate on `~/.agents/AGENTS.md` instead of the
 * project-local configuration.
 *
 * `./global.js` is imported lazily so its dependency chain (global AGENTS.md
 * normalization) is only loaded when `--global` is actually used.
 *
 * Returns `true` when the `--global` flag was set and handling is complete
 * (the caller should return immediately), or `false` when the caller should
 * proceed with its normal project-local flow.
 */
export async function tryHandleGlobalFlagLazy(
  options: { global?: boolean; dryRun?: boolean; projectRoot?: string },
  reporter: Reporter,
): Promise<boolean> {
  if (!options.global) {
    return false;
  }

  const { tryHandleGlobalFlag } = await import("./global.js");
  return tryHandleGlobalFlag(options, reporter);
}
