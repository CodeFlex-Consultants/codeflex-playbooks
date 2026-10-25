import chalk from "chalk";
import { OutputStyle } from "../types/index";
import type { EngineeringConfig } from "../types/index";
import { BOOTSTRAP_REGISTRY } from "../agents-md/bootstrap-registry";

export interface OutputLine {
  indent: number;
  text: string;
  style?: OutputStyle;
}

export function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

export function formatHumanReadable(lines: OutputLine[]): string {
  return lines
    .map((line) => {
      const indent = "  ".repeat(line.indent);
      let text = line.text;

      if (line.style === OutputStyle.Bold) {
        text = chalk.bold(text);
      } else if (line.style === OutputStyle.Dim) {
        text = chalk.dim(text);
      } else if (line.style === OutputStyle.Success) {
        text = chalk.green(text);
      } else if (line.style === OutputStyle.Warning) {
        text = chalk.yellow(text);
      } else if (line.style === OutputStyle.Error) {
        text = chalk.red(text);
      }

      return indent + text;
    })
    .join("\n");
}

export function buildBootstrapStatusLines(config: EngineeringConfig): OutputLine[] {
  return BOOTSTRAP_REGISTRY.map((entry) => ({
    indent: 1 as const,
    text: `${entry.relativePath}: ${config.agentHarnesses.includes(entry.harness) ? "generated" : "skipped"}`,
  }));
}
