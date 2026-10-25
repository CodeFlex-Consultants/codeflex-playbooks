import { parse, stringify } from "yaml";
import { join } from "node:path";
import type { EngineeringConfig, EngineeringLock, DetectionResult } from "../types/index";
import { AgentHarness } from "../types/index";
import type { HarnessDetectionResult } from "../detection/harness/types";
import { engineeringConfigSchema, engineeringLockSchema } from "../types/schemas";
import { writeAtomic, safeReadFile, ensureDir } from "../utils/fs";
import { ConfigValidationError } from "../utils/errors";
import { parseYamlWithSchema, validateWithSchema } from "../utils/yaml";
import { HARDCODED_DEFAULT_HARNESSES } from "./org-defaults";
import { filterHighMediumHarnesses } from "./harness-detection";
import { CONFIG_FILENAME, LOCKFILE_FILENAME } from "../constants";

export { filterHighMediumHarnesses, mergeDetectedHarnesses } from "./harness-detection";
export type { HarnessMergeResult } from "./harness-detection";

const CONFIG_HEADER = "# CodeFlex Engineering Standards configuration — managed by codeflex-playbooks CLI\n";
const LOCK_HEADER = "# CodeFlex Engineering Standards lockfile — do not edit manually\n";

/**
 * Returns the path to the `.codeflex` state directory for a project.
 * @param projectRoot - Absolute path to the project root
 */
export function codeflexDir(projectRoot: string): string {
  return join(projectRoot, ".codeflex");
}

/**
 * Returns the path to the canonical skill store (`.codeflex/skills/`) for a project.
 * @param projectRoot - Absolute path to the project root
 */
export function skillsDir(projectRoot: string): string {
  return join(codeflexDir(projectRoot), "skills");
}

const MAX_SUPPORTED_VERSION = 1;

function migrateConfig(raw: unknown): EngineeringConfig {
  const rawObj = raw as Record<string, unknown> | null;
  const version = rawObj?.version;

  if (version === undefined || version === null) {
    throw new ConfigValidationError("Missing version field in engineering.yaml");
  }

  if (typeof version === "number" && version > MAX_SUPPORTED_VERSION) {
    throw new ConfigValidationError(
      `Unsupported config version: ${version}. Maximum supported version is ${MAX_SUPPORTED_VERSION}. Please upgrade codeflex-playbooks CLI.`
    );
  }

  if (typeof version === "number" && version < 1) {
    throw new ConfigValidationError(`Unsupported config version: ${version}. Minimum supported version is 1.`);
  }

  return validateWithSchema(raw, engineeringConfigSchema, "Invalid engineering.yaml");
}

/**
 * Loads and validates the engineering configuration from `.codeflex/engineering.yaml`.
 *
 * @param projectRoot - Absolute path to the project root
 * @returns Parsed configuration, or null if the file doesn't exist
 * @throws {ConfigValidationError} If the config has an unsupported version or fails schema validation
 */
export async function loadConfig(projectRoot: string): Promise<EngineeringConfig | null> {
  const content = await safeReadFile(join(codeflexDir(projectRoot), CONFIG_FILENAME));
  if (content === null) {
    return null;
  }
  const parsed: unknown = parse(content);
  return migrateConfig(parsed);
}

/**
 * Saves the engineering configuration to `.codeflex/engineering.yaml` with an atomic write.
 *
 * @param projectRoot - Absolute path to the project root
 * @param config - Configuration to serialize and write
 */
export async function saveConfig(projectRoot: string, config: EngineeringConfig): Promise<void> {
  await ensureDir(codeflexDir(projectRoot));
  const yamlContent = stringify(config, { indent: 2 });
  await writeAtomic(join(codeflexDir(projectRoot), CONFIG_FILENAME), CONFIG_HEADER + yamlContent);
}

/**
 * Loads and validates the engineering lockfile from `.codeflex/engineering.lock`.
 *
 * @param projectRoot - Absolute path to the project root
 * @returns Parsed lockfile, or null if the file doesn't exist
 * @throws {ConfigValidationError} If the lockfile fails schema validation
 */
export async function loadLock(projectRoot: string): Promise<EngineeringLock | null> {
  const content = await safeReadFile(join(codeflexDir(projectRoot), LOCKFILE_FILENAME));
  if (content === null) {
    return null;
  }
  return parseYamlWithSchema(content, engineeringLockSchema, "Invalid engineering.lock");
}

/**
 * Saves the engineering lockfile to `.codeflex/engineering.lock` with an atomic write.
 *
 * @param projectRoot - Absolute path to the project root
 * @param lock - Lockfile to serialize and write
 */
export async function saveLock(projectRoot: string, lock: EngineeringLock): Promise<void> {
  await ensureDir(codeflexDir(projectRoot));
  const yamlContent = stringify(lock, { indent: 2 });
  await writeAtomic(join(codeflexDir(projectRoot), LOCKFILE_FILENAME), LOCK_HEADER + yamlContent);
}

/**
 * Creates a default engineering configuration based on project detection results.
 *
 * Uses detected harnesses (or org defaults / hardcoded defaults) and initialises scopes
 * from the detection result.
 *
 * @param detection - Project detection result providing initial scopes
 * @param harnessResults - Optional harness detection results to determine configured agent harnesses
 * @param orgDefaults - Optional organisation-level default harnesses (overrides hardcoded defaults)
 * @returns A new configuration with version 1, auto-detect enabled, and detected harnesses
 */
export function createDefaultConfig(
  detection: DetectionResult,
  harnessResults?: readonly HarnessDetectionResult[],
  orgDefaults?: AgentHarness[],
): EngineeringConfig {
  const agentHarnesses = resolveHarnesses(harnessResults, orgDefaults);

  return {
    version: 1,
    autoDetect: true,
    agentHarnesses,
    standards: {
      codeflex: {
        enabled: true,
      },
    },
    include: [],
    exclude: [],
    scopes: { ...detection.scopes },
    exceptions: [],
  };
}

function resolveHarnesses(
  harnessResults: readonly HarnessDetectionResult[] | undefined,
  orgDefaults: AgentHarness[] | undefined,
): AgentHarness[] {
  const defaults = orgDefaults ?? HARDCODED_DEFAULT_HARNESSES;

  if (!harnessResults || harnessResults.length === 0) {
    return defaults;
  }

  const detected = filterHighMediumHarnesses(harnessResults);

  return detected.length > 0 ? detected : defaults;
}
