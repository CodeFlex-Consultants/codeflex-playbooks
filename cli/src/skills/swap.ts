import { rename, rm } from "node:fs/promises";
import { pathExists } from "../utils/fs";

/**
 * Atomically replaces a target directory with a temp directory using rename-based swap.
 *
 * Backs up the existing target, renames temp into place, then removes the backup.
 * On failure, restores the backup to ensure the target is never left in a partial state.
 *
 * @param tempDir - Path to the prepared temporary directory
 * @param targetDir - Path to the target directory to replace
 * @throws If the rename operations fail and backup restoration also fails
 */
export async function swapDirectory(
  tempDir: string,
  targetDir: string
): Promise<void> {
  const backupDir = `${targetDir}.bak`;

  try {
    if (await pathExists(targetDir)) {
      await rename(targetDir, backupDir);
    }

    await rename(tempDir, targetDir);

    if (await pathExists(backupDir)) {
      await rm(backupDir, { recursive: true, force: true });
    }
  } catch (err) {
    const targetExists = await pathExists(targetDir);
    const backupExists = await pathExists(backupDir);

    if (backupExists && !targetExists) {
      await rename(backupDir, targetDir);
    } else if (backupExists && targetExists) {
      await rm(targetDir, { recursive: true, force: true });
      await rename(backupDir, targetDir);
    }

    throw err;
  }
}
