import { mkdtemp, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ProjectionPlan } from "./topology";
import { swapDirectory } from "../skills/swap";
import { pathExists, copyDirectory, expandHomePath, ensureDir } from "../utils/fs";
import { errorMessage } from "../utils/errors";
import { skillsDir } from "../config/index";

/** Input parameters for projecting skills to harness-specific directories. */
export interface ProjectSkillsInput {
  /** Absolute path to the project root. */
  projectRoot: string;
  /** Projection plan from {@link calculateProjectionTopology}. */
  plan: ProjectionPlan;
  /** Skill IDs to project from the canonical store. */
  skills: string[];
}

/** Result of a skill projection operation. */
export interface ProjectSkillsResult {
  /** Total number of skill projections across all targets. */
  projected: number;
  /** Error messages for projections that failed. */
  errors: string[];
}

/**
 * Projects skills from the canonical store (`.codeflex/skills/`) to harness-specific directories
 * according to a projection plan, using atomic swaps for each target.
 *
 * @param input - Projection parameters including project root, plan, and skill IDs
 * @returns Result with count of successful projections and any errors
 */
export async function projectSkills(input: ProjectSkillsInput): Promise<ProjectSkillsResult> {
  const { projectRoot, plan, skills } = input;
  const errors: string[] = [];
  let projected = 0;

  for (const target of plan.targets) {
    if (skills.length === 0) continue;

    const targetDir = expandHomePath(target.path, projectRoot);
    await ensureDir(dirname(targetDir));

    const tempDir = await mkdtemp(join(dirname(targetDir), ".codeflex-proj-"));

    try {
      const targetErrors: string[] = [];
      let targetProjected = 0;

      for (const skillId of skills) {
        const sourceDir = join(skillsDir(projectRoot), skillId);

        if (!(await pathExists(sourceDir))) {
          targetErrors.push(`Failed to project ${skillId} to ${target.path}: source skill directory not found`);
          continue;
        }

        try {
          const destDir = join(tempDir, skillId);
          await copyDirectory(sourceDir, destDir);
          targetProjected++;
        } catch (err) {
          targetErrors.push(`Failed to project ${skillId} to ${target.path}: ${errorMessage(err)}`);
        }
      }

      if (targetProjected === 0 && targetErrors.length > 0) {
        await rm(tempDir, { recursive: true, force: true });
        errors.push(...targetErrors);
        continue;
      }

      await swapDirectory(tempDir, targetDir);
      projected += targetProjected;
      errors.push(...targetErrors);
    } catch (err) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
      errors.push(`Failed to project to ${target.path}: ${errorMessage(err)}`);
    }
  }

  return { projected, errors };
}
