import type { StandardsSource, EngineeringLock } from "../types/index";
import { SkillSource } from "../types/index";
import { IntegrityError } from "../utils/errors";
import { fetchRepositorySource } from "../skills/source-fetcher";

export function verifyClientSourceHashes(sources: StandardsSource[], lock: EngineeringLock): void {
  const lockedClients = lock.sources.client ?? [];
  const errors: string[] = [];

  for (const locked of lockedClients) {
    const source = sources.find((s) => s.type === SkillSource.Client && s.id === locked.id);
    if (!source) {
      errors.push(`Client source '${locked.id}' not found in resolved sources`);
      continue;
    }
    if (source.sha256 !== locked.sha256) {
      errors.push(`Client source '${locked.id}' SHA-256 mismatch: expected ${locked.sha256}, got ${source.sha256}`);
    }
  }

  if (errors.length > 0) {
    const detail = errors.map((e) => `  - ${e}`).join("\n");
    throw new IntegrityError(
      "Client source integrity verification failed. The locked client standards may have been tampered with.",
      detail,
    );
  }
}

export async function verifyRepositorySourceHashes(
  sources: StandardsSource[],
  lock: EngineeringLock,
  projectRoot: string,
): Promise<void> {
  const lockedRepos = lock.sources.repository ?? [];
  const errors: string[] = [];

  for (const locked of lockedRepos) {
    const source = sources.find((s) => s.type === SkillSource.Repository && s.id === locked.id);
    if (!source) {
      const repoConfig = { id: locked.id, path: locked.path };
      try {
        const fetched = await fetchRepositorySource(repoConfig, projectRoot);
        if (fetched.sha256 !== locked.sha256) {
          errors.push(`Repository source '${locked.id}' SHA-256 mismatch: expected ${locked.sha256}, got ${fetched.sha256}`);
        }
      } catch {
        errors.push(`Repository source '${locked.id}' not found and could not be re-fetched`);
      }
      continue;
    }
    if (source.sha256 !== locked.sha256) {
      errors.push(`Repository source '${locked.id}' SHA-256 mismatch: expected ${locked.sha256}, got ${source.sha256}`);
    }
  }

  if (errors.length > 0) {
    const detail = errors.map((e) => `  - ${e}`).join("\n");
    throw new IntegrityError(
      "Repository source integrity verification failed. The locked repository standards may have been tampered with.",
      detail,
    );
  }
}
