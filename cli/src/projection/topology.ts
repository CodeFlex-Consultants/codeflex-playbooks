import type { HarnessCapability } from "./registry";
import { HARNESS_REGISTRY } from "./registry";
import type { AgentHarness } from "../types/index";
import { ConfigValidationError } from "../utils/errors";

const GLOBAL_SKILLS_PATH = "~/.agents/skills";

/** A single filesystem target where skills are projected for one or more harnesses. */
export interface ProjectionTarget {
  /** Relative path from project root to the projection directory. */
  path: string;
  /** Harnesses satisfied by this projection target. */
  satisfiesHarnesses: AgentHarness[];
}

/** A plan describing all projection targets needed for a set of harnesses. */
export interface ProjectionPlan {
  /** Deduplicated projection targets, sorted by number of harnesses satisfied (descending). */
  targets: ProjectionTarget[];
}

/**
 * Checks if a harness supports the global agents skills path.
 */
function supportsGlobalSkillsPath(capability: HarnessCapability): boolean {
  return (
    capability.nativeSkillPaths.includes(GLOBAL_SKILLS_PATH) ||
    capability.compatibilityPaths.includes(GLOBAL_SKILLS_PATH)
  );
}

/**
 * Calculates the minimum set of filesystem projection targets needed to satisfy all configured harnesses.
 *
 * Prefers ~/.agents/skills/ when the harness supports it (either as native or compatibility path),
 * reducing the number of projections and making skills more portable across harnesses.
 *
 * @param harnesses - Agent harnesses to calculate projections for
 * @returns A projection plan with deduplicated targets
 * @throws {ConfigValidationError} If an unknown harness is encountered
 */
export function calculateProjectionTopology(
  harnesses: AgentHarness[]
): ProjectionPlan {
  const satisfiedHarnesses = new Set<AgentHarness>();
  const pathToHarnesses = new Map<string, AgentHarness[]>();

  // First pass: group harnesses by whether they support ~/.agents/skills/
  const globalPathHarnesses: AgentHarness[] = [];
  const nativePathHarnesses: Array<{ harness: AgentHarness; nativePath: string }> = [];

  for (const harness of harnesses) {
    const capability: HarnessCapability | undefined = HARNESS_REGISTRY[harness];
    if (!capability) {
      throw new ConfigValidationError(`Unknown harness: ${harness}`);
    }

    if (supportsGlobalSkillsPath(capability)) {
      globalPathHarnesses.push(harness);
    } else if (capability.nativeSkillPaths.length > 0) {
      // Use the first native path
      const nativePath = capability.nativeSkillPaths[0];
      if (nativePath) {
        nativePathHarnesses.push({ harness, nativePath });
      }
    }
  }

  // Second pass: project harnesses that support ~/.agents/skills/ to that path
  if (globalPathHarnesses.length > 0) {
    pathToHarnesses.set(GLOBAL_SKILLS_PATH, globalPathHarnesses);
    for (const h of globalPathHarnesses) {
      satisfiedHarnesses.add(h);
    }
  }

  // Third pass: project harnesses without ~/.agents/skills/ support to their native paths
  for (const { harness, nativePath } of nativePathHarnesses) {
    if (!satisfiedHarnesses.has(harness)) {
      const existing = pathToHarnesses.get(nativePath) ?? [];
      if (!existing.includes(harness)) {
        existing.push(harness);
      }
      pathToHarnesses.set(nativePath, existing);
      satisfiedHarnesses.add(harness);
    }
  }

  const targets: ProjectionTarget[] = Array.from(pathToHarnesses.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .map(([path, harnessList]) => ({
      path,
      satisfiesHarnesses: harnessList,
    }));

  return { targets };
}
