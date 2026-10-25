import type { Command } from "commander";
import { buildContext } from "./context";
import { formatJson, formatHumanReadable, type OutputLine } from "./output-formatter";
import { loadConfig, loadLock, codeflexDir } from "../config/index";
import { pathExists } from "../utils/fs";
import { OutputStyle } from "../types/index";
import type { EngineeringConfig, EngineeringLock } from "../types/index";
import { createReporterFromCommand, consoleReporter, type Reporter } from "./reporter";
import { readCliVersion } from "./version";

function formatStatusJson(
  cliVersion: string,
  config: EngineeringConfig,
  lock: EngineeringLock,
): Record<string, unknown> {
  const codeflexSource = lock.sources.codeflex;
  const clientSources = lock.sources.client ?? [];
  const unmatched = lock.unmatchedTechnologies ?? [];

  return {
    initialized: true,
    cliVersion,
    config: {
      version: config.version,
      harnesses: config.agentHarnesses,
      codeflexEnabled: config.standards.codeflex.enabled,
      clientSources: config.standards.client?.length ?? 0,
    },
    lock: {
      version: lock.version,
      skills: lock.skills.length,
      projections: (lock.projections ?? []).length,
    },
    engineeringSkills: {
      codeflex: codeflexSource
        ? {
            release: codeflexSource.release,
            commit: codeflexSource.commit,
            sha256: codeflexSource.sha256,
          }
        : null,
      client: clientSources.map((c) => ({
        id: c.id,
        source: c.source,
        sha256: c.sha256,
      })),
    },
    unmatchedTechnologies: unmatched.map((t) => ({
      name: t.name,
      ...(t.version ? { version: t.version } : {}),
      matchedBy: t.matchedBy,
    })),
  };
}

function formatStatusHumanReadable(
  cliVersion: string,
  config: EngineeringConfig,
  lock: EngineeringLock,
): OutputLine[] {
  const codeflexSource = lock.sources.codeflex;
  const clientSources = lock.sources.client ?? [];
  const unmatched = lock.unmatchedTechnologies ?? [];

  return [
    { indent: 0, text: "CodeFlex Playbooks Status", style: OutputStyle.Bold },
    { indent: 0, text: "" },
    { indent: 1, text: `CLI version: ${cliVersion}` },
    { indent: 1, text: "Status: Initialized", style: OutputStyle.Success },
    { indent: 0, text: "" },
    { indent: 1, text: "Configuration:", style: OutputStyle.Bold },
    { indent: 2, text: `Version: ${config.version}` },
    { indent: 2, text: `Harnesses: ${config.agentHarnesses.join(", ")}` },
    { indent: 2, text: `CodeFlex baseline: ${config.standards.codeflex.enabled ? "enabled" : "disabled"}` },
    { indent: 2, text: `Client sources: ${config.standards.client?.length ?? 0}` },
    { indent: 0, text: "" },
    { indent: 1, text: "Lock:", style: OutputStyle.Bold },
    { indent: 2, text: `Version: ${lock.version}` },
    { indent: 2, text: `Skills: ${lock.skills.length}` },
    { indent: 2, text: `Projections: ${(lock.projections ?? []).length}` },
    { indent: 0, text: "" },
    { indent: 1, text: "Engineering Skills:", style: OutputStyle.Bold },
    ...(codeflexSource
      ? [
          { indent: 2, text: `CodeFlex release: ${codeflexSource.release}` },
          { indent: 2, text: `CodeFlex commit: ${codeflexSource.commit.slice(0, 12)}` },
          { indent: 2, text: `CodeFlex SHA-256: ${codeflexSource.sha256.slice(0, 16)}...` },
        ]
      : [{ indent: 2, text: "CodeFlex release: not locked", style: OutputStyle.Warning }]),
    ...(clientSources.length > 0
      ? [
          { indent: 2, text: "Client sources:" },
          ...clientSources.flatMap((c) => [
            { indent: 3, text: `${c.id}` },
            { indent: 4, text: `Source: ${c.source}` },
            { indent: 4, text: `SHA-256: ${c.sha256.slice(0, 16)}...` },
          ]),
        ]
      : []),
    ...(unmatched.length > 0
      ? [
          { indent: 0, text: "" },
          { indent: 1, text: "Unmatched Technologies:", style: OutputStyle.Warning },
          { indent: 2, text: `${unmatched.length} detected technologies have no corresponding skill`, style: OutputStyle.Dim },
          ...unmatched.flatMap((t) => [
            { indent: 2, text: `${t.name}${t.version ? ` @ ${t.version}` : ""}`, style: OutputStyle.Warning },
            { indent: 3, text: `Matched by: ${t.matchedBy}`, style: OutputStyle.Dim },
          ]),
        ]
      : []),
  ];
}

export interface RunStatusOptions {
  json?: boolean;
  reporter?: Reporter;
}

export async function runStatus(projectRoot: string, options: RunStatusOptions = {}): Promise<void> {
  const reporter = options.reporter ?? consoleReporter;

  const cliVersion = await readCliVersion();

  const codeflexDirPath = codeflexDir(projectRoot);
  const initialized = await pathExists(codeflexDirPath);

  if (!initialized) {
    if (options.json) {
      reporter.info(formatJson({ initialized: false, cliVersion }));
      return;
    }

    const lines = [
      { indent: 0, text: "CodeFlex Playbooks Status", style: OutputStyle.Bold },
      { indent: 0, text: "" },
      { indent: 1, text: `CLI version: ${cliVersion}` },
      { indent: 1, text: "Status: Not initialized", style: OutputStyle.Warning },
      { indent: 0, text: "" },
      { indent: 1, text: "Run 'codeflex-playbooks init' to initialize.", style: OutputStyle.Dim },
    ];

    reporter.info(formatHumanReadable(lines));
    return;
  }

  const config = await loadConfig(projectRoot);
  const lock = await loadLock(projectRoot);

  if (!config || !lock) {
    if (options.json) {
      reporter.info(formatJson({ initialized: true, cliVersion, error: "Missing config or lock" }));
      return;
    }

    const lines = [
      { indent: 0, text: "CodeFlex Playbooks Status", style: OutputStyle.Bold },
      { indent: 0, text: "" },
      { indent: 1, text: `CLI version: ${cliVersion}` },
      { indent: 1, text: "Status: Incomplete initialization", style: OutputStyle.Error },
      { indent: 0, text: "" },
      { indent: 1, text: "Run 'codeflex-playbooks init' to reinitialize.", style: OutputStyle.Dim },
    ];

    reporter.info(formatHumanReadable(lines));
    return;
  }

  if (options.json) {
    reporter.info(formatJson(formatStatusJson(cliVersion, config, lock)));
    return;
  }

  reporter.info(formatHumanReadable(formatStatusHumanReadable(cliVersion, config, lock)));
}

export function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .description("Show CLI and Engineering Skills version status")
    .option("--json", "Output status as JSON")
    .action(async (options: { json?: boolean }, command: Command) => {
      const reporter = createReporterFromCommand(command);
      const context = await buildContext();
      await runStatus(context.projectRoot, { ...options, reporter });
    });
}
