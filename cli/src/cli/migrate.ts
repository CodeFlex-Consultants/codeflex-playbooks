import type { Command } from "commander";
import { buildContext } from "./context";
import { formatHumanReadable, type OutputLine } from "./output-formatter";
import { loadConfig } from "../config/index";
import { OutputStyle, type EngineeringConfig } from "../types/index";
import { ConfigValidationError } from "../utils/errors";
import { createReporterFromCommand, consoleReporter, type Reporter } from "./reporter";
import { HARNESS_REGISTRY } from "../projection/registry";
import {
  selectStrategy,
  resolveHarnessName,
  type MigrationContext,
  type MigrationPlan,
} from "./migration-strategies";
import { executeMigration } from "./migration-executor";
import { reportPlan } from "./migrate-formatter";
import { CLI_NAME } from "../constants";

export interface RunMigrateOptions {
  from?: string;
  to?: string;
  check?: boolean;
  apply?: boolean;
  reporter?: Reporter;
}

export interface MigrateResult {
  readonly plan: MigrationPlan;
  readonly applied: boolean;
  readonly backups: readonly string[];
}

export async function runMigrate(projectRoot: string, options: RunMigrateOptions = {}): Promise<MigrateResult> {
  const reporter = options.reporter ?? consoleReporter;
  const isCheck = options.check ?? false;
  const isApply = options.apply ?? false;

  const config = await loadConfig(projectRoot);

  const fromHarness = options.from ? (resolveHarnessName(options.from) ?? undefined) : undefined;
  const toHarness = options.to ? (resolveHarnessName(options.to) ?? undefined) : undefined;

  if (options.from && !fromHarness) {
    throw new ConfigValidationError(`Unknown harness: '${options.from}'. Valid harnesses: ${listValidHarnesses()}`);
  }
  if (options.to && !toHarness) {
    throw new ConfigValidationError(`Unknown harness: '${options.to}'. Valid harnesses: ${listValidHarnesses()}`);
  }

  if (isCheck && !options.from && !options.to) {
    return runCheckMigration(projectRoot, config, reporter);
  }

  const context: MigrationContext = {
    projectRoot,
    from: fromHarness,
    to: toHarness,
    config,
  };

  const planResult = await planMigration(context, reporter, {
    onNoStrategy: () => {
      throw new ConfigValidationError(
        "No applicable migration strategy found. Specify --from and --to, or use --check."
      );
    },
  });

  if (!planResult) {
    return { plan: { strategyName: "none", description: "No migration needed", steps: [], hasChanges: false }, applied: false, backups: [] };
  }

  if (isCheck) {
    reportPlan(reporter, planResult, "Migration available");
    return { plan: planResult, applied: false, backups: [] };
  }

  if (!isApply) {
    reportPlan(reporter, planResult, "Dry run");
    const lines: OutputLine[] = [
      { indent: 0, text: "" },
      { indent: 1, text: "Run with --apply to perform this migration.", style: OutputStyle.Dim },
    ];
    reporter.info(formatHumanReadable(lines));
    return { plan: planResult, applied: false, backups: [] };
  }

  const backups = await executeMigration(projectRoot, planResult, config, reporter);
  reportPlan(reporter, planResult, "Migration applied");

  return { plan: planResult, applied: true, backups };
}

async function runCheckMigration(
  projectRoot: string,
  config: EngineeringConfig | null,
  reporter: Reporter,
): Promise<MigrateResult> {
  const lines: OutputLine[] = [];

  if (!config) {
    lines.push({ indent: 0, text: "Not initialized.", style: OutputStyle.Warning });
    lines.push({ indent: 1, text: `Run '${CLI_NAME} init' first.`, style: OutputStyle.Dim });
    reporter.info(formatHumanReadable(lines));
    return {
      plan: { strategyName: "none", description: "Not initialized", steps: [], hasChanges: false },
      applied: false,
      backups: [],
    };
  }

  const context: MigrationContext = { projectRoot, config };
  const plan = await planMigration(context, reporter, {
    onNoStrategy: () => {
      lines.push({ indent: 0, text: "No migration strategies applicable.", style: OutputStyle.Success });
      reporter.info(formatHumanReadable(lines));
    },
  });

  if (!plan) {
    return {
      plan: { strategyName: "none", description: "No migration needed", steps: [], hasChanges: false },
      applied: false,
      backups: [],
    };
  }

  reportPlan(reporter, plan, "Migration available");
  return { plan, applied: false, backups: [] };
}

interface PlanMigrationOptions {
  onNoStrategy: () => void;
}

async function planMigration(
  context: MigrationContext,
  reporter: Reporter,
  options: PlanMigrationOptions,
): Promise<MigrationPlan | null> {
  const strategy = selectStrategy(context);
  if (!strategy) {
    options.onNoStrategy();
    return null;
  }

  const plan = await strategy.plan(context);

  if (!plan.hasChanges) {
    const lines: OutputLine[] = [
      { indent: 0, text: "No migration needed.", style: OutputStyle.Success },
      { indent: 0, text: "" },
      { indent: 1, text: `Strategy: ${plan.strategyName}`, style: OutputStyle.Dim },
      { indent: 1, text: plan.description, style: OutputStyle.Dim },
    ];
    reporter.info(formatHumanReadable(lines));
    return null;
  }

  return plan;
}

function listValidHarnesses(): string {
  return Object.keys(HARNESS_REGISTRY).join(", ");
}

export function registerMigrateCommand(program: Command): void {
  program
    .command("migrate")
    .description("Migrate project harness configuration between setups")
    .option("--from <harness>", "Source harness to migrate from")
    .option("--to <harness>", "Target harness to migrate to")
    .option("--check", "Check if migration is needed without making changes")
    .option("--apply", "Actually perform the migration (default is dry-run)")
    .action(async (options: { from?: string; to?: string; check?: boolean; apply?: boolean }, command: Command) => {
      const reporter = createReporterFromCommand(command);
      const context = await buildContext({ dryRun: !options.apply });
      await runMigrate(context.projectRoot, { ...options, reporter });
    });
}
