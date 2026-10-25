import { join } from "node:path";
import { MANAGED_SECTION_START, MANAGED_SECTION_END } from "./markers";
import { generateManagedSection } from "./section-generator";
import { normalizeManagedSection, SECTION_SEPARATOR } from "./section-normalizer";
import { AGENTS_MD_FILENAME } from "../constants";
import { normalizeFileContent } from "./normalize-file";

const LEGACY_SECTION_HEADING = /^## CodeFlex Engineering Standards\s*$/m;

/** Input parameters for normalizing the AGENTS.md managed section. */
export interface NormalizeInput {
  /** Absolute path to the project root. */
  projectRoot: string;
  /** If true, compute the result without writing to disk. */
  dryRun?: boolean;
  /** Resolved skill slugs for this project. */
  skillSlugs?: string[];
  /** Skill slugs that are cross-cutting (apply to every task regardless of technology). */
  crossCuttingSlugs?: string[];
}

/** Result of an AGENTS.md normalization operation. */
export interface NormalizeResult {
  /** What action was taken: created (new file), updated (section replaced), unchanged, or deduplicated (multiple sections merged). */
  action: "created" | "updated" | "unchanged" | "deduplicated";
  /** Absolute path to the AGENTS.md file. */
  path: string;
  /** File content before the operation (absent for "created"). */
  previousContent?: string;
  /** File content after the operation (absent for "unchanged"). */
  newContent?: string;
}

/**
 * Ensures `AGENTS.md` contains exactly one up-to-date CodeFlex Engineering Standards managed section.
 *
 * Handles four cases:
 * - File doesn't exist: creates it with the managed section
 * - File exists with an outdated managed section: replaces it in place
 * - File exists with duplicate managed sections: deduplicates to a single section
 * - File exists without a managed section: appends it
 *
 * Also migrates legacy `## CodeFlex Engineering Standards` headings to the marker-based format.
 *
 * @param input - Normalization parameters including project root and dry-run flag
 * @returns Result describing the action taken and file content changes
 */
export async function normalizeAgentsMd(input: NormalizeInput): Promise<NormalizeResult> {
  const { projectRoot, dryRun = false, skillSlugs = [], crossCuttingSlugs = [] } = input;
  const agentsPath = join(projectRoot, AGENTS_MD_FILENAME);
  const managedSection = generateManagedSection(skillSlugs, crossCuttingSlugs);

  const result = await normalizeFileContent(
    { filePath: agentsPath, managedSection, dryRun },
    {
      normalize: (content, section) => {
        const hasMarkers = content.includes(MANAGED_SECTION_START);
        if (hasMarkers) {
          return normalizeManagedSection(content, section, MANAGED_SECTION_START, MANAGED_SECTION_END);
        }
        const migrated = migrateLegacySection(content, section);
        if (migrated) {
          return { action: "updated" as const, result: migrated.newContent };
        }
        return normalizeManagedSection(content, section, MANAGED_SECTION_START, MANAGED_SECTION_END);
      },
    },
  );

  return result;
}

/**
 * Migrates a legacy `## CodeFlex Engineering Standards` heading (without markers) to the
 * marker-based managed section format. Returns null if no legacy heading is found.
 */
function migrateLegacySection(
  content: string,
  managedSection: string,
): { newContent: string } | null {
  const legacyMatch = content.match(LEGACY_SECTION_HEADING);
  if (!legacyMatch || legacyMatch.index === undefined) {
    return null;
  }

  const legacyStart = legacyMatch.index;
  const afterHeading = content.substring(legacyStart + legacyMatch[0].length);
  const nextHeadingMatch = afterHeading.match(/^## /m);

  const legacyEnd = nextHeadingMatch?.index !== undefined
    ? legacyStart + legacyMatch[0].length + nextHeadingMatch.index
    : content.length;

  const before = content.substring(0, legacyStart);
  const after = content.substring(legacyEnd);
  const newContent = managedSection + SECTION_SEPARATOR + before.trimStart() + after;

  return { newContent };
}

/**
 * Checks if the content contains the expected managed section.
 * Used by diff/doctor/check commands to determine if AGENTS.md is current.
 */
export function isManagedSectionCurrent(content: string, expectedSection: string): boolean {
  return content.includes(expectedSection);
}
