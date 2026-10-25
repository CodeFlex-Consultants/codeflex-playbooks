import type { Command } from "commander";
import { buildContext } from "./context";
import { formatJson, formatHumanReadable, type OutputLine } from "./output-formatter";
import { detectProject } from "../detection/index";
import { detectHarnesses } from "../detection/harness/index";
import { SurfaceType, type HarnessDetectionResult } from "../detection/harness/types";
import { OutputStyle } from "../types/index";
import { createReporterFromCommand, consoleReporter, type Reporter } from "./reporter";

export interface RunDetectOptions {
  json?: boolean;
  reporter?: Reporter;
}

export async function runDetect(projectRoot: string, options: RunDetectOptions = {}): Promise<void> {
  const reporter = options.reporter ?? consoleReporter;
  const [result, harnessResults] = await Promise.all([
    detectProject(projectRoot),
    detectHarnesses(projectRoot),
  ]);

  if (options.json) {
    reporter.info(formatJson({ ...result, harnesses: harnessResults }));
    return;
  }

  const lines: OutputLine[] = [];

  if (result.technologies.length === 0) {
    lines.push({ indent: 0, text: "No technologies detected." });
  } else {
    lines.push({ indent: 0, text: "Detected technologies:", style: OutputStyle.Bold });
    lines.push({ indent: 0, text: "" });

    for (const tech of result.technologies) {
      const version = tech.version ? ` ${tech.version}` : "";
      lines.push({ indent: 1, text: `${tech.name}${version}`, style: OutputStyle.Bold });
      lines.push({ indent: 2, text: `Matched by: ${tech.matchedBy}`, style: OutputStyle.Dim });

      if (tech.scope) {
        lines.push({ indent: 2, text: `Scope: ${tech.scope}`, style: OutputStyle.Dim });
      }

      lines.push({ indent: 0, text: "" });
    }
  }

  lines.push(...formatHarnessLines(harnessResults));

  reporter.info(formatHumanReadable(lines));
}

const SURFACE_LABELS: Record<SurfaceType, string> = {
  [SurfaceType.CLI]: "CLI",
  [SurfaceType.VSCodeExtension]: "VS Code extension",
  [SurfaceType.JetBrainsPlugin]: "JetBrains plugin",
  [SurfaceType.AppBundle]: "App bundle",
  [SurfaceType.ConfigDir]: "config directory",
  [SurfaceType.ProjectFile]: "project file",
};

function formatHarnessLines(harnessResults: HarnessDetectionResult[]): OutputLine[] {
  const lines: OutputLine[] = [];

  lines.push({ indent: 0, text: "Detected harnesses:", style: OutputStyle.Bold });
  lines.push({ indent: 0, text: "" });

  if (harnessResults.length === 0) {
    lines.push({ indent: 1, text: "No harnesses detected." });
    lines.push({ indent: 0, text: "" });
    return lines;
  }

  for (const h of harnessResults) {
    lines.push({ indent: 1, text: `${h.harness} (${h.confidence} confidence)`, style: OutputStyle.Bold });
    lines.push({ indent: 2, text: `Surfaces: ${h.surfaces.map((s) => SURFACE_LABELS[s]).join(", ")}`, style: OutputStyle.Dim });
    lines.push({ indent: 2, text: "Evidence:", style: OutputStyle.Dim });

    for (const e of h.evidence) {
      const status = e.found ? `found${e.value ? ` (${e.value})` : ""}` : "not found";
      lines.push({ indent: 3, text: `- ${e.signal}: ${status}`, style: OutputStyle.Dim });
    }

    lines.push({ indent: 0, text: "" });
  }

  return lines;
}

export function registerDetectCommand(program: Command): void {
  program
    .command("detect")
    .description("Detect project technologies")
    .option("--json", "Output as JSON")
    .action(async (options: { json?: boolean }, command: Command) => {
      const reporter = createReporterFromCommand(command);
      const context = await buildContext();
      await runDetect(context.projectRoot, { ...options, reporter });
    });
}
