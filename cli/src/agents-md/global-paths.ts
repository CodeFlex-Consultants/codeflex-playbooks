import { join } from "node:path";
import { homedir } from "node:os";

export const GLOBAL_AGENTS_DIR_NAME = ".agents";
export const GLOBAL_AGENTS_MD_FILENAME = "AGENTS.md";
export const GLOBAL_SKILLS_DIR_NAME = "skills";

export function globalAgentsDirPath(): string {
  return join(homedir(), GLOBAL_AGENTS_DIR_NAME);
}

export function globalAgentsMdPath(): string {
  return join(globalAgentsDirPath(), GLOBAL_AGENTS_MD_FILENAME);
}

