import { join } from "node:path";

export function resolveConfigPaths(
  check: string,
  homeDir: string,
  currentPlatform: NodeJS.Platform,
): string[] {
  const paths: string[] = [];

  if (check.startsWith("$")) {
    const slashIndex = check.indexOf("/");
    const envVarName = slashIndex >= 0 ? check.substring(1, slashIndex) : check.substring(1);
    const subPath = slashIndex >= 0 ? check.substring(slashIndex + 1) : "";
    const envValue = process.env[envVarName];

    if (envValue) {
      paths.push(subPath ? join(envValue, subPath) : envValue);
    }

    return paths;
  }

  paths.push(join(homeDir, check));

  if (currentPlatform === "linux" && check.startsWith(".config/")) {
    const xdgHome = process.env["XDG_CONFIG_HOME"];
    if (xdgHome) {
      paths.push(join(xdgHome, check.substring(".config/".length)));
    }
  }

  if (currentPlatform === "win32") {
    const appData = process.env["APPDATA"];
    if (appData && check.startsWith(".config/")) {
      paths.push(join(appData, check.substring(".config/".length)));
    }
  }

  return paths;
}
