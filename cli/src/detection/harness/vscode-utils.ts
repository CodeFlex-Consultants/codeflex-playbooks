import { homedir } from "node:os";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

export type VSCodeExtensionScan = Set<string>;

// NOTE: This list must only contain genuine VS Code / VS Code Insiders / VSCodium
// (and their remote/WSL "-server" counterparts) extension directories. Do NOT add
// Cursor's extensions directory here: Cursor is itself a VS Code fork with its own
// separate extensions folder, and an extension found there (e.g. a Copilot
// extension) should not count as evidence of genuine VS Code usage. Cursor is
// detected independently via its own app-bundle/config-dir signals in `cursor.ts`.
export const VSCODE_EXTENSION_DIRS = [
  ".vscode/extensions",
  ".vscode-insiders/extensions",
  ".vscode-server/extensions",
  ".vscode-server-insiders/extensions",
  ".vscode-oss/extensions",
];

const EXTENSION_DIR_PATTERN = /^(.+)-(\d+\..*)$/;

export async function scanVSCodeExtensions(): Promise<Set<string>> {
  const home = homedir();
  const extensions = new Set<string>();

  for (const relativeDir of VSCODE_EXTENSION_DIRS) {
    const dirPath = join(home, relativeDir);
    let entries: string[];

    try {
      entries = await readdir(dirPath);
    } catch {
      continue;
    }

    for (const entry of entries) {
      const extensionId = extractExtensionId(entry);
      if (extensionId) {
        extensions.add(extensionId);
      }
    }
  }

  return extensions;
}

function extractExtensionId(dirName: string): string | undefined {
  const match = dirName.match(EXTENSION_DIR_PATTERN);
  if (!match) {
    return undefined;
  }
  return match[1];
}
