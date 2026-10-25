import { OutputStyle } from "../types/index";
import type { OutputLine } from "./output-formatter";
import { formatHumanReadable } from "./output-formatter";
import type { Reporter } from "./reporter";
import { MigrationStepType, type MigrationPlan } from "./migration-strategies";

export function reportPlan(reporter: Reporter, plan: MigrationPlan, header: string): void {
  const lines: OutputLine[] = [
    { indent: 0, text: `${header}:`, style: OutputStyle.Bold },
    { indent: 0, text: "" },
    { indent: 1, text: `Strategy: ${plan.strategyName}` },
    { indent: 1, text: plan.description },
    { indent: 0, text: "" },
    { indent: 1, text: `Steps (${plan.steps.length}):`, style: OutputStyle.Bold },
  ];

  for (const step of plan.steps) {
    const prefix = stepTypePrefix(step.type);
    lines.push({ indent: 2, text: `${prefix} ${step.description}`, style: stepTypeStyle(step.type) });
  }

  reporter.info(formatHumanReadable(lines));
}

export function stepTypePrefix(type: MigrationStepType): string {
  switch (type) {
    case MigrationStepType.UpdateConfig: return "[cfg]";
    case MigrationStepType.CreateFile: return "[+]";
    case MigrationStepType.RemoveFile: return "[-]";
    case MigrationStepType.ModifyFile: return "[~]";
  }
}

export function stepTypeStyle(type: MigrationStepType): OutputStyle {
  switch (type) {
    case MigrationStepType.UpdateConfig: return OutputStyle.Warning;
    case MigrationStepType.CreateFile: return OutputStyle.Success;
    case MigrationStepType.RemoveFile: return OutputStyle.Error;
    case MigrationStepType.ModifyFile: return OutputStyle.Warning;
  }
}
