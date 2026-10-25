import type {
  ResolutionInput,
  ResolutionResult,
  ResolvedSkill,
  Capability,
  LoadedSkill,
  DetectionResult,
  UnmatchedTechnology,
} from "../types/index";
import { OverridePolicy } from "../types/index";
import { matchesInstallConditions } from "./install-matcher";
import { resolveOverrides } from "./override-resolver";
import { resolveDependencies } from "./dependency-resolver";
import { applyExceptions } from "./exception-handler";

function matchesCapabilities(required: string[] | undefined, projectCapabilities: Capability[]): boolean {
  if (!required || required.length === 0) return true;
  const projectSet = new Set(projectCapabilities);
  return required.some((cap) => projectSet.has(cap));
}

/**
 * A skill is cross-cutting when it applies universally rather than being gated behind
 * technology-detection conditions — i.e. its `codeflex.yaml` declares no `installWhen`
 * conditions. Exported so callers reconstructing `ResolvedSkill`s from data other than a
 * freshly-loaded `LoadedSkill` (e.g. `sync`, which rebuilds skills from the lock file plus the
 * canonical store) can classify skills identically to `init`'s full resolution pipeline.
 */
export function isCrossCutting(skill: Pick<LoadedSkill, "metadata">): boolean {
  const hasInstallConditions = (skill.metadata.installWhen?.any?.length ?? 0) > 0;
  return !hasInstallConditions;
}

function matchSkills(skills: LoadedSkill[], detection: DetectionResult): LoadedSkill[] {
  return skills.filter((skill) => {
    const conditions = skill.metadata.installWhen?.any ?? [];
    const installMatch = conditions.length === 0 || matchesInstallConditions(conditions, detection);
    
    // Cross-cutting skills (no installWhen conditions) apply universally and should not
    // be filtered by capabilities. Only technology-specific skills should check capabilities.
    const isCrossCutting = conditions.length === 0;
    const capabilitiesMatch = isCrossCutting || matchesCapabilities(skill.metadata.appliesWhen?.capabilities, detection.capabilities);
    
    return installMatch && capabilitiesMatch;
  });
}

function excludeSkills(skills: LoadedSkill[], exclude: string[]): LoadedSkill[] {
  return skills.filter((skill) => !exclude.includes(skill.id) && !exclude.includes(skill.slug));
}

function findUnmatchedTechnologies(
  allSkills: LoadedSkill[],
  detection: DetectionResult,
): UnmatchedTechnology[] {
  const matchedTechNames = new Set<string>();

  for (const skill of allSkills) {
    const conditions = skill.metadata.installWhen?.any ?? [];
    if (conditions.length === 0) continue;

    for (const tech of detection.technologies) {
      if (matchedTechNames.has(tech.name)) continue;

      const syntheticDetection: DetectionResult = {
        technologies: [tech],
        scopes: {},
        capabilities: [],
      };
      if (matchesInstallConditions(conditions, syntheticDetection)) {
        matchedTechNames.add(tech.name);
      }
    }
  }

  return detection.technologies
    .filter((tech) => !matchedTechNames.has(tech.name))
    .map((tech) => ({
      name: tech.name,
      version: tech.version,
      matchedBy: tech.matchedBy,
    }));
}

function collectRules(skills: LoadedSkill[]): Set<string> {
  const rules = new Set<string>();
  for (const skill of skills) {
    for (const rule of skill.metadata.rules ?? []) {
      rules.add(rule);
    }
  }
  return rules;
}

function applyIncludeConfig(
  filteredCodeflex: LoadedSkill[],
  filteredClient: LoadedSkill[],
  filteredRepository: LoadedSkill[],
  codeflexSkills: LoadedSkill[],
  clientSkills: LoadedSkill[],
  repositorySkills: LoadedSkill[],
  include: string[],
  exclude: string[],
): void {
  const detectedIds = new Set([
    ...filteredCodeflex.map((s) => s.id),
    ...filteredCodeflex.map((s) => s.slug),
    ...filteredClient.map((s) => s.id),
    ...filteredClient.map((s) => s.slug),
    ...filteredRepository.map((s) => s.id),
    ...filteredRepository.map((s) => s.slug),
  ]);

  for (const includeId of include) {
    if (detectedIds.has(includeId) || exclude.includes(includeId)) continue;

    const codeflexSkill = codeflexSkills.find((s) => s.id === includeId || s.slug === includeId);
    if (codeflexSkill) {
      filteredCodeflex.push(codeflexSkill);
      detectedIds.add(includeId);
      continue;
    }

    const clientSkill = clientSkills.find((s) => s.id === includeId || s.slug === includeId);
    if (clientSkill) {
      filteredClient.push(clientSkill);
      detectedIds.add(includeId);
      continue;
    }

    const repoSkill = repositorySkills.find((s) => s.id === includeId || s.slug === includeId);
    if (repoSkill) {
      filteredRepository.push(repoSkill);
      detectedIds.add(includeId);
    }
  }
}

function filterByOverridePrecedence(
  filteredCodeflex: LoadedSkill[],
  filteredClient: LoadedSkill[],
  filteredRepository: LoadedSkill[],
): { effectiveCodeflex: LoadedSkill[]; effectiveRepository: LoadedSkill[] } {
  const clientRules = collectRules(filteredClient);
  const repositoryRules = collectRules(filteredRepository);
  const higherPriorityRules = new Set([...clientRules, ...repositoryRules]);

  const effectiveCodeflex = filteredCodeflex.filter((skill) => {
    const rules = skill.metadata.rules ?? [];
    if (rules.length === 0) return true;
    if (skill.metadata.overridePolicy === OverridePolicy.Required) {
      return true;
    }
    const nonOverridable = new Set(skill.metadata.nonOverridableRules ?? []);
    return rules.some((rule) => !higherPriorityRules.has(rule) || nonOverridable.has(rule));
  });

  const effectiveRepository = filteredRepository.filter((skill) => {
    const rules = skill.metadata.rules ?? [];
    if (rules.length === 0) return true;
    return rules.some((rule) => !clientRules.has(rule));
  });

  return { effectiveCodeflex, effectiveRepository };
}

function buildExplanation(
  resolvedSkills: LoadedSkill[],
  config: import("../types/index.js").EngineeringConfig,
): import("../types/index.js").ResolutionExplanation[] {
  return resolvedSkills.map((skill) => {
    const conditions = skill.metadata.installWhen?.any ?? [];
    const reason = conditions.length > 0
      ? `Matched install conditions`
      : `No install conditions (always installed)`;

    return {
      skillId: skill.id,
      reason,
      matchedBy: skill.metadata.installWhen?.any?.map((c) =>
        c.packageReference ? `package:${c.packageReference.package}` :
        c.file ? `file:${c.file.pattern}` : "unknown"
      ).join(", ") ?? "none",
      dependencies: skill.metadata.requires ?? [],
      overriddenRules: skill.metadata.overrides ?? [],
      scope: config.scopes[skill.slug],
    };
  });
}

/**
 * Resolves which engineering standards (skills) apply to a detected project.
 *
 * Matches skills against detection results, applies include/exclude config, resolves
 * override precedence (client > repository > codeflex), resolves dependencies, and applies
 * rule exceptions.
 *
 * @param input - Resolution inputs including detection result, config, and loaded skill sets
 * @returns Resolved skills with conflicts, overrides, exceptions, and explanation metadata
 */
export async function resolveStandards(input: ResolutionInput): Promise<ResolutionResult> {
  const { detection, config, codeflexSkills, clientSkills, repositorySkills } = input;

  const matchedCodeflex = matchSkills(codeflexSkills, detection);
  const matchedClient = matchSkills(clientSkills, detection);
  const matchedRepository = matchSkills(repositorySkills, detection);

  const filteredCodeflex = excludeSkills(matchedCodeflex, config.exclude);
  const filteredClient = excludeSkills(matchedClient, config.exclude);
  const filteredRepository = excludeSkills(matchedRepository, config.exclude);

  applyIncludeConfig(
    filteredCodeflex,
    filteredClient,
    filteredRepository,
    codeflexSkills,
    clientSkills,
    repositorySkills,
    config.include,
    config.exclude,
  );

  const { effectiveCodeflex, effectiveRepository } = filterByOverridePrecedence(
    filteredCodeflex,
    filteredClient,
    filteredRepository,
  );

  const allSkills = [...filteredClient, ...effectiveRepository, ...effectiveCodeflex];

  const resolved = new Set(allSkills.map((s) => s.id));
  const depResult = resolveDependencies(
    [...codeflexSkills, ...clientSkills, ...repositorySkills],
    resolved,
    detection,
    config.exclude
  );

  const resolvedSkills = allSkills.filter((s) => resolved.has(s.id));
  const overrideResult = resolveOverrides(resolvedSkills);

  const ruleMap = new Map<string, string>();
  for (const skill of resolvedSkills) {
    const rules = skill.metadata.rules ?? [];
    for (const rule of rules) {
      if (!overrideResult.overrides.has(rule)) {
        ruleMap.set(rule, skill.id);
      }
    }
  }

  const exceptionResult = applyExceptions(ruleMap, config.exceptions);

  const finalSkills: ResolvedSkill[] = resolvedSkills
    .filter((skill) => {
      const rules = skill.metadata.rules ?? [];
      if (rules.length === 0) return true;
      return rules.some((rule) => exceptionResult.active.has(rule));
    })
    .map((skill) => ({
      id: skill.id,
      slug: skill.slug,
      sourceId: skill.sourceId,
      source: skill.source,
      scopes: config.scopes[skill.slug],
      overriddenRules: skill.metadata.overrides,
      skillDir: skill.skillDir,
      crossCutting: isCrossCutting(skill),
    }));

  const explanation = buildExplanation(resolvedSkills, config);

  const nonOverridableConflicts = overrideResult.conflicts.filter((c) => c.nonOverridable);

  const idToSlug = new Map(resolvedSkills.map((s) => [s.id, s.slug]));

  const allLoadedSkills = [...codeflexSkills, ...clientSkills, ...repositorySkills];
  const unmatchedTechnologies = findUnmatchedTechnologies(allLoadedSkills, detection);

  return {
    skills: finalSkills,
    conflicts: overrideResult.conflicts,
    nonOverridableConflicts,
    overrides: Object.fromEntries(
      [...overrideResult.overrides].map(([rule, winningId]) => [rule, idToSlug.get(winningId) ?? winningId])
    ),
    exceptions: {
      active: exceptionResult.excepted,
      expired: exceptionResult.expired,
    },
    dependencyWarnings: depResult.missing,
    explanation,
    unmatchedTechnologies,
  };
}
