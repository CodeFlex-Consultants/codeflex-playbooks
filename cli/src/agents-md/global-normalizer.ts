import { join } from "node:path";
import { MANAGED_SECTION_START, MANAGED_SECTION_END } from "./markers";
import { generateGlobalManagedSection } from "./global-section-generator";
import { globalAgentsMdPath, GLOBAL_AGENTS_DIR_NAME, GLOBAL_AGENTS_MD_FILENAME } from "./global-paths";
import { normalizeManagedSection } from "./section-normalizer";
import { normalizeFileContent } from "./normalize-file";

export interface NormalizeGlobalInput {
  dryRun?: boolean;
  crossCuttingSlugs?: string[];
  baseDir?: string;
}

export interface NormalizeGlobalResult {
  action: "created" | "updated" | "unchanged" | "deduplicated";
  path: string;
  previousContent?: string;
  newContent?: string;
}

/** Resolves global agents file path, using baseDir override when provided. */
function resolveGlobalAgentsPath(baseDir?: string): string {
  if (baseDir) {
    return join(baseDir, GLOBAL_AGENTS_DIR_NAME, GLOBAL_AGENTS_MD_FILENAME);
  }
  return globalAgentsMdPath();
}

export async function normalizeGlobalAgentsMd(input: NormalizeGlobalInput = {}): Promise<NormalizeGlobalResult> {
  const { dryRun = false, crossCuttingSlugs = [], baseDir } = input;
  const agentsPath = resolveGlobalAgentsPath(baseDir);
  const managedSection = generateGlobalManagedSection(crossCuttingSlugs);

  return normalizeFileContent(
    { filePath: agentsPath, managedSection, dryRun, ensureParentDir: true },
    {
      normalize: (content, section) => normalizeManagedSection(content, section, MANAGED_SECTION_START, MANAGED_SECTION_END),
    },
  );
}
