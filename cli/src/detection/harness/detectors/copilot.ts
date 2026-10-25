import { homedir } from "node:os";
import { join } from "node:path";
import { AgentHarness } from "../../../types/index";
import { SurfaceType, type HarnessDetectionResult } from "../types";
import { HARNESS_SIGNAL_REGISTRY } from "../signal-registry";
import { checkJetBrainsPlugin } from "../helpers";
import { DetectorBuilder } from "../detector-builder";
import { pathExists } from "../../../utils/fs";
import { VSCODE_EXTENSION_DIRS } from "../vscode-utils";

const signals = HARNESS_SIGNAL_REGISTRY[AgentHarness.Copilot];
const vscodeSignals = signals.filter((s) => s.type === SurfaceType.VSCodeExtension);
const jetbrainsSignal = signals.find((s) => s.type === SurfaceType.JetBrainsPlugin)!;

async function checkExtensionGlobalStorage(extensionId: string): Promise<boolean> {
  for (const extensionDir of VSCODE_EXTENSION_DIRS) {
    const found = await pathExists(
      join(homedir(), extensionDir, extensionId, "globalStorage"),
    );
    if (found) {
      return true;
    }
  }
  return false;
}

export async function detectCopilot(vsCodeExtensions: Set<string>): Promise<HarnessDetectionResult> {
  const builder = new DetectorBuilder(AgentHarness.Copilot);

  let copilotExtensionFound = false;

  for (const signal of vscodeSignals) {
    const found = vsCodeExtensions.has(signal.check);
    builder.addCheck({
      signal: signal.description,
      value: signal.check,
      found,
      surface: SurfaceType.VSCodeExtension,
      reliability: signal.reliability,
    });
    if (found && signal.check === "GitHub.copilot") {
      copilotExtensionFound = true;
    }
  }

  if (copilotExtensionFound) {
    const storageFound = await checkExtensionGlobalStorage("GitHub.copilot");
    builder.addCheck({
      signal: "extension-global-storage",
      value: "globalStorage/GitHub.copilot/",
      found: storageFound,
      reliability: "medium",
    });
  }

  const jetbrainsPluginFound = await checkJetBrainsPlugin(
    jetbrainsSignal.check,
    homedir(),
  );
  builder.addCheck({
    signal: jetbrainsSignal.description,
    value: jetbrainsSignal.check,
    found: jetbrainsPluginFound,
    surface: SurfaceType.JetBrainsPlugin,
    reliability: jetbrainsSignal.reliability,
  });

  return builder.build();
}
