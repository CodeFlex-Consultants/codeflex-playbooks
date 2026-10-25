import { stat, rm, open } from "node:fs/promises";
import { dirname } from "node:path";
import { SourceFetchError } from "../utils/errors";
import { ensureDir } from "../utils/fs";

const CACHE_LOCK_STALE_MS = 5 * 60 * 1000;
const CACHE_LOCK_RETRY_INTERVAL_MS = 200;
const CACHE_LOCK_MAX_WAIT_MS = 30_000;

export async function acquireCacheLock(cacheDir: string): Promise<() => Promise<void>> {
  const lockPath = `${cacheDir}.lock`;
  await ensureDir(dirname(cacheDir));

  const deadline = Date.now() + CACHE_LOCK_MAX_WAIT_MS;

  for (;;) {
    try {
      const handle = await open(lockPath, "wx");
      await handle.close();
      return async () => {
        await rm(lockPath, { force: true }).catch(() => {});
      };
    } catch (err) {
      const code = err instanceof Error && "code" in err ? (err as NodeJS.ErrnoException).code : undefined;
      if (code !== "EEXIST") {
        throw err;
      }

      const staleLockRemoved = await removeIfStale(lockPath);
      if (staleLockRemoved) {
        continue;
      }

      if (Date.now() > deadline) {
        throw new SourceFetchError(
          `Timed out waiting for the CodeFlex Engineering Skills cache lock at ${lockPath}`,
          "Another codeflex-playbooks process may be updating the shared cache. If this persists after confirming no other codeflex-playbooks process is running, delete the .lock file and retry."
        );
      }

      await new Promise((resolve) => setTimeout(resolve, CACHE_LOCK_RETRY_INTERVAL_MS));
    }
  }
}

async function removeIfStale(lockPath: string): Promise<boolean> {
  let lockAgeMs: number;
  try {
    const lockStat = await stat(lockPath);
    lockAgeMs = Date.now() - lockStat.mtimeMs;
  } catch {
    return true;
  }

  if (lockAgeMs <= CACHE_LOCK_STALE_MS) {
    return false;
  }

  await rm(lockPath, { force: true }).catch(() => {});
  return true;
}
