import { join } from "node:path";
import { rm, cp } from "node:fs/promises";
import { saveConfig, codeflexDir } from "../config/index";
import type { EngineeringConfig } from "../types/index";
import { ConfigValidationError } from "../utils/errors";
import { pathExists, writeAtomic, backupPath } from "../utils/fs";
import type { Reporter } from "./reporter";
import { MigrationStepType, type MigrationPlan, type MigrationStep } from "./migration-strategies";
import { BACKUP_SUFFIX, CONFIG_FILENAME } from "../constants";

/**
 * Reverses a single applied migration step so a failed migration leaves state
 * untouched. Carries a human-readable `description` so a failed rollback can
 * be reported with enough detail for manual recovery.
 */
interface UndoStep {
  readonly description: string;
  readonly run: () => Promise<void>;
}

export async function executeMigration(
  projectRoot: string,
  plan: MigrationPlan,
  config: EngineeringConfig | null,
  reporter: Reporter,
): Promise<string[]> {
  const backups: string[] = [];
  const undoStack: UndoStep[] = [];
  let currentConfig = config;

  try {
    for (const step of plan.steps) {
      const result = await executeStep(projectRoot, step, backups, undoStack, reporter, currentConfig);
      if (step.type === MigrationStepType.UpdateConfig && result) {
        currentConfig = result;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    reporter.error(`Migration failed: ${message}`);
    const failedRollbackSteps = await rollback(undoStack, reporter);

    if (failedRollbackSteps.length > 0) {
      reporter.error(`Manual cleanup is required for ${failedRollbackSteps.length} item(s):`);
      for (const failure of failedRollbackSteps) {
        reporter.error(`  - ${failure}`);
      }
      throw new ConfigValidationError(
        `Migration failed and rollback was incomplete (${failedRollbackSteps.length} item(s) require manual cleanup): ${message}`,
      );
    }

    throw new ConfigValidationError(`Migration failed and was rolled back: ${message}`);
  }

  return backups;
}

/**
 * Undoes already-applied steps in reverse order so a partial failure never
 * leaves mixed state. Returns a description of every rollback step that
 * itself failed, so the caller can report exactly what needs manual cleanup
 * instead of a generic warning.
 */
async function rollback(undoStack: UndoStep[], reporter: Reporter): Promise<string[]> {
  if (undoStack.length === 0) return [];

  reporter.info(`Rolling back ${undoStack.length} applied step(s)...`);
  const failures: string[] = [];
  for (const step of undoStack.reverse()) {
    try {
      await step.run();
    } catch (undoErr) {
      const undoMessage = undoErr instanceof Error ? undoErr.message : String(undoErr);
      const failure = `${step.description}: ${undoMessage}`;
      reporter.error(`  Rollback step failed: ${failure}`);
      failures.push(failure);
    }
  }
  return failures;
}

async function executeStep(
  projectRoot: string,
  step: MigrationStep,
  backups: string[],
  undoStack: UndoStep[],
  reporter: Reporter,
  config: EngineeringConfig | null,
): Promise<EngineeringConfig | null> {
  switch (step.type) {
    case MigrationStepType.UpdateConfig:
      return executeConfigUpdate(projectRoot, step, backups, undoStack, reporter, config);
    case MigrationStepType.CreateFile:
      await executeCreateFile(projectRoot, step, backups, undoStack, reporter);
      return config;
    case MigrationStepType.RemoveFile:
      await executeRemoveFile(projectRoot, step, backups, undoStack, reporter);
      return config;
    case MigrationStepType.ModifyFile:
      await executeModifyFile(projectRoot, step, backups, undoStack, reporter);
      return config;
  }
}

async function executeConfigUpdate(
  projectRoot: string,
  step: MigrationStep,
  backups: string[],
  undoStack: UndoStep[],
  reporter: Reporter,
  config: EngineeringConfig | null,
): Promise<EngineeringConfig> {
  if (!config) {
    throw new ConfigValidationError("Cannot update config: not initialized.");
  }

  const configPath = join(codeflexDir(projectRoot), CONFIG_FILENAME);
  const backupDest = await backupFile(configPath, backups);
  undoStack.push({
    description: `restore ${CONFIG_FILENAME} from backup`,
    run: () => restoreFromBackup(configPath, backupDest),
  });

  const updatedConfig = { ...config, ...step.configUpdate };
  await saveConfig(projectRoot, updatedConfig);
  reporter.info(`  ${step.description} (backed up to ${CONFIG_FILENAME}${BACKUP_SUFFIX})`);
  return updatedConfig;
}

async function executeCreateFile(
  projectRoot: string,
  step: MigrationStep,
  backups: string[],
  undoStack: UndoStep[],
  reporter: Reporter,
): Promise<void> {
  if (!step.path || step.content === undefined) return;

  const fullPath = join(projectRoot, step.path);
  const alreadyExisted = await pathExists(fullPath);
  if (alreadyExisted) {
    const backupDest = await backupWithVerification(fullPath, step.path, backups, reporter, "write");
    if (!backupDest) return;
    undoStack.push({
      description: `restore ${step.path} from backup`,
      run: () => restoreFromBackup(fullPath, backupDest),
    });
  } else {
    undoStack.push({
      description: `remove newly created ${step.path}`,
      run: () => rm(fullPath, { recursive: true, force: true }),
    });
  }
  await writeAtomic(fullPath, step.content);
  reporter.info(`  ${step.description}`);
}

async function executeRemoveFile(
  projectRoot: string,
  step: MigrationStep,
  backups: string[],
  undoStack: UndoStep[],
  reporter: Reporter,
): Promise<void> {
  if (!step.path) return;

  const fullPath = join(projectRoot, step.path);
  const exists = await pathExists(fullPath);
  if (!exists) return;

  const backupDest = await backupWithVerification(fullPath, step.path, backups, reporter, "deletion");
  if (!backupDest) return;

  undoStack.push({
    description: `restore removed ${step.path} from backup`,
    run: () => restoreFromBackup(fullPath, backupDest),
  });
  await rm(fullPath, { recursive: true, force: true });
  reporter.info(`  ${step.description} (backed up to ${step.path}${BACKUP_SUFFIX})`);
}

async function executeModifyFile(
  projectRoot: string,
  step: MigrationStep,
  backups: string[],
  undoStack: UndoStep[],
  reporter: Reporter,
): Promise<void> {
  if (!step.path || step.content === undefined) return;

  const fullPath = join(projectRoot, step.path);
  const exists = await pathExists(fullPath);
  if (!exists) return;

  const backupDest = await backupWithVerification(fullPath, step.path, backups, reporter, "modification");
  if (!backupDest) return;
  undoStack.push({
    description: `restore modified ${step.path} from backup`,
    run: () => restoreFromBackup(fullPath, backupDest),
  });

  await writeAtomic(fullPath, step.content);
  reporter.info(`  ${step.description} (backed up to ${step.path}${BACKUP_SUFFIX})`);
}

async function backupFile(fullPath: string, backups: string[]): Promise<string> {
  return await backupPath(fullPath, BACKUP_SUFFIX, backups);
}

/**
 * Backs up `fullPath` and verifies the backup actually landed on disk before
 * the caller mutates or removes the original. Returns the backup destination
 * path, or `null` when verification failed — in which case the caller must
 * skip its mutation rather than risk an unrecoverable change. Consolidates
 * the backup-then-verify-then-warn flow shared by create/remove/modify steps.
 */
async function backupWithVerification(
  fullPath: string,
  stepPath: string,
  backups: string[],
  reporter: Reporter,
  actionLabel: string,
): Promise<string | null> {
  const backupDest = await backupFile(fullPath, backups);
  const backupExists = await pathExists(backupDest);
  if (!backupExists) {
    reporter.info(`  Warning: Backup creation failed for ${stepPath}, skipping ${actionLabel}`);
    return null;
  }
  return backupDest;
}

/** Restores an original path from its backup copy, undoing a single applied migration step. */
async function restoreFromBackup(originalPath: string, backupDest: string): Promise<void> {
  await cp(backupDest, originalPath, { recursive: true, force: true });
}
