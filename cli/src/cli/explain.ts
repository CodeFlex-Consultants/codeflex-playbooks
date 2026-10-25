import type { Command } from "commander";
import { buildContext } from "./context";
import { formatHumanReadable, type OutputLine } from "./output-formatter";
import { loadConfig, loadLock, skillsDir } from "../config/index";
import { detectProject } from "../detection/index";
import { resolveStandards } from "../resolution/index";
import { loadSkillsFromSource } from "../resolution/skill-loader";
import { CodeFlexError } from "../utils/errors";
import type { ResolutionResult } from "../types/index";
import { SkillSource, OutputStyle } from "../types/index";
import { createReporterFromCommand, consoleReporter, type Reporter } from "./reporter";
import { isRuleId } from "../utils/markdown";
import { buildResolutionFromLock, LOCK_RESOLUTION_NOTE } from "../resolution/lock-resolution";
import { explainRule } from "./explain-helpers";
import { requireInitialized } from "./guards";

export interface RunExplainOptions {
  target?: string;
  force?: boolean;
  reporter?: Reporter;
}

export async function runExplain(projectRoot: string, options: RunExplainOptions = {}): Promise<void> {
  const reporter = options.reporter ?? consoleReporter;
  const force = options.force ?? false;
  const target = options.target;

  const [config, lock] = requireInitialized(
    await loadConfig(projectRoot),
    await loadLock(projectRoot),
  );

  const skillsPath = skillsDir(projectRoot);
  const rawSkills = await loadSkillsFromSource(skillsPath, SkillSource.CodeFlex);
  const allSkills = rawSkills.map(s => ({
    ...s,
    source: s.metadata.source,
  }));

  const codeflexSkills = allSkills.filter(s => s.source === SkillSource.CodeFlex);
  const clientSkills = allSkills.filter(s => s.source === SkillSource.Client);
  const repositorySkills = allSkills.filter(s => s.source === SkillSource.Repository);

  let resolution: ResolutionResult;

  if (force) {
    reporter.info("Detecting technologies...");
    const detection = await detectProject(projectRoot);

    reporter.info("Resolving standards...");
    resolution = await resolveStandards({
      detection,
      config,
      codeflexSkills,
      clientSkills,
      repositorySkills,
    });
  } else {
    resolution = buildResolutionFromLock(lock, allSkills);
  }

  if (target && isRuleId(target)) {
    const combinedSkills = [...codeflexSkills, ...clientSkills, ...repositorySkills];
    const lines = await explainRule(target, combinedSkills, resolution);
    reporter.info(formatHumanReadable(lines));
  } else if (target) {
    const skillData = resolution.skills.find((s) => s.slug === target || s.id === target);

    if (!skillData) {
      throw new CodeFlexError(`Skill '${target}' is not installed.`, "SKILL_NOT_FOUND");
    }

    const explanation = resolution.explanation.find((e) => e.skillId === target);

    const lines: OutputLine[] = [
      { indent: 0, text: `Skill: ${target}`, style: OutputStyle.Bold },
      { indent: 0, text: "" },
      { indent: 1, text: `Source: ${skillData.source}` },
    ];

    if (explanation) {
      lines.push({ indent: 1, text: `Reason: ${explanation.reason}` });

      if (explanation.matchedBy) {
        lines.push({ indent: 1, text: `Matched by: ${explanation.matchedBy}` });
      }

      if (explanation.dependencies.length > 0) {
        lines.push({ indent: 1, text: `Dependencies: ${explanation.dependencies.join(", ")}` });
      }

      if (explanation.overriddenRules.length > 0) {
        lines.push({ indent: 1, text: `Overrides: ${explanation.overriddenRules.join(", ")}` });
      }

      if (explanation.scope && explanation.scope.length > 0) {
        lines.push({ indent: 1, text: `Scope: ${explanation.scope.join(", ")}` });
      }
    }

    if (skillData.scopes && skillData.scopes.length > 0) {
      lines.push({ indent: 1, text: `Applied scopes: ${skillData.scopes.join(", ")}` });
    }

    reporter.info(formatHumanReadable(lines));
  } else {
    const lines: OutputLine[] = [
      { indent: 0, text: "Installed Skills", style: OutputStyle.Bold },
      { indent: 0, text: "" },
    ];

    for (const skillData of resolution.skills) {
      const explanation = resolution.explanation.find((e) => e.skillId === skillData.slug);

      lines.push({ indent: 1, text: skillData.slug, style: OutputStyle.Bold });
      lines.push({ indent: 2, text: `Source: ${skillData.source}`, style: OutputStyle.Dim });

      if (explanation) {
        lines.push({ indent: 2, text: `Reason: ${explanation.reason}`, style: OutputStyle.Dim });
      }

      lines.push({ indent: 0, text: "" });
    }

    if (!force) {
      lines.push({ indent: 0, text: "" });
      lines.push({ indent: 1, text: LOCK_RESOLUTION_NOTE, style: OutputStyle.Dim });
    }

    if (resolution.conflicts.length > 0) {
      lines.push({ indent: 0, text: "Conflicts", style: OutputStyle.Bold });
      lines.push({ indent: 0, text: "" });

      for (const conflict of resolution.conflicts) {
        lines.push({ indent: 1, text: conflict.rule, style: OutputStyle.Warning });
        lines.push({ indent: 2, text: `Sources: ${conflict.sources.join(", ")}`, style: OutputStyle.Dim });
        lines.push({ indent: 2, text: `Non-overridable: ${conflict.nonOverridable}`, style: OutputStyle.Dim });
        lines.push({ indent: 0, text: "" });
      }
    }

    if (resolution.exceptions.active.length > 0) {
      lines.push({ indent: 0, text: "Active Exceptions", style: OutputStyle.Bold });
      lines.push({ indent: 0, text: "" });

      for (const exception of resolution.exceptions.active) {
        lines.push({ indent: 1, text: exception.rule });
        if (exception.expires) {
          lines.push({ indent: 2, text: `Expires: ${exception.expires}`, style: OutputStyle.Dim });
        }
        if (exception.reason) {
          lines.push({ indent: 2, text: `Reason: ${exception.reason}`, style: OutputStyle.Dim });
        }
        if (exception.approvedBy) {
          lines.push({ indent: 2, text: `Approved by: ${exception.approvedBy}`, style: OutputStyle.Dim });
        }
        lines.push({ indent: 0, text: "" });
      }
    }

    if (resolution.unmatchedTechnologies.length > 0) {
      lines.push({ indent: 0, text: "Unmatched Technologies", style: OutputStyle.Bold });
      lines.push({ indent: 0, text: "" });

      for (const tech of resolution.unmatchedTechnologies) {
        lines.push({ indent: 1, text: `${tech.name}${tech.version ? ` @ ${tech.version}` : ""}`, style: OutputStyle.Warning });
        lines.push({ indent: 2, text: `Matched by: ${tech.matchedBy}`, style: OutputStyle.Dim });
        lines.push({ indent: 0, text: "" });
      }
    }

    reporter.info(formatHumanReadable(lines));
  }
}

export function registerExplainCommand(program: Command): void {
  program
    .command("explain [target]")
    .description("Explain why a skill was installed or how a rule was resolved")
    .option("--force", "Re-detect and re-resolve from scratch instead of using locked state")
    .action(async (target: string | undefined, options: { force?: boolean }, command: Command) => {
      const reporter = createReporterFromCommand(command);
      const globalOpts = command.optsWithGlobals() as { projectRoot?: string };
      const context = await buildContext({ projectRoot: globalOpts.projectRoot });
      await runExplain(context.projectRoot, { target, ...options, reporter });
    });
}
