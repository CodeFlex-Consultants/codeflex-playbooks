import type { Command } from "commander";
import { readdir, rm, lstat, realpath } from "node:fs/promises";
import { join, isAbsolute, relative } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { buildContext } from "./context";
import { loadConfig, loadLock } from "../config/index";
import { getScopedRulesDir, SCOPED_FILE_PREFIX } from "../projection/scoped-rules";
import { expandHomePath } from "../utils/fs";
import { ConfigValidationError, errorMessage } from "../utils/errors";
import { createReporterFromCommand, consoleReporter, type Reporter } from "./reporter";

export interface RunCleanOptions {
  dryRun?: boolean;
  yes?: boolean;
  reporter?: Reporter;
}

interface CleanInventory {
  managedSkillDirs: string[];
  scopedRuleFiles: string[];
}

function checkRelativeContainment(resolvedChild: string, resolvedParent: string): boolean {
  const rel = relative(resolvedParent, resolvedChild);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

export async function runClean(projectRoot: string, options: RunCleanOptions = {}): Promise<void> {
  const dryRun = options.dryRun ?? false;
  const yes = options.yes ?? false;
  const reporter = options.reporter ?? consoleReporter;

  const config = await loadConfig(projectRoot);
  if (!config) {
    throw new ConfigValidationError("Not initialized. Run 'codeflex-playbooks init' first.");
  }

  const lock = await loadLock(projectRoot);
  if (!lock) {
    throw new ConfigValidationError("Lock file not found. Run 'codeflex-playbooks sync' first.");
  }

  const inventory = await buildCleanInventory(projectRoot, lock, reporter);

  if (inventory.managedSkillDirs.length === 0 && inventory.scopedRuleFiles.length === 0) {
    reporter.info("Already clean. No managed skill directories or scoped rule files found.");
    return;
  }

  if (dryRun) {
    reportInventory(reporter, inventory, "Would remove");
    reporter.info("Dry run — no changes made.");
    return;
  }

  reportInventory(reporter, inventory, "About to remove");

  if (!yes) {
    if (!stdin.isTTY) {
      throw new Error("Use --yes to confirm in non-interactive environments.");
    }

    const confirmed = await promptConfirmation();
    if (!confirmed) {
      reporter.info("Cancelled.");
      return;
    }
  }

  await executeClean(inventory, reporter);
}

async function buildCleanInventory(projectRoot: string, lock: import("../types/index.js").EngineeringLock, reporter: Reporter): Promise<CleanInventory> {
  const projections = lock.projections ?? [];
  const managedProjections = lock.managedProjections ?? {};
  const resolvedProjectRoot = await realpath(projectRoot).catch(() => projectRoot);

  const expandedProjections = projections.map(p => ({
    original: p,
    expanded: expandHomePath(p.path, projectRoot),
  }));

  const projectionResolveResults = await Promise.allSettled(
    expandedProjections.map(p => realpath(p.expanded))
  );

  const candidateSkillDirs: string[] = [];
  const skillPathsToResolve: { path: string; projectionResolved: string }[] = [];

  for (let i = 0; i < expandedProjections.length; i++) {
    const projection = expandedProjections[i];
    const resolveResult = projectionResolveResults[i];
    if (!projection || !resolveResult) continue;

    const resolvedExpanded = resolveResult.status === "fulfilled"
      ? resolveResult.value
      : projection.expanded;

    if (!checkRelativeContainment(resolvedExpanded, resolvedProjectRoot)) {
      reporter.warn(`Skipping unsafe projection path: ${projection.original.path}`);
      continue;
    }

    const managedSkills = managedProjections[projection.original.path] ?? [];
    for (const skillId of managedSkills) {
      const skillDir = join(projection.expanded, skillId);
      skillPathsToResolve.push({ path: skillDir, projectionResolved: resolvedExpanded });
    }
  }

  const skillResolveResults = await Promise.allSettled(
    skillPathsToResolve.map(s => realpath(s.path))
  );

  for (let i = 0; i < skillPathsToResolve.length; i++) {
    const skillEntry = skillPathsToResolve[i];
    const resolveResult = skillResolveResults[i];
    if (!skillEntry || !resolveResult) continue;

    const resolvedSkillDir = resolveResult.status === "fulfilled"
      ? resolveResult.value
      : skillEntry.path;

    if (!checkRelativeContainment(resolvedSkillDir, skillEntry.projectionResolved)) {
      reporter.warn(`Skipping unsafe skill path: ${skillEntry.path}`);
      continue;
    }
    candidateSkillDirs.push(skillEntry.path);
  }

  const statResults = await Promise.allSettled(candidateSkillDirs.map(dir => lstat(dir)));
  const managedSkillDirs: string[] = [];
  for (let i = 0; i < statResults.length; i++) {
    const result = statResults[i];
    const skillDir = candidateSkillDirs[i];
    if (!result || !skillDir) continue;
    if (result.status === "rejected") continue;
    if (result.value.isSymbolicLink()) {
      reporter.warn(`Skipping symlink: ${skillDir}`);
      continue;
    }
    if (!result.value.isDirectory()) {
      reporter.warn(`Skipping non-directory at expected skill path: ${skillDir}`);
      continue;
    }
    managedSkillDirs.push(skillDir);
  }

  const harnesses = new Set(projections.flatMap(p => p.adapters));
  const harnessRulesDirs: { harness: string; rulesDir: string }[] = [];
  for (const harness of harnesses) {
    const rulesDirRel = getScopedRulesDir(harness);
    if (!rulesDirRel) continue;
    harnessRulesDirs.push({ harness, rulesDir: join(projectRoot, rulesDirRel) });
  }

  const dirStatResults = await Promise.allSettled(harnessRulesDirs.map(h => lstat(h.rulesDir)));
  const validRulesDirs: string[] = [];
  for (let i = 0; i < dirStatResults.length; i++) {
    const result = dirStatResults[i];
    const harnessDir = harnessRulesDirs[i];
    if (!result || !harnessDir) continue;
    if (result.status === "rejected") continue;
    if (result.value.isSymbolicLink()) {
      reporter.warn(`Skipping symlinked rules directory: ${harnessDir.rulesDir}`);
      continue;
    }
    if (!result.value.isDirectory()) {
      reporter.warn(`Skipping non-directory at expected rules path: ${harnessDir.rulesDir}`);
      continue;
    }
    validRulesDirs.push(harnessDir.rulesDir);
  }

  const readdirResults = await Promise.allSettled(validRulesDirs.map(dir => readdir(dir, { withFileTypes: true })));
  const scopedRuleFiles: string[] = [];
  for (let i = 0; i < readdirResults.length; i++) {
    const result = readdirResults[i];
    const rulesDir = validRulesDirs[i];
    if (!result || !rulesDir) continue;
    if (result.status === "rejected") continue;
    for (const entry of result.value) {
      if (!entry.name.startsWith(SCOPED_FILE_PREFIX)) continue;
      if (entry.isFile()) {
        scopedRuleFiles.push(join(rulesDir, entry.name));
      }
    }
  }

  return { managedSkillDirs, scopedRuleFiles };
}

function reportInventory(reporter: Reporter, inventory: CleanInventory, verb: string): void {
  const { managedSkillDirs, scopedRuleFiles } = inventory;

  reporter.info(
    `${verb} ${managedSkillDirs.length} managed skill director${managedSkillDirs.length === 1 ? "y" : "ies"} and ${scopedRuleFiles.length} scoped rule file${scopedRuleFiles.length === 1 ? "" : "s"}:`
  );

  if (managedSkillDirs.length > 0) {
    reporter.info("");
    reporter.info("  Managed skill directories:");
    for (const dir of managedSkillDirs) {
      reporter.info(`    ${dir}`);
    }
  }

  if (scopedRuleFiles.length > 0) {
    reporter.info("");
    reporter.info("  Scoped rule files:");
    for (const file of scopedRuleFiles) {
      reporter.info(`    ${file}`);
    }
  }

  reporter.info("");
}

async function promptConfirmation(): Promise<boolean> {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await rl.question("Continue? (y/N) ");
    const normalized = answer.trim().toLowerCase();
    return normalized === "y" || normalized === "yes";
  } finally {
    rl.close();
  }
}

async function executeClean(inventory: CleanInventory, reporter: Reporter): Promise<void> {
  const errors: string[] = [];

  const dirResults = await Promise.allSettled(
    inventory.managedSkillDirs.map(dir => rm(dir, { recursive: true, force: true }))
  );
  for (let i = 0; i < dirResults.length; i++) {
    const result = dirResults[i];
    const dir = inventory.managedSkillDirs[i];
    if (!result || !dir) continue;
    if (result.status === "rejected") {
      errors.push(`Failed to remove ${dir}: ${errorMessage(result.reason)}`);
    } else {
      reporter.info(`Removed directory: ${dir}`);
    }
  }

  const fileResults = await Promise.allSettled(
    inventory.scopedRuleFiles.map(file => rm(file, { force: true }))
  );
  for (let i = 0; i < fileResults.length; i++) {
    const result = fileResults[i];
    const file = inventory.scopedRuleFiles[i];
    if (!result || !file) continue;
    if (result.status === "rejected") {
      errors.push(`Failed to remove ${file}: ${errorMessage(result.reason)}`);
    } else {
      reporter.info(`Removed file: ${file}`);
    }
  }

  if (errors.length > 0) {
    reporter.warn("");
    reporter.warn(`${errors.length} error${errors.length === 1 ? "" : "s"} during cleanup:`);
    for (const err of errors) {
      reporter.warn(`  ${err}`);
    }
    throw new Error(`Cleanup completed with ${errors.length} error(s). Run 'codeflex-playbooks sync' to regenerate projections.`);
  }

  reporter.info("");
  reporter.info("Clean complete. Run 'codeflex-playbooks sync' to regenerate projections.");
}

export function registerCleanCommand(program: Command): void {
  program
    .command("clean")
    .description("Remove projected skill directories and scoped rule files")
    .option("--dry-run", "Show what would be removed without deleting")
    .option("--yes", "Skip confirmation prompt")
    .action(async (options: { dryRun?: boolean; yes?: boolean }, command: Command) => {
      const reporter = createReporterFromCommand(command);
      const context = await buildContext();
      await runClean(context.projectRoot, { ...options, reporter });
    });
}
