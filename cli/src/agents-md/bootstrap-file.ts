import { join, dirname } from "node:path";
import type { AgentHarness } from "../types/index";
import { writeAtomic, safeReadFile, ensureDir, pathExists, safeBackupAndRemove } from "../utils/fs";
import { BACKUP_SUFFIX } from "../constants";
import { LEGACY_UNIVERSAL_MARKER } from "./markers";

export interface BootstrapFileInput {
  projectRoot: string;
  harnesses: AgentHarness[];
  dryRun?: boolean;
  removeLegacy?: boolean;
}

export interface BootstrapFileResult {
  action: "created" | "updated" | "unchanged" | "skipped";
  path: string;
}

export interface BootstrapFileConfig {
  relativePath: string;
  harnessName: AgentHarness;
  expectedContent: string;
  marker: string;
  ensureParentDir?: boolean;
}

export async function generateBootstrapFile(
  input: BootstrapFileInput,
  config: BootstrapFileConfig,
): Promise<BootstrapFileResult> {
  const { projectRoot, harnesses, dryRun = false } = input;
  const filePath = join(projectRoot, config.relativePath);

  if (!harnesses.includes(config.harnessName)) {
    return {
      action: "skipped",
      path: filePath,
    };
  }

  let content: string | undefined;
  const existing = await safeReadFile(filePath);
  if (existing !== null) {
    content = existing;
  }

  if (!content) {
    if (!dryRun) {
      if (config.ensureParentDir) {
        await ensureDir(dirname(filePath));
      }
      await writeAtomic(filePath, config.expectedContent);
    }

    return {
      action: "created",
      path: filePath,
    };
  }

  if (content.includes(config.marker)) {
    return {
      action: "unchanged",
      path: filePath,
    };
  }

  if (content.includes(LEGACY_UNIVERSAL_MARKER)) {
    const updated = content.replace(LEGACY_UNIVERSAL_MARKER, config.expectedContent.trim());
    if (!dryRun) {
      await writeAtomic(filePath, updated);
      console.error(`Updated bootstrap file '${config.relativePath}' to reference global ~/.agents/AGENTS.md`);
    }
    return {
      action: "updated",
      path: filePath,
    };
  }

  const newContent = config.expectedContent + content;

  if (!dryRun) {
    await writeAtomic(filePath, newContent);
  }

  return {
    action: "updated",
    path: filePath,
  };
}

export function createBootstrapGenerator(harness: AgentHarness) {
  return async function(input: BootstrapFileInput): Promise<BootstrapFileResult> {
    const { BOOTSTRAP_REGISTRY } = await import("./bootstrap-registry.js");
    const config = BOOTSTRAP_REGISTRY.find((e) => e.harness === harness)!;
    return generateBootstrapFile(input, config);
  };
}

export async function generateAllBootstrapFiles(
  input: BootstrapFileInput,
): Promise<BootstrapFileResult[]> {
  const { BOOTSTRAP_REGISTRY } = await import("./bootstrap-registry.js");
  const { HARNESS_REGISTRY } = await import("../projection/registry.js");
  const results: BootstrapFileResult[] = [];
  const processedLegacyPaths = new Set<string>();
  
  for (const config of BOOTSTRAP_REGISTRY) {
    const result = await generateBootstrapFile(input, config);
    results.push(result);

    if (result.action === "skipped" || input.dryRun) continue;

    const capability = HARNESS_REGISTRY[config.harnessName];
    if (!capability?.legacyBootstrapFiles) continue;

    for (const legacyPath of capability.legacyBootstrapFiles) {
      processedLegacyPaths.add(legacyPath);
      await handleLegacyBootstrapFile(input, legacyPath, config.relativePath);
    }
  }

  for (const [harnessName, capability] of Object.entries(HARNESS_REGISTRY)) {
    if (!capability.legacyBootstrapFiles) continue;
    if (BOOTSTRAP_REGISTRY.some((c) => c.harnessName === harnessName)) continue;

    for (const legacyPath of capability.legacyBootstrapFiles) {
      if (processedLegacyPaths.has(legacyPath)) continue;
      await handleLegacyBootstrapFile(input, legacyPath, capability.bootstrapFile);
    }
  }
  
  return results;
}

async function handleLegacyBootstrapFile(
  input: BootstrapFileInput,
  legacyPath: string,
  replacementPath: string,
): Promise<void> {
  const fullLegacyPath = join(input.projectRoot, legacyPath);
  if (!(await pathExists(fullLegacyPath))) return;

  if (!input.removeLegacy) {
    console.error(
      `Warning: Legacy bootstrap file '${legacyPath}' still exists and has been superseded by '${replacementPath}'. ` +
      `Some harnesses may still read the stale file. Run with --remove-legacy to back it up and remove it.`,
    );
    return;
  }

  const result = await safeBackupAndRemove(fullLegacyPath, BACKUP_SUFFIX);
  if (result.success) {
    console.error(`Legacy bootstrap file '${legacyPath}' backed up and removed (replaced by '${replacementPath}').`);
  } else {
    console.error(`Warning: Failed to backup ${legacyPath}: ${result.error}`);
  }
}
