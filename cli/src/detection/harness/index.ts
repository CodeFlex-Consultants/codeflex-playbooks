import { AgentHarness } from "../../types/index";
import { DetectionConfidence, SurfaceType } from "./types";
import type {
  HarnessDetectionResult,
  HarnessSignalDefinition,
  DetectionEvidence,
} from "./types";
import { HARNESS_SIGNAL_REGISTRY } from "./signal-registry";
import { scanVSCodeExtensions } from "./vscode-utils";
import { detectCodex } from "./detectors/codex";
import { detectClaudeCode } from "./detectors/claude-code";
import { detectOpenCode } from "./detectors/opencode";
import { detectKilo } from "./detectors/kilo";
import { detectCopilot } from "./detectors/copilot";
import { detectCursor } from "./detectors/cursor";
import { detectDevin } from "./detectors/devin";
import { detectGeminiCli } from "./detectors/gemini-cli";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import {
  calculateConfidence,
  checkCliWithVersion,
  checkJetBrainsPlugin,
} from "./helpers";
import type { ConfidenceSignal } from "./helpers";
import { pathExists } from "../../utils/fs";
import { checkAppBundle, appNameCandidates } from "./app-bundle";
import { resolveConfigPaths } from "./platform-paths";

interface DetectionContext {
  readonly homeDir: string;
  readonly projectRoot: string;
  readonly vsCodeExtensions: ReadonlySet<string>;
  readonly currentPlatform: NodeJS.Platform;
}

const CONFIDENCE_RANK: Record<DetectionConfidence, number> = {
  [DetectionConfidence.High]: 3,
  [DetectionConfidence.Medium]: 2,
  [DetectionConfidence.Low]: 1,
  [DetectionConfidence.None]: 0,
};

const DEDICATED_DETECTORS: Partial<
  Record<AgentHarness, (ctx: DetectionContext) => Promise<HarnessDetectionResult>>
> = {
  [AgentHarness.Codex]: () => detectCodex(),
  [AgentHarness.ClaudeCode]: () => detectClaudeCode(),
  [AgentHarness.OpenCode]: () => detectOpenCode(),
  [AgentHarness.Kilo]: (ctx) => detectKilo(ctx.vsCodeExtensions as Set<string>),
  [AgentHarness.Copilot]: (ctx) => detectCopilot(ctx.vsCodeExtensions as Set<string>),
  [AgentHarness.Cursor]: () => detectCursor(),
  [AgentHarness.Devin]: () => detectDevin(),
  [AgentHarness.GeminiCli]: (ctx) => detectGeminiCli(ctx.projectRoot),
};

export async function detectHarnesses(
  projectRoot: string,
): Promise<HarnessDetectionResult[]> {
  const context: DetectionContext = {
    homeDir: homedir(),
    projectRoot,
    vsCodeExtensions: await scanVSCodeExtensions(),
    currentPlatform: platform(),
  };

  const harnesses = Object.values(AgentHarness);

  // Run all detectors in parallel for better performance
  const detectionPromises = harnesses.map(async (harness) => {
    const dedicatedDetector = DEDICATED_DETECTORS[harness];

    let result: HarnessDetectionResult | undefined;

    if (dedicatedDetector) {
      result = await dedicatedDetector(context);
    } else {
      const signals = HARNESS_SIGNAL_REGISTRY[harness];
      if (signals) {
        result = await detectViaRegistry(harness, signals, context);
      }
    }

    return result;
  });

  const allResults = await Promise.all(detectionPromises);
  const results = allResults.filter(
    (result): result is HarnessDetectionResult =>
      result !== undefined && result.confidence !== DetectionConfidence.None
  );

  return results.sort(
    (a, b) => CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence],
  );
}

async function detectViaRegistry(
  harness: AgentHarness,
  signals: HarnessSignalDefinition[],
  context: DetectionContext,
): Promise<HarnessDetectionResult | undefined> {
  const evidence: DetectionEvidence[] = [];
  const surfaces = new Set<SurfaceType>();
  const confidenceSignals: ConfidenceSignal[] = [];

  for (const signal of signals) {
    const found = await checkSignal(signal, context);
    evidence.push({
      signal: signal.description,
      value: signal.check,
      found,
    });
    confidenceSignals.push({ reliability: signal.reliability, found });

    if (found) {
      surfaces.add(signal.type);
    }
  }

  if (surfaces.size === 0) {
    return undefined;
  }

  return {
    harness,
    surfaces: [...surfaces],
    confidence: calculateConfidence(confidenceSignals),
    evidence,
  };
}

async function checkSignal(
  signal: HarnessSignalDefinition,
  context: DetectionContext,
): Promise<boolean> {
  switch (signal.type) {
    case SurfaceType.CLI: {
      const result = await checkCliWithVersion(signal.check);
      return result.found;
    }
    case SurfaceType.VSCodeExtension:
      return context.vsCodeExtensions.has(signal.check);
    case SurfaceType.ConfigDir:
      return checkConfigPath(signal.check, context);
    case SurfaceType.AppBundle: {
      const result = await checkAppBundle(appNameCandidates(signal.check));
      return result.found;
    }
    case SurfaceType.JetBrainsPlugin:
      return checkJetBrainsPlugin(signal.check, context.homeDir);
    case SurfaceType.ProjectFile:
      return pathExists(join(context.projectRoot, signal.check));
    default:
      return false;
  }
}

async function checkConfigPath(
  check: string,
  context: DetectionContext,
): Promise<boolean> {
  const paths = resolveConfigPaths(check, context.homeDir, context.currentPlatform);

  for (const p of paths) {
    if (await pathExists(p)) {
      return true;
    }
  }

  return false;
}
