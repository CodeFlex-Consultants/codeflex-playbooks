import { dirname } from "node:path";

export function deriveScope(filePath: string): string | undefined {
  const dir = dirname(filePath);
  if (dir === ".") return undefined;
  const normalizedDir = dir.replace(/\\/g, "/");
  return `${normalizedDir}/**`;
}
