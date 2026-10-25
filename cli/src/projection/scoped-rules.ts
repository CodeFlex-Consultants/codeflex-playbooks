import { readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import type { EngineeringConfig, ResolvedSkill } from "../types/index";
import { AgentHarness } from "../types/index";
import { errorMessage } from "../utils/errors";
import { writeAtomic, ensureDir, pathExists } from "../utils/fs";
import { HARNESS_REGISTRY } from "./registry";

/** A scoped rule mapping a path pattern to the skills that apply to matching files. */
export interface ScopedRule {
  /** Glob pattern matching file paths. */
  pathPattern: string;
  /** Skill IDs that apply to files matching this pattern. */
  skillIds: string[];
}

/** Input parameters for generating harness-specific scoped rule files. */
export interface GenerateScopedRulesInput {
  /** Absolute path to the project root. */
  projectRoot: string;
  /** Engineering configuration containing scope definitions. */
  config: EngineeringConfig;
  /** Resolved skills with their scope assignments. */
  resolvedSkills: ResolvedSkill[];
  /** Target harness to generate scoped rules for. */
  harness: AgentHarness;
}

/** Result of a scoped rule generation operation. */
export interface GenerateScopedRulesResult {
  /** Absolute paths of generated rule files. */
  generated: string[];
  /** Error messages for files that failed to write. */
  errors: string[];
}

export interface CleanStaleScopedRulesInput {
  projectRoot: string;
  config: EngineeringConfig;
  resolvedSkills: ResolvedSkill[];
  harness: AgentHarness;
}

export interface CleanStaleScopedRulesResult {
  removed: string[];
  errors: string[];
}

interface ScopedRuleFileFormat {
  fileExtension: string;
  pathPatternKey: string;
  additionalFrontmatter?: Record<string, string | boolean>;
}

export const SCOPED_FILE_PREFIX = "codeflex-scoped-";

export function getScopedRulesDir(harness: AgentHarness): string | undefined {
  switch (harness) {
    case AgentHarness.ClaudeCode: return join(".claude", "rules");
    case AgentHarness.Kilo: return join(".kilo", "rules");
    case AgentHarness.Copilot: return join(".github", "instructions");
    case AgentHarness.Cursor: return join(".cursor", "rules");
    case AgentHarness.ZooCode: return join(".roo", "rules");
    case AgentHarness.Devin: return join(".devin", "rules");
    case AgentHarness.Cline: return ".clinerules";
    default: return undefined;
  }
}

const DEFAULT_RULE_FORMAT: ScopedRuleFileFormat = {
  fileExtension: ".md",
  pathPatternKey: "globs",
};

const SCOPED_RULE_FORMATS: Partial<Record<AgentHarness, ScopedRuleFileFormat>> = {
  [AgentHarness.Cursor]: {
    fileExtension: ".mdc",
    pathPatternKey: "globs",
    additionalFrontmatter: { alwaysApply: false },
  },
  [AgentHarness.Copilot]: {
    fileExtension: ".instructions.md",
    pathPatternKey: "applyTo",
  },
  [AgentHarness.ClaudeCode]: {
    fileExtension: ".md",
    pathPatternKey: "paths",
  },
  [AgentHarness.Kilo]: {
    fileExtension: ".md",
    pathPatternKey: "paths",
  },
};

function getScopedRuleFormat(harness: AgentHarness): ScopedRuleFileFormat {
  return SCOPED_RULE_FORMATS[harness] ?? DEFAULT_RULE_FORMAT;
}

function scopedFileName(pathPattern: string, format: ScopedRuleFileFormat): string {
  return `${SCOPED_FILE_PREFIX}${pathPattern.replace(/[^a-z0-9]/gi, "-")}${format.fileExtension}`;
}

export async function cleanStaleScopedRules(input: CleanStaleScopedRulesInput): Promise<CleanStaleScopedRulesResult> {
  const { projectRoot, config, resolvedSkills, harness } = input;
  const removed: string[] = [];
  const errors: string[] = [];

  const rulesDirRel = getScopedRulesDir(harness);
  if (!rulesDirRel) {
    return { removed, errors };
  }

  const rulesDir = join(projectRoot, rulesDirRel);
  const format = getScopedRuleFormat(harness);

  const scopedRules = calculateScopedRules(config, resolvedSkills);
  const expectedFiles = new Set(scopedRules.map((r) => scopedFileName(r.pathPattern, format)));

  if (!(await pathExists(rulesDir))) {
    return { removed, errors };
  }

  let entries: string[];
  try {
    entries = await readdir(rulesDir);
  } catch (err) {
    errors.push(`Failed to read ${rulesDir}: ${errorMessage(err)}`);
    return { removed, errors };
  }

  for (const entry of entries) {
    if (!entry.startsWith(SCOPED_FILE_PREFIX) || !entry.endsWith(format.fileExtension)) {
      continue;
    }

    if (expectedFiles.has(entry)) {
      continue;
    }

    const entryPath = join(rulesDir, entry);

    try {
      const s = await stat(entryPath);
      if (s.isFile()) {
        await rm(entryPath);
        removed.push(`${rulesDirRel}/${entry}`);
      }
    } catch (err) {
      errors.push(`Failed to remove ${entryPath}: ${errorMessage(err)}`);
    }
  }

  return { removed, errors };
}

function slugContainsComponent(slug: string, component: string): boolean {
  const slugParts = slug.split("-");
  const componentParts = component.split("-");
  
  for (let i = 0; i <= slugParts.length - componentParts.length; i++) {
    let match = true;
    for (let j = 0; j < componentParts.length; j++) {
      if (slugParts[i + j] !== componentParts[j]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }
  
  return false;
}

/**
 * Computes the set of scoped rules by merging scope assignments from resolved skills and config.
 *
 * Config scope keys that don't directly match a projected skill slug are mapped to projected
 * skills whose slug contains the key as a dash-separated component (e.g. config key `angular`
 * maps to projected slug `codeflex-angular`).
 *
 * @param config - Engineering configuration containing scope definitions
 * @param resolvedSkills - Resolved skills with their scope assignments
 * @returns Array of scoped rules mapping path patterns to skill IDs
 */
export function calculateScopedRules(
  config: EngineeringConfig,
  resolvedSkills: ResolvedSkill[]
): ScopedRule[] {
  const rules: ScopedRule[] = [];

  const projectedSlugs = new Set(resolvedSkills.map((s) => s.slug));
  const skillScopes = new Map<string, string[]>();

  for (const skill of resolvedSkills) {
    if (skill.scopes && skill.scopes.length > 0) {
      skillScopes.set(skill.slug, skill.scopes);
    }
  }

  for (const [configKey, scopes] of Object.entries(config.scopes)) {
    if (projectedSlugs.has(configKey)) {
      const existing = skillScopes.get(configKey) ?? [];
      skillScopes.set(configKey, [...new Set([...existing, ...scopes])]);
    } else {
      for (const slug of projectedSlugs) {
        if (slugContainsComponent(slug, configKey)) {
          const existing = skillScopes.get(slug) ?? [];
          skillScopes.set(slug, [...new Set([...existing, ...scopes])]);
        }
      }
    }
  }

  const scopeToSkills = new Map<string, string[]>();

  for (const [skillId, scopes] of skillScopes) {
    for (const scope of scopes) {
      const existing = scopeToSkills.get(scope) ?? [];
      existing.push(skillId);
      scopeToSkills.set(scope, existing);
    }
  }

  for (const [pathPattern, skillIds] of scopeToSkills) {
    rules.push({ pathPattern, skillIds });
  }

  return rules;
}

/**
 * Resolves the harness's native skill directory (as used by {@link HARNESS_REGISTRY}) for
 * reference text in generated scoped rule files. This is always the actual home-directory
 * projection path the harness reads skills from, never a repo-local path, so the guidance
 * matches what `registry.ts`/`projector.ts` actually write to.
 */
function getSkillsRef(harness: AgentHarness): string {
  return HARNESS_REGISTRY[harness]?.nativeSkillPaths[0] ?? "~/.agents/skills";
}

/**
 * Generates harness-specific scoped rule files that map path patterns to applicable skills.
 *
 * Creates rule files in the harness's rules directory with appropriate frontmatter format
 * (e.g. `.mdc` for Cursor, `.instructions.md` for Copilot).
 *
 * @param input - Generation parameters including config, resolved skills, and target harness
 * @returns Result listing generated file paths and any errors
 */
export async function generateScopedRules(input: GenerateScopedRulesInput): Promise<GenerateScopedRulesResult> {
  const { projectRoot, config, resolvedSkills, harness } = input;
  const generated: string[] = [];
  const errors: string[] = [];

  const rulesDirRel = getScopedRulesDir(harness);
  if (!rulesDirRel) {
    return { generated, errors };
  }

  const scopedRules = calculateScopedRules(config, resolvedSkills);

  if (scopedRules.length === 0) {
    return { generated, errors };
  }

  const rulesDir = join(projectRoot, rulesDirRel);
  await ensureDir(rulesDir);

  const skillsRef = getSkillsRef(harness);
  const format = getScopedRuleFormat(harness);

  for (const rule of scopedRules) {
    const fileName = scopedFileName(rule.pathPattern, format);
    const filePath = join(rulesDir, fileName);

    const frontmatterLines: string[] = [
      "---",
      `description: CodeFlex Engineering Standards for ${rule.pathPattern}`,
      `${format.pathPatternKey}: ${rule.pathPattern}`,
    ];

    if (format.additionalFrontmatter) {
      for (const [key, value] of Object.entries(format.additionalFrontmatter)) {
        frontmatterLines.push(`${key}: ${value}`);
      }
    }

    frontmatterLines.push("---");

    const content = `${frontmatterLines.join("\n")}

## Purpose

This scoped rule file tells you which Engineering Skills (both CodeFlex and client/repository) apply to files matching \`${rule.pathPattern}\`. Read this file **before** loading skills to determine which technology-specific skills you need.

## ⛔ MANDATORY — Load Before Touching Matched Files

Before reading, editing, or creating any file matching \`${rule.pathPattern}\`, you MUST invoke the \`skill\` tool for **each** of the following skills:

${rule.skillIds.map((id) => `- \`${id}\``).join("\n")}

This includes both codeflex-* skills and client/repository skills. All listed skills are mandatory for matched files.

This is not optional. Skipping skill loading for matched files is a process failure regardless of whether the resulting code is correct.

After loading, state in your response: "Skills loaded for ${rule.pathPattern}: <list>."

Detailed guidance is in the SKILL.md files under \`.codeflex/skills/\` or \`${skillsRef}\`.
`;

    try {
      await writeAtomic(filePath, content);
      generated.push(filePath);
    } catch (err) {
      errors.push(`Failed to write ${filePath}: ${errorMessage(err)}`);
    }
  }

  return { generated, errors };
}
