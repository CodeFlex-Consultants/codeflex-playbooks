import { resolve } from "node:path";
import type { CommandContext } from "../types/index";

export interface BuildContextOptions {
  dryRun?: boolean;
  verbose?: boolean;
  quiet?: boolean;
  projectRoot?: string;
}

export async function buildContext(options: BuildContextOptions = {}): Promise<CommandContext> {
  const projectRoot = options.projectRoot ? resolve(options.projectRoot) : process.cwd();

  return {
    projectRoot,
    dryRun: options.dryRun ?? false,
    diagnostics: [],
  };
}
