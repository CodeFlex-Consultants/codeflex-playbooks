import { stat, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
import type { SkillSource } from "../types/index";
import { loadSkillsFromSource } from "../resolution/skill-loader";
import { parseFrontmatter } from "../resolution/frontmatter";

/**
 * Locates a skill's directory on disk by identifier within a source tree, shared by the
 * installer (copying a skill into the canonical store) and the release verifier (hashing a
 * skill to check it against the lockfile). Matches by either the dot-separated `id` (from
 * codeflex.yaml) or the dash-separated `slug` (from SKILL.md frontmatter `name`), since callers
 * may only have one or the other available.
 *
 * Tries the flat convention first (`skillsDir/<id>/`) — a single `stat` call, plus (when it's
 * a directory) a check that its `codeflex.yaml` actually declares this skill's id, so an
 * unrelated directory that happens to share a name with a skill id can't silently shadow the
 * real skill. This covers the project's own canonical `.codeflex/skills/` store (always flat by
 * construction) and any flat-style source. Falls back to a full recursive scan of the source
 * tree, matched against each skill's `codeflex.yaml` id, when the flat path doesn't exist or
 * doesn't match — required for sources that nest skills under category folders (e.g. the
 * central engineering-skills repository's `skills/<category>/<name>/` layout, where a skill's
 * id like `backend.dotnet` doesn't match its folder name `dotnet`).
 *
 * The recursive scan is memoized per `skillsDir` across all lookups made through the same
 * `SkillDirectoryResolver` instance, so resolving many skills from the same source only pays
 * the scan cost once.
 */
export class SkillDirectoryResolver {
  private readonly nestedScans = new Map<string, Promise<Map<string, string>>>();

  /**
   * Returns the skill's directory if one is found at the flat path or via the nested scan.
   * A path returned here is not guaranteed to be a directory (it may exist as a file) —
   * callers that need to distinguish "not found" from "found but not a directory" should
   * `stat` the returned path themselves.
   */
  async find(skillsDir: string, skillId: string, sourceType: SkillSource): Promise<string | undefined> {
    const flatPath = join(skillsDir, skillId);
    const flatStat = await stat(flatPath).catch(() => undefined);

    if (flatStat) {
      // Exists but isn't a directory (e.g. a stray file): return as-is with no identity
      // check, so callers that distinguish "not found" from "found but not a directory"
      // (release-verifier.ts) can still produce that diagnostic themselves.
      if (!flatStat.isDirectory()) {
        return flatPath;
      }

      if (await declaresSkillId(flatPath, skillId)) {
        return flatPath;
      }
      // A directory exists at the flat path but its codeflex.yaml declares a different id
      // (or has none) — don't trust the name match alone; fall through to the scan below,
      // which will find the real skill wherever it actually lives.
    }

    const nested = await this.getNestedMap(skillsDir, sourceType);
    return nested.get(skillId);
  }

  private getNestedMap(skillsDir: string, sourceType: SkillSource): Promise<Map<string, string>> {
    let cached = this.nestedScans.get(skillsDir);
    if (!cached) {
      cached = loadSkillsFromSource(skillsDir, sourceType).then((loaded) => {
        const map = new Map<string, string>();
        for (const s of loaded) {
          if (s.id) {
            map.set(s.id, s.skillDir);
          }
          if (s.slug) {
            map.set(s.slug, s.skillDir);
          }
        }
        return map;
      });
      this.nestedScans.set(skillsDir, cached);
    }
    return cached;
  }
}

async function declaresSkillId(dir: string, skillId: string): Promise<boolean> {
  const matchesCodeflexYaml = await (async (): Promise<boolean> => {
    try {
      const content = await readFile(join(dir, "codeflex.yaml"), "utf-8");
      const parsed: unknown = parse(content);
      return typeof parsed === "object" && parsed !== null && (parsed as { id?: unknown }).id === skillId;
    } catch {
      return false;
    }
  })();

  if (matchesCodeflexYaml) {
    return true;
  }

  try {
    const content = await readFile(join(dir, "SKILL.md"), "utf-8");
    const { metadata } = parseFrontmatter(content);
    return metadata.name === skillId;
  } catch {
    return false;
  }
}
