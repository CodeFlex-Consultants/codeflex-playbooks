import { join } from "node:path";
import { stat } from "node:fs/promises";
import { loadConfig, loadLock, codeflexDir, skillsDir } from "../config/index";
import type { EngineeringConfig, EngineeringLock } from "../types/index";
import { verifyLockfileConsistency } from "../integrity/lockfile-verifier";
import { verifyProjection } from "../integrity/projection-verifier";
import { readCanonicalStore, type SkillDirectory } from "../skills/canonical-store";
import { pathExists } from "../utils/fs";
import { findMissingSkills, getAllLockedSkills, validateAgentsMd, validateBootstrapFiles } from "./validation-helpers";
import { errorMessage } from "../utils/errors";
import { globalAgentsMdPath, globalAgentsDirPath } from "../agents-md/global-paths";
import { checkDeprecations, formatDeprecationsClassified } from "../deprecation/index";
import { AGENTS_MD_FILENAME, CLI_NAME } from "../constants";

export const DOCTOR_CHECK_CODEFLEX_DIR = "codeflex-directory";
export const DOCTOR_CHECK_CONFIG = "engineering-config";
export const DOCTOR_CHECK_LOCKFILE = "lockfile";
export const DOCTOR_CHECK_SKILLS_DIR = "skills-directory";
export const DOCTOR_CHECK_ORPHANED_SKILLS = "orphaned-skills";
export const DOCTOR_CHECK_MISSING_SKILLS = "missing-skills";
export const DOCTOR_CHECK_AGENTS_MD = "agents-md";
export const DOCTOR_CHECK_BOOTSTRAP_FILES = "bootstrap-files";
export const DOCTOR_CHECK_PROJECTIONS = "projections";
export const DOCTOR_CHECK_GLOBAL_AGENTS_MD = "global-agents-md";
export const DOCTOR_CHECK_DEPRECATED = "deprecated-config";

export type DoctorSeverity = "error" | "warning" | "info";

export interface DiagnosticFinding {
  check: string;
  severity: DoctorSeverity;
  message: string;
  fixable: boolean;
  fixDescription?: string;
}

export interface DoctorCheckContext {
  projectRoot: string;
  config: EngineeringConfig | null;
  lock: EngineeringLock | null;
  canonicalStore: Map<string, SkillDirectory>;
}

export async function loadDoctorCheckContext(projectRoot: string): Promise<DoctorCheckContext> {
  const config = await loadConfig(projectRoot);
  const lock = await loadLock(projectRoot);
  const canonicalStore = await readCanonicalStore(projectRoot);
  return { projectRoot, config, lock, canonicalStore };
}

export async function runAllDoctorChecks(ctx: DoctorCheckContext): Promise<DiagnosticFinding[]> {
  const { projectRoot, config, lock, canonicalStore } = ctx;
  const findings: DiagnosticFinding[] = [];

  await Promise.all([
    checkCodeFlexDirectory(projectRoot, findings),
    checkEngineeringConfig(findings, config),
    checkLockfile(findings, config, lock),
    checkSkillsDirectory(projectRoot, findings),
    checkOrphanedSkills(findings, lock, canonicalStore),
    checkMissingSkills(findings, lock, canonicalStore),
    checkAgentsMd(projectRoot, findings, lock),
    checkBootstrapFiles(projectRoot, findings, config),
    checkProjections(projectRoot, findings, lock),
    checkGlobalAgentsMd(findings),
    checkDeprecatedConfig(projectRoot, findings),
  ]);

  return findings;
}

export async function checkCodeFlexDirectory(projectRoot: string, findings: DiagnosticFinding[]): Promise<void> {
  const dirPath = codeflexDir(projectRoot);
  const exists = await pathExists(dirPath);

  if (!exists) {
    findings.push({
      check: DOCTOR_CHECK_CODEFLEX_DIR,
      severity: "error",
      message: ".codeflex/ directory does not exist",
      fixable: false,
      fixDescription: "Run 'codeflex-playbooks init' to initialize",
    });
    return;
  }

  let dirStat;
  try {
    dirStat = await stat(dirPath);
  } catch (err) {
    findings.push({
      check: DOCTOR_CHECK_CODEFLEX_DIR,
      severity: "error",
      message: `.codeflex/ directory is not accessible: ${errorMessage(err)}`,
      fixable: false,
    });
    return;
  }

  if (!dirStat.isDirectory()) {
    findings.push({
      check: DOCTOR_CHECK_CODEFLEX_DIR,
      severity: "error",
      message: ".codeflex exists but is not a directory",
      fixable: false,
    });
  }
}

export async function checkEngineeringConfig(findings: DiagnosticFinding[], config: EngineeringConfig | null): Promise<void> {
  if (!config) {
    findings.push({
      check: DOCTOR_CHECK_CONFIG,
      severity: "error",
      message: ".codeflex/engineering.yaml does not exist or is invalid",
      fixable: false,
      fixDescription: "Run 'codeflex-playbooks init' to initialize",
    });
  }
}

export async function checkLockfile(
  findings: DiagnosticFinding[],
  config: EngineeringConfig | null,
  lock: EngineeringLock | null,
): Promise<void> {
  if (!lock) {
    findings.push({
      check: DOCTOR_CHECK_LOCKFILE,
      severity: "error",
      message: ".codeflex/engineering.lock does not exist or is invalid",
      fixable: false,
      fixDescription: "Run 'codeflex-playbooks sync' to generate",
    });
    return;
  }

  if (config) {
    const consistency = await verifyLockfileConsistency(config, lock);
    if (!consistency.consistent) {
      for (const error of consistency.errors) {
        findings.push({
          check: DOCTOR_CHECK_LOCKFILE,
          severity: "error",
          message: `Lockfile inconsistency: ${error}`,
          fixable: false,
          fixDescription: "Run 'codeflex-playbooks sync' to fix",
        });
      }
    }
    for (const warning of consistency.warnings) {
      findings.push({
        check: DOCTOR_CHECK_LOCKFILE,
        severity: "warning",
        message: `Lockfile warning: ${warning}`,
        fixable: false,
      });
    }
  }
}

export async function checkSkillsDirectory(projectRoot: string, findings: DiagnosticFinding[]): Promise<void> {
  const dirPath = skillsDir(projectRoot);
  const exists = await pathExists(dirPath);

  if (!exists) {
    findings.push({
      check: DOCTOR_CHECK_SKILLS_DIR,
      severity: "error",
      message: ".codeflex/skills/ directory does not exist",
      fixable: false,
      fixDescription: "Run 'codeflex-playbooks sync' to populate",
    });
  }
}

export interface OrphanedSkill {
  id: string;
  dirPath: string;
}

export function findOrphanedSkills(
  lock: EngineeringLock,
  canonicalStore: Map<string, SkillDirectory>,
): OrphanedSkill[] {
  const lockedSkills = new Set(getAllLockedSkills(lock));
  const orphaned: OrphanedSkill[] = [];

  for (const [skillId, skillDir] of canonicalStore) {
    if (!lockedSkills.has(skillId)) {
      orphaned.push({ id: skillId, dirPath: skillDir.dirPath });
    }
  }

  return orphaned;
}

export async function checkOrphanedSkills(
  findings: DiagnosticFinding[],
  lock: EngineeringLock | null,
  canonicalStore: Map<string, SkillDirectory>,
): Promise<void> {
  if (!lock) return;

  const orphaned = findOrphanedSkills(lock, canonicalStore);

  if (orphaned.length > 0) {
    const orphanedIds = orphaned.map((o) => o.id);
    findings.push({
      check: DOCTOR_CHECK_ORPHANED_SKILLS,
      severity: "warning",
      message: `Orphaned skills in .codeflex/skills/ not in lockfile: ${orphanedIds.join(", ")}`,
      fixable: true,
      fixDescription: `Remove ${orphaned.length} orphaned skill director${orphaned.length === 1 ? "y" : "ies"}`,
    });
  }
}

export async function checkMissingSkills(
  findings: DiagnosticFinding[],
  lock: EngineeringLock | null,
  canonicalStore: Map<string, SkillDirectory>,
): Promise<void> {
  if (!lock) return;

  const missing = findMissingSkills(lock, canonicalStore);

  if (missing.length > 0) {
    findings.push({
      check: DOCTOR_CHECK_MISSING_SKILLS,
      severity: "error",
      message: `Skills in lockfile not installed: ${missing.join(", ")}`,
      fixable: false,
      fixDescription: "Run 'codeflex-playbooks sync' to re-sync missing skills",
    });
  }
}

export async function checkAgentsMd(projectRoot: string, findings: DiagnosticFinding[], lock: EngineeringLock | null): Promise<void> {
  if (!lock) {
    const agentsMdPath = join(projectRoot, AGENTS_MD_FILENAME);
    const exists = await pathExists(agentsMdPath);
    if (!exists) {
      findings.push({
        check: DOCTOR_CHECK_AGENTS_MD,
        severity: "error",
        message: "AGENTS.md does not exist",
        fixable: false,
        fixDescription: `Run '${CLI_NAME} sync' first, then doctor --fix`,
      });
    }
    return;
  }

  const validation = await validateAgentsMd(projectRoot, lock);

  if (!validation.exists) {
    findings.push({
      check: DOCTOR_CHECK_AGENTS_MD,
      severity: "error",
      message: "AGENTS.md does not exist",
      fixable: true,
      fixDescription: "Regenerate AGENTS.md with managed section",
    });
  } else if (!validation.isCurrent) {
    findings.push({
      check: DOCTOR_CHECK_AGENTS_MD,
      severity: "warning",
      message: "AGENTS.md managed section is out of date",
      fixable: true,
      fixDescription: "Update AGENTS.md managed section",
    });
  }
}

export async function checkBootstrapFiles(
  projectRoot: string,
  findings: DiagnosticFinding[],
  config: EngineeringConfig | null,
): Promise<void> {
  if (!config) return;

  const validations = await validateBootstrapFiles(projectRoot, config);

  for (const v of validations) {
    if (!v.exists) {
      findings.push({
        check: DOCTOR_CHECK_BOOTSTRAP_FILES,
        severity: "error",
        message: `Bootstrap file missing for ${v.harness}: ${v.bootstrapFile}`,
        fixable: true,
        fixDescription: `Run '${CLI_NAME} doctor --fix' to generate`,
      });
    } else if (!v.isCurrent) {
      findings.push({
        check: DOCTOR_CHECK_BOOTSTRAP_FILES,
        severity: "warning",
        message: `Bootstrap file out of date for ${v.harness}: ${v.bootstrapFile}`,
        fixable: true,
        fixDescription: `Run '${CLI_NAME} doctor --fix' to update`,
      });
    }

    if (v.legacyFile && v.legacyExists) {
      findings.push({
        check: DOCTOR_CHECK_BOOTSTRAP_FILES,
        severity: "warning",
        message: `Legacy bootstrap file still present for ${v.harness}: ${v.legacyFile}`,
        fixable: true,
        fixDescription: `Run '${CLI_NAME} doctor --fix' to remove legacy file`,
      });
    }
  }
}

export async function checkProjections(projectRoot: string, findings: DiagnosticFinding[], lock: EngineeringLock | null): Promise<void> {
  if (!lock) return;

  const projectionResult = await verifyProjection(projectRoot, lock);

  if (projectionResult.missing.length > 0) {
    findings.push({
      check: DOCTOR_CHECK_PROJECTIONS,
      severity: "error",
      message: `${projectionResult.missing.length} missing projection${projectionResult.missing.length === 1 ? "" : "s"}`,
      fixable: false,
      fixDescription: "Run 'codeflex-playbooks sync' to regenerate projections",
    });
  }

  if (projectionResult.stale.length > 0) {
    findings.push({
      check: DOCTOR_CHECK_PROJECTIONS,
      severity: "warning",
      message: `${projectionResult.stale.length} stale projection${projectionResult.stale.length === 1 ? "" : "s"}`,
      fixable: false,
      fixDescription: "Run 'codeflex-playbooks sync' to update projections",
    });
  }

  if (projectionResult.unexpected.length > 0) {
    findings.push({
      check: DOCTOR_CHECK_PROJECTIONS,
      severity: "warning",
      message: `${projectionResult.unexpected.length} unexpected projection${projectionResult.unexpected.length === 1 ? "" : "s"}`,
      fixable: false,
      fixDescription: `Run '${CLI_NAME} clean' then '${CLI_NAME} sync'`,
    });
  }
}

export async function checkGlobalAgentsMd(findings: DiagnosticFinding[]): Promise<void> {
  const globalDir = globalAgentsDirPath();
  const globalExists = await pathExists(globalDir);

  if (!globalExists) return;

  const globalMdPath = globalAgentsMdPath();
  const mdExists = await pathExists(globalMdPath);

  if (!mdExists) {
    findings.push({
      check: DOCTOR_CHECK_GLOBAL_AGENTS_MD,
      severity: "info",
      message: "Global ~/.agents/AGENTS.md does not exist",
      fixable: false,
      fixDescription: "Run 'codeflex-playbooks sync --global' to create",
    });
  }
}

export async function checkDeprecatedConfig(projectRoot: string, findings: DiagnosticFinding[]): Promise<void> {
  const deprecationReport = await checkDeprecations({ projectRoot });
  if (!deprecationReport.hasIssues) return;

  const formatted = formatDeprecationsClassified(deprecationReport, false);

  for (const issue of formatted.issues) {
    findings.push({
      check: DOCTOR_CHECK_DEPRECATED,
      severity: "error",
      message: issue,
      fixable: false,
    });
  }

  for (const warning of formatted.warnings) {
    findings.push({
      check: DOCTOR_CHECK_DEPRECATED,
      severity: "warning",
      message: warning,
      fixable: false,
    });
  }
}
