import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";
import { AgentHarness } from "../types/index";
import type { Reporter } from "../cli/reporter";

export const HARDCODED_DEFAULT_HARNESSES: AgentHarness[] = [
  AgentHarness.Codex,
  AgentHarness.ClaudeCode,
  AgentHarness.OpenCode,
  AgentHarness.Kilo,
];

const VALID_HARNESSES = new Set<string>(Object.values(AgentHarness));

interface ParseHarnessResult {
  harnesses: AgentHarness[];
  warnings: string[];
}

function parseHarnessNames(raw: readonly string[]): ParseHarnessResult {
  const valid: AgentHarness[] = [];
  const warnings: string[] = [];
  for (const name of raw) {
    const trimmed = name.trim();
    if (trimmed.length === 0) continue;
    if (VALID_HARNESSES.has(trimmed)) {
      valid.push(trimmed as AgentHarness);
    } else {
      warnings.push(`Ignoring unknown harness name "${trimmed}"`);
    }
  }
  return { harnesses: valid, warnings };
}

function fromEnvVar(reporter: Reporter | undefined): AgentHarness[] | null {
  const raw = process.env["CODEFLEX_DEFAULT_HARNESSES"];
  if (raw === undefined || raw.trim().length === 0) return null;
  const result = parseHarnessNames(raw.split(","));
  for (const w of result.warnings) reporter?.warn(w);
  return result.harnesses.length > 0 ? result.harnesses : null;
}

interface OrgConfigYaml {
  defaultHarnesses?: unknown;
}

async function fromConfigFile(reporter: Reporter | undefined): Promise<AgentHarness[] | null> {
  const configPath = join(homedir(), ".codeflex-playbooks", "config.yaml");
  let content: string;
  try {
    content = await readFile(configPath, "utf-8");
  } catch {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = parse(content);
  } catch {
    return null;
  }

  if (parsed === null || typeof parsed !== "object") return null;
  const cfg = parsed as OrgConfigYaml;
  if (!Array.isArray(cfg.defaultHarnesses)) return null;

  const stringItems = cfg.defaultHarnesses.filter(
    (item): item is string => typeof item === "string",
  );
  const result = parseHarnessNames(stringItems);
  for (const w of result.warnings) reporter?.warn(w);
  return result.harnesses.length > 0 ? result.harnesses : null;
}

export async function getOrgDefaultHarnesses(reporter?: Reporter): Promise<AgentHarness[]> {
  const fromEnv = fromEnvVar(reporter);
  if (fromEnv !== null) return fromEnv;

  const fromFile = await fromConfigFile(reporter);
  if (fromFile !== null) return fromFile;

  return HARDCODED_DEFAULT_HARNESSES;
}
