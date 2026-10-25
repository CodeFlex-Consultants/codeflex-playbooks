import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
import type { LoadedSkill, Diagnostic } from "../types/index";
import { SkillSource, DiagnosticSeverity } from "../types/index";
import { codeflexYamlSchema, skillManifestSchema } from "../types/schemas";
import { parseFrontmatter } from "./frontmatter";
import { FrontmatterParseError } from "../utils/errors";
import { pathExists } from "../utils/fs";
import { formatZodIssues } from "../utils/yaml";

/**
 * Maximum directory depth to search below `sourceDir` when looking for skill
 * directories. The `engineering-skills` repository nests skills under a
 * category directory (e.g. `skills/backend/entity-framework/`), so a flat
 * one-level scan is not sufficient.
 */
const MAX_SKILL_SEARCH_DEPTH = 4;

/**
 * Recursively finds directories containing a `SKILL.md` and/or `codeflex.yaml`
 * file, treating the first such directory found along a given path as a leaf
 * (skills are not expected to nest inside other skills).
 *
 * @param dir - Directory to search
 * @param depth - Current recursion depth (search stops beyond `MAX_SKILL_SEARCH_DEPTH`)
 * @param found - Accumulator array of discovered candidate skill directories
 */
async function collectSkillDirs(dir: string, depth: number, found: string[]): Promise<void> {
  if (depth > MAX_SKILL_SEARCH_DEPTH) {
    return;
  }

  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const subDir = join(dir, entry.name);
    const [hasSkillMd, hasCodeflexYaml] = await Promise.all([
      pathExists(join(subDir, "SKILL.md")),
      pathExists(join(subDir, "codeflex.yaml")),
    ]);

    if (hasSkillMd || hasCodeflexYaml) {
      found.push(subDir);
      continue;
    }

    await collectSkillDirs(subDir, depth + 1, found);
  }
}

export interface LoadSkillsResult {
  skills: LoadedSkill[];
  diagnostics: Diagnostic[];
}

/**
 * Loads skill definitions from a directory, parsing SKILL.md frontmatter and codeflex.yaml manifests.
 *
 * Each subdirectory of `sourceDir` is expected to contain a `SKILL.md` (with YAML frontmatter)
 * and an `codeflex.yaml` manifest. Invalid or incomplete skills are silently skipped.
 *
 * @param sourceDir - Path to the directory containing skill subdirectories
 * @param source - The origin type of the skills (codeflex, client, or repository)
 * @param sourceId - Optional identifier of the configured standards source (client/repository id)
 * @returns Array of successfully loaded skill definitions
 */
export async function loadSkillsFromSource(
  sourceDir: string,
  source: SkillSource,
  sourceId?: string
): Promise<LoadedSkill[]> {
  const result = await loadSkillsFromSourceWithDiagnostics(sourceDir, source, sourceId);
  return result.skills;
}

/**
 * @param sourceDir - Path to the directory containing skill subdirectories
 * @param source - The origin type of the skills (codeflex, client, or repository)
 * @param sourceId - Optional identifier of the configured standards source (client/repository id)
 */
export async function loadSkillsFromSourceWithDiagnostics(
  sourceDir: string,
  source: SkillSource,
  sourceId?: string
): Promise<LoadSkillsResult> {
  const skills: LoadedSkill[] = [];
  const diagnostics: Diagnostic[] = [];

  const skillDirs: string[] = [];
  await collectSkillDirs(sourceDir, 0, skillDirs);

  for (const skillDir of skillDirs) {
    const entry = skillDir.slice(sourceDir.length + 1);

    const skillMdPath = join(skillDir, "SKILL.md");
    const codeflexYamlPath = join(skillDir, "codeflex.yaml");

    let skillMdContent: string;
    let codeflexYamlContent: string;

    try {
      skillMdContent = await readFile(skillMdPath, "utf-8");
      codeflexYamlContent = await readFile(codeflexYamlPath, "utf-8");
    } catch {
      diagnostics.push({
        severity: DiagnosticSeverity.Warning,
        code: "SKILL_MISSING_FILES",
        message: `Skill directory '${entry}' is missing SKILL.md or codeflex.yaml`,
        detail: skillDir,
      });
      continue;
    }

    try {
      const { metadata: frontmatterMeta } = parseFrontmatter(skillMdContent);
      const manifestResult = skillManifestSchema.safeParse(frontmatterMeta);
      if (!manifestResult.success) {
        const issues = formatZodIssues(manifestResult.error);
        diagnostics.push({
          severity: DiagnosticSeverity.Warning,
          code: "SKILL_INVALID_FRONTMATTER",
          message: `Skill '${entry}' has invalid SKILL.md frontmatter: ${issues}`,
          detail: skillDir,
        });
        continue;
      }
      const manifest = manifestResult.data;

      const codeflexYamlParsed = parse(codeflexYamlContent);
      if (codeflexYamlParsed === null || typeof codeflexYamlParsed !== "object") {
        diagnostics.push({
          severity: DiagnosticSeverity.Warning,
          code: "SKILL_INVALID_YAML",
          message: `Skill '${entry}' has invalid codeflex.yaml: parsed as null or non-object`,
          detail: skillDir,
        });
        continue;
      }
      const codeflexResult = codeflexYamlSchema.safeParse(codeflexYamlParsed);
      if (!codeflexResult.success) {
        const issues = formatZodIssues(codeflexResult.error);
        diagnostics.push({
          severity: DiagnosticSeverity.Warning,
          code: "SKILL_INVALID_MANIFEST",
          message: `Skill '${entry}' has invalid codeflex.yaml: ${issues}`,
          detail: skillDir,
        });
        continue;
      }
      const metadata = codeflexResult.data;

      skills.push({
        id: metadata.id,
        slug: manifest.name,
        sourceId,
        source,
        manifest,
        metadata,
        skillDir,
      });
    } catch (err) {
      if (err instanceof FrontmatterParseError) {
        diagnostics.push({
          severity: DiagnosticSeverity.Warning,
          code: "SKILL_INVALID_FRONTMATTER",
          message: `Skill '${entry}' has invalid SKILL.md frontmatter: ${err.message}`,
          detail: skillDir,
        });
        continue;
      }
      diagnostics.push({
        severity: DiagnosticSeverity.Warning,
        code: "SKILL_PARSE_ERROR",
        message: `Skill '${entry}' failed to parse: ${err instanceof Error ? err.message : String(err)}`,
        detail: skillDir,
      });
      continue;
    }
  }

  return { skills, diagnostics };
}
