import { mkdir, writeFile, rename, readFile, access, readdir, stat, lstat, copyFile, chmod, open, cp, rm } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { homedir } from "node:os";
import { randomBytes } from "node:crypto";

export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

export async function writeAtomic(filePath: string, content: string): Promise<void> {
  const dir = dirname(filePath);
  await ensureDir(dir);
  const tmpPath = join(dir, `.${randomBytes(6).toString("hex")}.tmp`);
  await writeFile(tmpPath, content, "utf-8");
  await rename(tmpPath, filePath);
}

export async function safeReadFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf-8");
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw err;
  }
}

export async function copyDirectory(src: string, dest: string): Promise<void> {
  await mkdir(dest, { recursive: true });

  const entries = await readdir(src);

  for (const entry of entries) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);

    const s = await stat(srcPath);

    if (s.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else if (s.isFile()) {
      await copyFile(srcPath, destPath);
      await chmod(destPath, s.mode);
    }
  }
}

export function expandHomePath(path: string, projectRoot: string = process.cwd()): string {
  if (path.startsWith("~/")) {
    return join(homedir(), path.slice(2));
  }
  if (isAbsolute(path)) {
    return path;
  }
  return join(projectRoot, path);
}

const MAX_BACKUP_SUFFIX_ATTEMPTS = 1000;

/**
 * Finds a backup destination path that does not already exist, so a prior
 * backup is never silently overwritten. Falls back to `<base>.<n>` when the
 * base destination is already taken.
 */
async function findAvailableBackupDest(baseDest: string): Promise<string> {
  if (!(await pathExists(baseDest))) {
    return baseDest;
  }

  for (let attempt = 1; attempt <= MAX_BACKUP_SUFFIX_ATTEMPTS; attempt++) {
    const candidate = `${baseDest}.${attempt}`;
    if (!(await pathExists(candidate))) {
      return candidate;
    }
  }

  throw new Error(`Unable to find an available backup destination for: ${baseDest}`);
}

export async function backupPath(
  srcPath: string,
  backupSuffix: string,
  backups?: string[],
): Promise<string> {
  const srcStat = await lstat(srcPath);

  if (srcStat.isSymbolicLink()) {
    throw new Error(`Refusing to backup symlink: ${srcPath}`);
  }

  const backupDest = await findAvailableBackupDest(`${srcPath}${backupSuffix}`);

  const destStat = await lstat(backupDest).catch(() => null);
  if (destStat?.isSymbolicLink()) {
    throw new Error(`Refusing to write backup to symlink: ${backupDest}`);
  }

  if (srcStat.isDirectory()) {
    await cp(srcPath, backupDest, { recursive: true, force: false, errorOnExist: true });
  } else {
    await copyFile(srcPath, backupDest, fsConstants.COPYFILE_EXCL);
  }

  backups?.push(backupDest);
  return backupDest;
}

export interface SafeBackupAndRemoveResult {
  success: boolean;
  backupPath: string;
  error?: string;
}

export async function safeBackupAndRemove(
  srcPath: string,
  backupSuffix: string,
): Promise<SafeBackupAndRemoveResult> {
  try {
    const backupDest = await backupPath(srcPath, backupSuffix);
    const backupExists = await pathExists(backupDest);
    if (!backupExists) {
      return { success: false, backupPath: backupDest, error: "Backup verification failed" };
    }
    await rm(srcPath, { recursive: true, force: true });
    return { success: true, backupPath: backupDest };
  } catch (err) {
    return {
      success: false,
      backupPath: `${srcPath}${backupSuffix}`,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

const DEFAULT_MAX_SIZE = 1_048_576;

export class FileSizeLimitError extends Error {
  constructor(filePath: string, maxSize: number, actualSize: number) {
    super(`File ${filePath} exceeds size limit: ${actualSize} bytes > ${maxSize} bytes`);
    this.name = "FileSizeLimitError";
  }
}

export async function readFileWithLimit(
  filePath: string,
  maxSize: number = DEFAULT_MAX_SIZE
): Promise<string> {
  const handle = await open(filePath, "r");
  try {
    const stat = await handle.stat();
    if (stat.size > maxSize) {
      throw new FileSizeLimitError(filePath, maxSize, stat.size);
    }
    const buffer = Buffer.alloc(stat.size);
    await handle.read(buffer, 0, stat.size, 0);
    return buffer.toString("utf-8");
  } finally {
    await handle.close();
  }
}

export async function safeReadFileWithLimit(
  filePath: string,
  maxSize: number = DEFAULT_MAX_SIZE
): Promise<string | null> {
  try {
    return await readFileWithLimit(filePath, maxSize);
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    if (err instanceof FileSizeLimitError) {
      return null;
    }
    throw err;
  }
}
