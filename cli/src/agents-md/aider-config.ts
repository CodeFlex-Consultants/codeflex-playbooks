import { join } from "node:path";
import { parse, stringify } from "yaml";
import { writeAtomic, safeReadFileWithLimit } from "../utils/fs";
import { AGENTS_MD_FILENAME } from "../constants";

/** Relative path to Aider's YAML configuration file, resolved from the project root. */
export const AIDER_CONF_FILENAME = ".aider.conf.yml";

export interface EnsureAiderReadsAgentsMdInput {
  projectRoot: string;
  dryRun?: boolean;
}

export interface EnsureAiderReadsAgentsMdResult {
  action: "created" | "updated" | "unchanged";
  path: string;
}

/**
 * Ensures Aider's `.aider.conf.yml` lists `AGENTS.md` under its `read:` key.
 *
 * Aider has no native bootstrap-file or rules-directory convention — unlike
 * Claude Code, Cursor, or Codex, it will never automatically discover an
 * instructions file. The only supported mechanism is the `read:` config
 * option in `.aider.conf.yml`, which adds the named file(s) as always-on
 * context. See https://aider.chat/docs/config/aider_conf.html and the
 * "How do I configure Aider?" entry at https://agents.md/.
 *
 * This function merges into any existing `.aider.conf.yml` rather than
 * overwriting it, preserving unrelated user settings.
 */
export async function ensureAiderReadsAgentsMd(
  input: EnsureAiderReadsAgentsMdInput,
): Promise<EnsureAiderReadsAgentsMdResult> {
  const { projectRoot, dryRun = false } = input;
  const filePath = join(projectRoot, AIDER_CONF_FILENAME);

  const existingContent = await safeReadFileWithLimit(filePath, AIDER_CONFIG_MAX_SIZE);
  const parsed = parseAiderConfig(existingContent);

  const readEntries = normalizeReadEntries(parsed["read"]);
  if (readEntries.includes(AGENTS_MD_FILENAME)) {
    return { action: "unchanged", path: filePath };
  }

  parsed["read"] = [...readEntries, AGENTS_MD_FILENAME];

  if (!dryRun) {
    await writeAtomic(filePath, stringify(parsed));
  }

  return { action: existingContent === null ? "created" : "updated", path: filePath };
}

const AIDER_CONFIG_MAX_SIZE = 256 * 1024;

/** Parses `.aider.conf.yml` content, tolerating a missing or empty file. */
function parseAiderConfig(content: string | null): Record<string, unknown> {
  if (!content || content.trim().length === 0) return {};
  const parsed: unknown = parse(content);
  return isPlainRecord(parsed) ? parsed : {};
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Normalizes Aider's `read` option (accepted as a scalar string or a list) into a string array. */
function normalizeReadEntries(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === "string");
  return [];
}
