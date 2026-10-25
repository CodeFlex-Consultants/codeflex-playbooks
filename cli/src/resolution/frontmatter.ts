import { parse } from "yaml";
import { FrontmatterParseError } from "../utils/errors";

export interface FrontmatterResult {
  metadata: Record<string, unknown>;
  body: string;
}

export function parseFrontmatter(content: string): FrontmatterResult {
  const lines = content.split("\n");

  if (lines[0]?.trim() !== "---") {
    throw new FrontmatterParseError("Frontmatter must start with ---");
  }

  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === "---") {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) {
    throw new FrontmatterParseError("Frontmatter must end with ---");
  }

  const yamlContent = lines.slice(1, endIndex).join("\n");
  const body = lines.slice(endIndex + 1).join("\n").trim();

  const parsed = parse(yamlContent);
  if (parsed === null || typeof parsed !== "object") {
    return { metadata: {}, body };
  }

  return { metadata: parsed as Record<string, unknown>, body };
}
