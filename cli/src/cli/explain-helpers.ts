import type { OutputLine } from "./output-formatter";
import type { LoadedSkill, ResolutionResult } from "../types/index";
import { SkillSource, OverridePolicy, OutputStyle } from "../types/index";
import { CodeFlexError } from "../utils/errors";
import { loadSkillMd, extractRuleText } from "../utils/markdown";

export async function explainRule(
  ruleId: string,
  allSkills: LoadedSkill[],
  resolution: ResolutionResult,
): Promise<OutputLine[]> {
  const definingSkills = allSkills.filter(
    (s) => s.metadata.rules?.includes(ruleId) ?? false,
  );

  if (definingSkills.length === 0) {
    throw new CodeFlexError(
      `Rule '${ruleId}' is not defined by any installed skill.`,
      "RULE_NOT_FOUND",
    );
  }

  const lines: OutputLine[] = [
    { indent: 0, text: `Rule: ${ruleId}`, style: OutputStyle.Bold },
    { indent: 0, text: "" },
  ];

  const overriddenBy = resolution.overrides[ruleId];

  const codeflexDefining = definingSkills.find((s) => s.source === SkillSource.CodeFlex);
  if (codeflexDefining) {
    const skillMd = await loadSkillMd(codeflexDefining.skillDir);
    const ruleText = skillMd ? extractRuleText(skillMd, ruleId) : "";
    const label = overriddenBy ? "CodeFlex default" : "Defined by";
    lines.push({ indent: 1, text: `${label} (${codeflexDefining.slug}):`, style: OutputStyle.Bold });
    if (ruleText) {
      for (const textLine of ruleText.split("\n")) {
        lines.push({ indent: 2, text: textLine });
      }
    } else {
      lines.push({ indent: 2, text: "(no rule text found in SKILL.md)", style: OutputStyle.Dim });
    }
    if (codeflexDefining.metadata.overridePolicy === OverridePolicy.Required) {
      lines.push({ indent: 2, text: "Non-overridable", style: OutputStyle.Warning });
    }
  } else {
    for (const skill of definingSkills) {
      lines.push({ indent: 1, text: `Defined by: ${skill.slug} (${skill.source})` });
      if (skill.metadata.overridePolicy === OverridePolicy.Required) {
        lines.push({ indent: 2, text: "Non-overridable", style: OutputStyle.Warning });
      }
    }
  }

  lines.push({ indent: 0, text: "" });

  if (overriddenBy) {
    lines.push({ indent: 1, text: "Status: overridden", style: OutputStyle.Warning });
    lines.push({ indent: 0, text: "" });

    const overridingSkill = allSkills.find((s) => s.slug === overriddenBy);
    if (overridingSkill) {
      const skillMd = await loadSkillMd(overridingSkill.skillDir);
      const ruleText = skillMd ? extractRuleText(skillMd, ruleId) : "";
      lines.push({ indent: 1, text: `Override source (${overridingSkill.slug}):`, style: OutputStyle.Bold });
      if (ruleText) {
        for (const textLine of ruleText.split("\n")) {
          lines.push({ indent: 2, text: textLine });
        }
      } else {
        lines.push({ indent: 2, text: "(no rule text found in SKILL.md)", style: OutputStyle.Dim });
      }
    } else {
      lines.push({ indent: 1, text: `Override source: ${overriddenBy}`, style: OutputStyle.Warning });
    }
  } else {
    lines.push({ indent: 1, text: "Status: active" });
  }

  const activeException = resolution.exceptions.active.find((e) => e.rule === ruleId);
  if (activeException) {
    lines.push({ indent: 0, text: "" });
    lines.push({ indent: 1, text: "Exception: active", style: OutputStyle.Warning });
    if (activeException.reason) {
      lines.push({ indent: 2, text: `Reason: ${activeException.reason}` });
    }
    if (activeException.expires) {
      lines.push({ indent: 2, text: `Expires: ${activeException.expires}` });
    }
    if (activeException.approvedBy) {
      lines.push({ indent: 2, text: `Approved by: ${activeException.approvedBy}` });
    }
  } else {
    const expiredException = resolution.exceptions.expired.find((e) => e.rule === ruleId);
    if (expiredException) {
      lines.push({ indent: 1, text: "Exception: expired", style: OutputStyle.Dim });
    }
  }

  const conflict = resolution.conflicts.find((c) => c.rule === ruleId);
  if (conflict && !conflict.resolved) {
    lines.push({ indent: 1, text: `Conflict: unresolved`, style: OutputStyle.Warning });
    lines.push({ indent: 2, text: `Sources: ${conflict.sources.join(", ")}` });
  }

  return lines;
}
