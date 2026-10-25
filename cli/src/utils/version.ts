export function stripVersionPrefix(version: string): string {
  return version.replace(/^[~^>=<]+/, "");
}

export function normalizeVersion(version: string): string | undefined {
  const m = version.match(/^(\d+(?:\.\d+)?(?:\.\d+)?)/);
  return m?.[1];
}
