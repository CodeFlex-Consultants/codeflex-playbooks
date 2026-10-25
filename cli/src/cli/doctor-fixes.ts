import type { EngineeringLock } from "../types/index";
import type { SkillDirectory } from "../skills/canonical-store";
import { safeBackupAndRemove } from "../utils/fs";
import { normalizeAgentsMd } from "../agents-md/normalizer";
import { errorMessage } from "../utils/errors";
import { BACKUP_SUFFIX } from "../constants";
import {
  DOCTOR_CHECK_ORPHANED_SKILLS,
  DOCTOR_CHECK_AGENTS_MD,
  findOrphanedSkills,
  type DiagnosticFinding,
} from "./doctor-checks";

export interface DoctorFixResult {
  check: string;
  success: boolean;
  message: string;
}

export interface FixContext {
  lock: EngineeringLock | null;
  canonicalStore: Map<string, SkillDirectory>;
}

export interface FixOptions {
  yes?: boolean;
}

export async function applyFix(projectRoot: string, finding: DiagnosticFinding, ctx: FixContext, options: FixOptions = {}): Promise<DoctorFixResult | null> {
  switch (finding.check) {
    case DOCTOR_CHECK_ORPHANED_SKILLS:
      return fixOrphanedSkills(ctx, options);
    case DOCTOR_CHECK_AGENTS_MD:
      return fixAgentsMd(projectRoot, ctx);
    default:
      return null;
  }
}

export async function fixOrphanedSkills(ctx: FixContext, options: FixOptions = {}): Promise<DoctorFixResult> {
  const { lock, canonicalStore } = ctx;
  if (!lock) {
    return { check: DOCTOR_CHECK_ORPHANED_SKILLS, success: false, message: "Cannot fix: lockfile not available" };
  }

  const orphaned = findOrphanedSkills(lock, canonicalStore);

  if (orphaned.length === 0) {
    return { check: DOCTOR_CHECK_ORPHANED_SKILLS, success: true, message: "No orphaned skills found" };
  }

  console.error(`\nThe following ${orphaned.length} skill(s) will be removed:`);
  for (const { id, dirPath } of orphaned) {
    console.error(`  - ${id} (${dirPath})`);
  }
  console.error("\nBackups will be created with .migrate-backup suffix.\n");

  const isNonInteractive = !process.stdin.isTTY;
  if (isNonInteractive && !options.yes) {
    return {
      check: DOCTOR_CHECK_ORPHANED_SKILLS,
      success: false,
      message: "Non-interactive environment detected. Pass --yes to confirm removal of orphaned skills.",
    };
  }

  const removed: string[] = [];
  const failed: string[] = [];

  for (const { id, dirPath } of orphaned) {
    const result = await safeBackupAndRemove(dirPath, BACKUP_SUFFIX);
    if (result.success) {
      removed.push(id);
    } else {
      failed.push(`${id} (${result.error})`);
    }
  }

  if (failed.length > 0 && removed.length === 0) {
    return {
      check: DOCTOR_CHECK_ORPHANED_SKILLS,
      success: false,
      message: `Failed to remove orphaned skills: ${failed.join(", ")}`,
    };
  }

  if (failed.length > 0) {
    return {
      check: DOCTOR_CHECK_ORPHANED_SKILLS,
      success: true,
      message: `Removed ${removed.length} orphaned skill director${removed.length === 1 ? "y" : "ies"}; failed: ${failed.join(", ")}`,
    };
  }

  return {
    check: DOCTOR_CHECK_ORPHANED_SKILLS,
    success: true,
    message: `Removed ${removed.length} orphaned skill director${removed.length === 1 ? "y" : "ies"}`,
  };
}

export async function fixAgentsMd(projectRoot: string, ctx: FixContext): Promise<DoctorFixResult> {
  const { lock } = ctx;
  if (!lock) {
    return { check: DOCTOR_CHECK_AGENTS_MD, success: false, message: "Cannot fix: lockfile not available" };
  }

  try {
    await normalizeAgentsMd({
      projectRoot,
      skillSlugs: lock.skills,
      crossCuttingSlugs: lock.crossCuttingSkills ?? [],
    });
    return { check: DOCTOR_CHECK_AGENTS_MD, success: true, message: "AGENTS.md managed section updated" };
  } catch (err) {
    return { check: DOCTOR_CHECK_AGENTS_MD, success: false, message: `Failed to update AGENTS.md: ${errorMessage(err)}` };
  }
}
