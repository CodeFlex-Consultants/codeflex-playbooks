import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const RULE_ID_PATTERN = /^[A-Z][A-Z0-9]*-\d+$/;

export function isRuleId(value: string): boolean {
  return RULE_ID_PATTERN.test(value);
}

export async function loadSkillMd(skillDir: string): Promise<string | undefined> {
  try {
    return await readFile(join(skillDir, "SKILL.md"), "utf-8");
  } catch {
    return undefined;
  }
}

export function extractRuleText(content: string, ruleId: string): string {
  const lines = content.split("\n");
  let capturing = false;
  let captureLevel = 0;
  const captured: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      const hashes = headingMatch[1];
      const headingText = headingMatch[2];
      if (!hashes || !headingText) {
        if (capturing) {
          captured.push(line);
        }
        continue;
      }
      if (capturing) {
        if (hashes.length <= captureLevel) {
          break;
        }
      }
      if (headingText.includes(ruleId)) {
        capturing = true;
        captureLevel = hashes.length;
        continue;
      }
    }
    if (capturing) {
      captured.push(line);
    }
  }

  return captured.join("\n").trim();
}
