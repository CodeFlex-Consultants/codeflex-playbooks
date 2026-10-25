import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readJsonFile } from "../utils/fs";

export async function readCliVersion(): Promise<string> {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const pkg = await readJsonFile<{ version?: string }>(join(__dirname, "..", "..", "package.json"));
  return pkg?.version ?? "unknown";
}
