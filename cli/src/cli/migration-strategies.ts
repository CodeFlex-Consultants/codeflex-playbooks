import { join } from "node:path";
import { readFile } from "node:fs/promises";
import type { EngineeringConfig, AgentHarness } from "../types/index";
import { HARNESS_REGISTRY, type HarnessCapability } from "../projection/registry";
import { BOOTSTRAP_REGISTRY } from "../agents-md/bootstrap-registry";
import { pathExists } from "../utils/fs";

export const enum MigrationStepType {
  UpdateConfig = "update-config",
  CreateFile = "create-file",
  RemoveFile = "remove-file",
  ModifyFile = "modify-file",
}

export interface MigrationStep {
  readonly type: MigrationStepType;
  readonly description: string;
  readonly path?: string;
  readonly content?: string;
  readonly configUpdate?: Partial<EngineeringConfig>;
}

export interface MigrationPlan {
  readonly strategyName: string;
  readonly description: string;
  readonly steps: readonly MigrationStep[];
  readonly hasChanges: boolean;
}

export interface MigrationContext {
  readonly projectRoot: string;
  readonly from?: AgentHarness;
  readonly to?: AgentHarness;
  readonly config: EngineeringConfig | null;
}

export interface MigrationStrategy {
  readonly name: string;
  canHandle(context: MigrationContext): boolean;
  plan(context: MigrationContext): Promise<MigrationPlan>;
}

const NO_CHANGES_PLAN: MigrationPlan = {
  strategyName: "none",
  description: "No migration needed.",
  steps: [],
  hasChanges: false,
};

export class HarnessMigrationStrategy implements MigrationStrategy {
  public readonly name = "harness-to-harness";

  canHandle(context: MigrationContext): boolean {
    return context.from !== undefined && context.to !== undefined && context.from !== context.to;
  }

  async plan(context: MigrationContext): Promise<MigrationPlan> {
    const { projectRoot, from, to, config } = context;
    if (!from || !to) return NO_CHANGES_PLAN;

    const fromCapability = HARNESS_REGISTRY[from];
    const toCapability = HARNESS_REGISTRY[to];
    if (!fromCapability || !toCapability) {
      return {
        strategyName: this.name,
        description: `Unknown harness specified.`,
        steps: [],
        hasChanges: false,
      };
    }

    const steps: MigrationStep[] = [
      this.planHarnessSwapStep(from, to, config),
      ...(await this.planBootstrapRemovalSteps(projectRoot, from, to, fromCapability)),
      ...(await this.planBootstrapCreationStep(projectRoot, from, to)),
    ];

    return {
      strategyName: this.name,
      description: `Migrate from ${from} to ${to}`,
      steps,
      hasChanges: steps.length > 0,
    };
  }

  private planHarnessSwapStep(
    from: AgentHarness,
    to: AgentHarness,
    config: EngineeringConfig | null,
  ): MigrationStep {
    return {
      type: MigrationStepType.UpdateConfig,
      description: `Replace '${from}' with '${to}' in agentHarnesses`,
      configUpdate: {
        agentHarnesses: buildNewHarnessList(config?.agentHarnesses ?? [], from, to),
      },
    };
  }

  private async planBootstrapRemovalSteps(
    projectRoot: string,
    from: AgentHarness,
    to: AgentHarness,
    fromCapability: HarnessCapability,
  ): Promise<MigrationStep[]> {
    const steps: MigrationStep[] = [];

    const fromBootstrap = findBootstrapForHarness(from);
    if (fromBootstrap && !isBootstrapStillNeeded(fromBootstrap.relativePath, to)) {
      const fullPath = join(projectRoot, fromBootstrap.relativePath);
      const exists = await pathExists(fullPath);
      if (exists) {
        steps.push({
          type: MigrationStepType.RemoveFile,
          description: `Remove old bootstrap file: ${fromBootstrap.relativePath}`,
          path: fromBootstrap.relativePath,
        });
      }
    }

    for (const legacyPath of fromCapability?.legacyBootstrapFiles ?? []) {
      const fullPath = join(projectRoot, legacyPath);
      const exists = await pathExists(fullPath);
      if (exists) {
        steps.push({
          type: MigrationStepType.RemoveFile,
          description: `Remove legacy bootstrap file: ${legacyPath}`,
          path: legacyPath,
        });
      }
    }

    return steps;
  }

  private async planBootstrapCreationStep(
    projectRoot: string,
    from: AgentHarness,
    to: AgentHarness,
  ): Promise<MigrationStep[]> {
    const toBootstrap = findBootstrapForHarness(to);
    if (!toBootstrap || toBootstrap.harness === from) return [];

    const fullPath = join(projectRoot, toBootstrap.relativePath);
    const exists = await pathExists(fullPath);
    if (exists) return [];

    return [{
      type: MigrationStepType.CreateFile,
      description: `Create bootstrap file: ${toBootstrap.relativePath}`,
      path: toBootstrap.relativePath,
      content: toBootstrap.expectedContent,
    }];
  }
}

export class ConventionMigrationStrategy implements MigrationStrategy {
  public readonly name = "convention-update";

  canHandle(context: MigrationContext): boolean {
    return context.from !== undefined && context.to !== undefined && context.from === context.to;
  }

  async plan(context: MigrationContext): Promise<MigrationPlan> {
    const { projectRoot, from } = context;
    if (!from) return NO_CHANGES_PLAN;

    const bootstrap = findBootstrapForHarness(from);
    if (!bootstrap) return NO_CHANGES_PLAN;

    const steps: MigrationStep[] = [];
    const fullPath = join(projectRoot, bootstrap.relativePath);
    const exists = await pathExists(fullPath);

    if (exists) {
      const currentContent = await readFile(fullPath, "utf-8");
      if (currentContent !== bootstrap.expectedContent) {
        const mergedContent = mergeBootstrapContent(currentContent, bootstrap.expectedContent);
        steps.push({
          type: MigrationStepType.ModifyFile,
          description: `Update bootstrap file to current convention: ${bootstrap.relativePath}`,
          path: bootstrap.relativePath,
          content: mergedContent,
        });
      }
    } else {
      steps.push({
        type: MigrationStepType.CreateFile,
        description: `Create bootstrap file with current convention: ${bootstrap.relativePath}`,
        path: bootstrap.relativePath,
        content: bootstrap.expectedContent,
      });
    }

    return {
      strategyName: this.name,
      description: `Update ${from} bootstrap to current convention`,
      steps,
      hasChanges: steps.length > 0,
    };
  }
}

export class GlobalAdoptionStrategy implements MigrationStrategy {
  public readonly name = "global-adoption";

  canHandle(context: MigrationContext): boolean {
    return context.from === undefined && context.to === undefined && context.config !== null;
  }

  async plan(context: MigrationContext): Promise<MigrationPlan> {
    const steps: MigrationStep[] = [];

    const configHarnesses = context.config?.agentHarnesses ?? [];
    for (const harness of configHarnesses) {
      const bootstrap = findBootstrapForHarness(harness);
      if (!bootstrap) continue;

      const fullPath = join(context.projectRoot, bootstrap.relativePath);
      const exists = await pathExists(fullPath);
      if (!exists) {
        steps.push({
          type: MigrationStepType.CreateFile,
          description: `Create missing bootstrap file: ${bootstrap.relativePath} (${harness})`,
          path: bootstrap.relativePath,
          content: bootstrap.expectedContent,
        });
      }
    }

    return {
      strategyName: this.name,
      description: "Adopt missing bootstrap files for configured harnesses",
      steps,
      hasChanges: steps.length > 0,
    };
  }
}

export const ALL_STRATEGIES: readonly MigrationStrategy[] = [
  new HarnessMigrationStrategy(),
  new ConventionMigrationStrategy(),
  new GlobalAdoptionStrategy(),
];

export function selectStrategy(context: MigrationContext): MigrationStrategy | null {
  for (const strategy of ALL_STRATEGIES) {
    if (strategy.canHandle(context)) {
      return strategy;
    }
  }
  return null;
}

function findBootstrapForHarness(harness: AgentHarness): (typeof BOOTSTRAP_REGISTRY)[number] | undefined {
  return BOOTSTRAP_REGISTRY.find((entry) => entry.harness === harness);
}

function isBootstrapStillNeeded(bootstrapPath: string, targetHarness: AgentHarness): boolean {
  const targetBootstrap = findBootstrapForHarness(targetHarness);
  if (!targetBootstrap) return false;
  return targetBootstrap.relativePath === bootstrapPath;
}

function buildNewHarnessList(
  current: readonly AgentHarness[],
  remove: AgentHarness,
  add: AgentHarness,
): AgentHarness[] {
  const filtered = current.filter((h) => h !== remove);
  if (!filtered.includes(add)) {
    filtered.push(add);
  }
  return filtered;
}

export function resolveHarnessName(input: string): AgentHarness | null {
  const normalized = input.toLowerCase().trim();
  const entries = Object.entries(HARNESS_REGISTRY) as Array<[AgentHarness, HarnessCapability]>;
  for (const [key] of entries) {
    if (key === normalized) return key;
  }
  for (const [key] of entries) {
    if (key.replace(/-/g, "") === normalized.replace(/-/g, "")) return key;
  }
  return null;
}

/**
 * Merges updated bootstrap content with any user-appended content from the
 * existing file. If the current file starts with the expected content, any
 * trailing content is preserved. Otherwise, if the expected content appears
 * somewhere in the file, content after it is preserved. If neither pattern
 * matches, the entire file is replaced with the expected content.
 */
function mergeBootstrapContent(currentContent: string, expectedContent: string): string {
  if (currentContent.startsWith(expectedContent)) {
    const trailingContent = currentContent.slice(expectedContent.length);
    if (trailingContent.trim()) {
      return expectedContent + "\n" + trailingContent.trimStart();
    }
    return expectedContent;
  }

  const expectedIndex = currentContent.indexOf(expectedContent);
  if (expectedIndex >= 0) {
    const afterExpected = currentContent.slice(expectedIndex + expectedContent.length);
    if (afterExpected.trim()) {
      return expectedContent + "\n" + afterExpected.trimStart();
    }
    return expectedContent;
  }

  return expectedContent;
}
