import { join } from "node:path";
import { readFileWithLimit } from "./fs";

export { stripVersionPrefix } from "./version";

export interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export async function parsePackageJson(
  projectRoot: string,
  filePath: string
): Promise<PackageJson | undefined> {
  try {
    const content = await readFileWithLimit(join(projectRoot, filePath));
    return JSON.parse(content) as PackageJson;
  } catch {
    return undefined;
  }
}

export function findDependencyVersion(
  pkg: PackageJson,
  name: string
): string | undefined {
  return pkg.dependencies?.[name] ?? pkg.devDependencies?.[name];
}
