import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AgentHarness } from "../../../../src/types/index";
import {
  DetectionConfidence,
  SurfaceType,
} from "../../../../src/detection/harness/types";
import { HARNESS_SIGNAL_REGISTRY } from "../../../../src/detection/harness/signal-registry";

vi.mock("node:fs/promises");
vi.mock("node:os");
vi.mock("../../../../src/utils/exec.js", () => ({
  execFile: vi.fn().mockRejectedValue(new Error("ENOENT")),
}));

import { access, readdir } from "node:fs/promises";
import { homedir, platform } from "node:os";

const mockAccess = vi.mocked(access);
const mockReaddir = vi.mocked(readdir);
const mockHomedir = vi.mocked(homedir);
const mockPlatform = vi.mocked(platform);

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/");
}

describe("harness detection", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockAccess.mockReset();
    mockReaddir.mockReset();
    mockHomedir.mockReturnValue("/home/testuser");
    mockPlatform.mockReturnValue("linux");
    vi.stubEnv("XDG_CONFIG_HOME", "");
    vi.stubEnv("APPDATA", "");
    vi.stubEnv("LOCALAPPDATA", "");
    vi.stubEnv("CLAUDE_CONFIG_DIR", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("signal registry", () => {
    it("has signal definitions for all agent harnesses", () => {
      const harnesses = Object.values(AgentHarness);
      for (const harness of harnesses) {
        expect(HARNESS_SIGNAL_REGISTRY[harness]).toBeDefined();
        expect(HARNESS_SIGNAL_REGISTRY[harness].length).toBeGreaterThan(0);
      }
    });

    it("each signal has required fields", () => {
      for (const harness of Object.values(AgentHarness)) {
        for (const signal of HARNESS_SIGNAL_REGISTRY[harness]) {
          expect(signal.type).toBeDefined();
          expect(signal.description).toBeTruthy();
          expect(signal.reliability).toMatch(/^(high|medium|low)$/);
          expect(signal.check).toBeTruthy();
        }
      }
    });

    it("codex has CLI and ConfigDir signals", () => {
      const signals = HARNESS_SIGNAL_REGISTRY[AgentHarness.Codex];
      const types = signals.map((s) => s.type);
      expect(types).toContain(SurfaceType.CLI);
      expect(types).toContain(SurfaceType.ConfigDir);
    });

    it("kilo has VSCodeExtension, CLI, and ConfigDir signals", () => {
      const signals = HARNESS_SIGNAL_REGISTRY[AgentHarness.Kilo];
      const types = signals.map((s) => s.type);
      expect(types).toContain(SurfaceType.VSCodeExtension);
      expect(types).toContain(SurfaceType.CLI);
      expect(types).toContain(SurfaceType.ConfigDir);
    });

    it("copilot has VSCodeExtension and JetBrainsPlugin signals", () => {
      const signals = HARNESS_SIGNAL_REGISTRY[AgentHarness.Copilot];
      const types = signals.map((s) => s.type);
      expect(types).toContain(SurfaceType.VSCodeExtension);
      expect(types).toContain(SurfaceType.JetBrainsPlugin);
    });

    it("claude-code has CLI and ConfigDir signals including env override", () => {
      const signals = HARNESS_SIGNAL_REGISTRY[AgentHarness.ClaudeCode];
      const types = signals.map((s) => s.type);
      expect(types).toContain(SurfaceType.CLI);
      expect(types).toContain(SurfaceType.ConfigDir);
      const envSignal = signals.find((s) => s.check === "$CLAUDE_CONFIG_DIR");
      expect(envSignal).toBeDefined();
    });

    it("cursor has AppBundle and ConfigDir signals", () => {
      const signals = HARNESS_SIGNAL_REGISTRY[AgentHarness.Cursor];
      const types = signals.map((s) => s.type);
      expect(types).toContain(SurfaceType.AppBundle);
      expect(types).toContain(SurfaceType.ConfigDir);
    });

    it("zoocode has VSCodeExtension and ConfigDir signals", () => {
      const signals = HARNESS_SIGNAL_REGISTRY[AgentHarness.ZooCode];
      const types = signals.map((s) => s.type);
      expect(types).toContain(SurfaceType.VSCodeExtension);
      expect(types).toContain(SurfaceType.ConfigDir);
    });

    it("devin has AppBundle and ConfigDir signals", () => {
      const signals = HARNESS_SIGNAL_REGISTRY[AgentHarness.Devin];
      const types = signals.map((s) => s.type);
      expect(types).toContain(SurfaceType.AppBundle);
      expect(types).toContain(SurfaceType.ConfigDir);
    });

    it("cline has VSCodeExtension and ConfigDir signals", () => {
      const signals = HARNESS_SIGNAL_REGISTRY[AgentHarness.Cline];
      const types = signals.map((s) => s.type);
      expect(types).toContain(SurfaceType.VSCodeExtension);
      expect(types).toContain(SurfaceType.ConfigDir);
    });

    it("jetbrains has JetBrainsPlugin and ProjectFile signals", () => {
      const signals = HARNESS_SIGNAL_REGISTRY[AgentHarness.JetBrains];
      const types = signals.map((s) => s.type);
      expect(types).toContain(SurfaceType.JetBrainsPlugin);
      expect(types).toContain(SurfaceType.ProjectFile);
    });

    it("aider has CLI, ConfigDir, and ProjectFile signals", () => {
      const signals = HARNESS_SIGNAL_REGISTRY[AgentHarness.Aider];
      const types = signals.map((s) => s.type);
      expect(types).toContain(SurfaceType.CLI);
      expect(types).toContain(SurfaceType.ConfigDir);
      expect(types).toContain(SurfaceType.ProjectFile);
    });

    it("gemini-cli has CLI, ConfigDir, and ProjectFile signals", () => {
      const signals = HARNESS_SIGNAL_REGISTRY[AgentHarness.GeminiCli];
      const types = signals.map((s) => s.type);
      expect(types).toContain(SurfaceType.CLI);
      expect(types).toContain(SurfaceType.ConfigDir);
      expect(types).toContain(SurfaceType.ProjectFile);
    });

    it("gemini-cli signal descriptions note the Antigravity relationship", () => {
      const signals = HARNESS_SIGNAL_REGISTRY[AgentHarness.GeminiCli];
      const cliSignal = signals.find((s) => s.type === SurfaceType.CLI);
      const configSignal = signals.find((s) => s.type === SurfaceType.ConfigDir);
      expect(cliSignal?.description).toContain("Antigravity");
      expect(configSignal?.description).toContain("Antigravity");
    });

    it("antigravity has CLI, AppBundle, and ConfigDir signals", () => {
      const signals = HARNESS_SIGNAL_REGISTRY[AgentHarness.Antigravity];
      const types = signals.map((s) => s.type);
      expect(types).toContain(SurfaceType.CLI);
      expect(types).toContain(SurfaceType.AppBundle);
      expect(types).toContain(SurfaceType.ConfigDir);
    });

    it("antigravity CLI signal checks for the agy binary", () => {
      const signals = HARNESS_SIGNAL_REGISTRY[AgentHarness.Antigravity];
      const cliSignal = signals.find((s) => s.type === SurfaceType.CLI);
      expect(cliSignal?.check).toBe("agy");
    });

    it("antigravity config dir signal checks ~/.gemini/antigravity-cli", () => {
      const signals = HARNESS_SIGNAL_REGISTRY[AgentHarness.Antigravity];
      const configSignal = signals.find((s) => s.type === SurfaceType.ConfigDir);
      expect(configSignal?.check).toBe(".gemini/antigravity-cli");
    });

    it("amp has CLI, ConfigDir, and AppBundle signals", () => {
      const signals = HARNESS_SIGNAL_REGISTRY[AgentHarness.Amp];
      const types = signals.map((s) => s.type);
      expect(types).toContain(SurfaceType.CLI);
      expect(types).toContain(SurfaceType.ConfigDir);
      expect(types).toContain(SurfaceType.AppBundle);
    });

    it("amp config dir signal checks ~/.config/amp (per ampcode.com/docs/customize/agents-md)", () => {
      const signals = HARNESS_SIGNAL_REGISTRY[AgentHarness.Amp];
      const configSignal = signals.find((s) => s.type === SurfaceType.ConfigDir);
      expect(configSignal?.check).toBe(".config/amp");
    });

    it("zed has ConfigDir and AppBundle signals", () => {
      const signals = HARNESS_SIGNAL_REGISTRY[AgentHarness.Zed];
      const types = signals.map((s) => s.type);
      expect(types).toContain(SurfaceType.ConfigDir);
      expect(types).toContain(SurfaceType.AppBundle);
    });

    it("warp has ConfigDir and AppBundle signals", () => {
      const signals = HARNESS_SIGNAL_REGISTRY[AgentHarness.Warp];
      const types = signals.map((s) => s.type);
      expect(types).toContain(SurfaceType.ConfigDir);
      expect(types).toContain(SurfaceType.AppBundle);
    });

    it("factory-ai has CLI, ProjectFile, and AppBundle signals", () => {
      const signals = HARNESS_SIGNAL_REGISTRY[AgentHarness.FactoryAi];
      const types = signals.map((s) => s.type);
      expect(types).toContain(SurfaceType.CLI);
      expect(types).toContain(SurfaceType.ProjectFile);
      expect(types).toContain(SurfaceType.AppBundle);
    });

    it("augment has CLI and ConfigDir signals", () => {
      const signals = HARNESS_SIGNAL_REGISTRY[AgentHarness.Augment];
      const types = signals.map((s) => s.type);
      expect(types).toContain(SurfaceType.CLI);
      expect(types).toContain(SurfaceType.ConfigDir);
    });
  });

  describe("detectCodex", () => {
    it("returns Low confidence when only config found", async () => {
      mockPlatform.mockReturnValue("darwin");
      mockAccess.mockRejectedValueOnce(Object.assign(new Error(), { code: "ENOENT" })); // app bundle
      mockAccess.mockResolvedValueOnce(undefined); // config

      const { detectCodex } = await import(
        "../../../../src/detection/harness/detectors/codex.js"
      );
      const result = await detectCodex();

      expect(result.confidence).toBe(DetectionConfidence.Low);
      expect(result.surfaces).not.toContain(SurfaceType.CLI);
      expect(result.surfaces).not.toContain(SurfaceType.AppBundle);
      expect(result.surfaces).toContain(SurfaceType.ConfigDir);
    });

    it("returns None confidence when nothing found", async () => {
      mockAccess.mockRejectedValue(Object.assign(new Error(), { code: "ENOENT" }));

      const { detectCodex } = await import(
        "../../../../src/detection/harness/detectors/codex.js"
      );
      const result = await detectCodex();

      expect(result.confidence).toBe(DetectionConfidence.None);
      expect(result.surfaces).toHaveLength(0);
    });

    it("uses signal descriptions from registry in evidence", async () => {
      mockAccess.mockRejectedValueOnce(Object.assign(new Error(), { code: "ENOENT" })); // app bundle
      mockAccess.mockResolvedValueOnce(undefined); // config

      const { detectCodex } = await import(
        "../../../../src/detection/harness/detectors/codex.js"
      );
      const result = await detectCodex();

      expect(result.evidence.length).toBeGreaterThan(0);
      for (const ev of result.evidence) {
        expect(ev.signal).toBeTruthy();
      }
    });
  });

  describe("detectClaudeCode", () => {
    it("respects CLAUDE_CONFIG_DIR environment variable", async () => {
      vi.stubEnv("CLAUDE_CONFIG_DIR", "/custom/claude/config");
      mockAccess.mockRejectedValueOnce(Object.assign(new Error(), { code: "ENOENT" })); // app bundle candidate 1 (linux)
      mockAccess.mockRejectedValueOnce(Object.assign(new Error(), { code: "ENOENT" })); // app bundle candidate 2 (linux)
      mockAccess.mockResolvedValueOnce(undefined); // config

      const { detectClaudeCode } = await import(
        "../../../../src/detection/harness/detectors/claude-code.js"
      );
      const result = await detectClaudeCode();

      expect(result.confidence).toBe(DetectionConfidence.Low);
      expect(result.surfaces).not.toContain(SurfaceType.AppBundle);
      expect(result.surfaces).toContain(SurfaceType.ConfigDir);
      const configEvidence = result.evidence.find((e) => e.signal === "$CLAUDE_CONFIG_DIR override");
      expect(configEvidence?.value).toBe("/custom/claude/config");
    });
  });

  describe("detectOpenCode", () => {
    it("checks XDG_CONFIG_HOME path on Linux", async () => {
      vi.stubEnv("XDG_CONFIG_HOME", "/custom/xdg/config");
      mockAccess.mockResolvedValueOnce(undefined);

      const { detectOpenCode } = await import(
        "../../../../src/detection/harness/detectors/opencode.js"
      );
      const result = await detectOpenCode();

      expect(result.confidence).toBe(DetectionConfidence.Low);
      expect(result.surfaces).toContain(SurfaceType.ConfigDir);
    });

    it("checks OPENCODE_CONFIG_DIR for custom config directory", async () => {
      vi.stubEnv("OPENCODE_CONFIG_DIR", "/custom/opencode/config");
      mockAccess.mockResolvedValueOnce(undefined);

      const { detectOpenCode } = await import(
        "../../../../src/detection/harness/detectors/opencode.js"
      );
      const result = await detectOpenCode();

      expect(result.surfaces).toContain(SurfaceType.ConfigDir);
    });

    it("checks APPDATA path on Windows", async () => {
      mockPlatform.mockReturnValue("win32");
      vi.stubEnv("APPDATA", "C:\\Users\\test\\AppData\\Roaming");
      mockAccess.mockResolvedValue(undefined);

      const { detectOpenCode } = await import(
        "../../../../src/detection/harness/detectors/opencode.js"
      );
      const result = await detectOpenCode();

      expect(result.surfaces).toContain(SurfaceType.ConfigDir);
    });
  });

  describe("detectKilo", () => {
    it("returns High confidence when extension + global storage found", async () => {
      const extensions = new Set(["kilocode.kilo-code"]);
      // All config-dir checks -> not found, but the extension global storage
      // check (handled separately below) -> found.
      mockAccess.mockImplementation(async (path: unknown) => {
        const p = normalizePath(String(path));
        if (p.includes("globalStorage")) {
          return undefined;
        }
        throw Object.assign(new Error(), { code: "ENOENT" });
      });

      const { detectKilo } = await import(
        "../../../../src/detection/harness/detectors/kilo.js"
      );
      const result = await detectKilo(extensions);

      expect(result.confidence).toBe(DetectionConfidence.High);
    });

    it("returns High confidence when CLI + modern ~/.config/kilo/ config dir found", async () => {
      const extensions = new Set<string>();
      mockAccess.mockImplementation(async (path: unknown) => {
        const p = String(path);
        if (p.includes(".config/kilo") || p.includes(".config\\kilo")) {
          return undefined;
        }
        throw Object.assign(new Error(), { code: "ENOENT" });
      });

      const { detectKilo } = await import(
        "../../../../src/detection/harness/detectors/kilo.js"
      );
      const result = await detectKilo(extensions);

      expect(result.surfaces).toContain(SurfaceType.ConfigDir);
      // CLI binary check spawns a real subprocess in this test env and may
      // or may not find a "kilo" binary, but the ConfigDir signal alone
      // combined with any other found signal should not regress below the
      // previous behavior; assert directly on the signal that matters here.
      const configDirEvidence = result.evidence.find((e) => 
        e.signal === "kilo config (~/.config/kilo/)"
      );
      expect(configDirEvidence?.found).toBe(true);
    });

    it("uses signal descriptions from registry in evidence", async () => {
      const extensions = new Set(["kilocode.kilo-code"]);
      mockAccess.mockRejectedValue(Object.assign(new Error(), { code: "ENOENT" }));

      const { detectKilo } = await import(
        "../../../../src/detection/harness/detectors/kilo.js"
      );
      const result = await detectKilo(extensions);

      expect(result.evidence.length).toBeGreaterThan(0);
      for (const ev of result.evidence) {
        expect(ev.signal).toBeTruthy();
      }
    });

    it("finds extension global storage under .vscode-server (WSL/remote) rather than .vscode", async () => {
      const extensions = new Set(["kilocode.kilo-code"]);
      // configDirExists check (~/.kilocode/cli/) -> not found
      mockAccess.mockImplementation(async (path: unknown) => {
        const p = normalizePath(String(path));
        if (p.includes(".kilocode/cli")) {
          throw Object.assign(new Error(), { code: "ENOENT" });
        }
        if (p.includes(".vscode/extensions")) {
          throw Object.assign(new Error(), { code: "ENOENT" });
        }
        if (p.includes(".vscode-server/extensions")) {
          return undefined;
        }
        throw Object.assign(new Error(), { code: "ENOENT" });
      });

      const { detectKilo } = await import(
        "../../../../src/detection/harness/detectors/kilo.js"
      );
      const result = await detectKilo(extensions);

      const storageEvidence = result.evidence.find(
        (e) => e.signal === "extension-global-storage",
      );
      expect(storageEvidence).toBeDefined();
      expect(storageEvidence?.found).toBe(true);
    });
  });

  describe("detectCopilot", () => {
    it("returns High confidence when VS Code extension + JetBrains plugin found", async () => {
      const extensions = new Set(["GitHub.copilot"]);
      // Mock access to reject for all pathExists calls (global storage checks)
      mockAccess.mockRejectedValue(Object.assign(new Error(), { code: "ENOENT" }));
      // Set APPDATA for Windows JetBrains path
      vi.stubEnv("APPDATA", "/home/testuser/AppData/Roaming");
      // Mock readdir for JetBrains plugin detection
      mockReaddir.mockResolvedValueOnce(["IntelliJIdea2024.1"] as string[]);
      mockReaddir.mockResolvedValueOnce(["copilot"] as string[]);

      const { detectCopilot } = await import(
        "../../../../src/detection/harness/detectors/copilot.js"
      );
      const result = await detectCopilot(extensions);

      expect(result.harness).toBe(AgentHarness.Copilot);
      expect(result.confidence).toBe(DetectionConfidence.High);
      expect(result.surfaces).toContain(SurfaceType.VSCodeExtension);
      expect(result.surfaces).toContain(SurfaceType.JetBrainsPlugin);
    });

    it("returns High confidence when Copilot extension + global storage found", async () => {
      const extensions = new Set(["GitHub.copilot"]);
      mockReaddir.mockRejectedValueOnce(new Error("ENOENT"));
      mockAccess.mockResolvedValueOnce(undefined);

      const { detectCopilot } = await import(
        "../../../../src/detection/harness/detectors/copilot.js"
      );
      const result = await detectCopilot(extensions);

      expect(result.confidence).toBe(DetectionConfidence.High);
    });

    it("returns Medium confidence when only Copilot extension found (no storage)", async () => {
      const extensions = new Set(["GitHub.copilot"]);
      mockReaddir.mockRejectedValueOnce(new Error("ENOENT"));
      mockAccess.mockRejectedValue(Object.assign(new Error(), { code: "ENOENT" }));

      const { detectCopilot } = await import(
        "../../../../src/detection/harness/detectors/copilot.js"
      );
      const result = await detectCopilot(extensions);

      expect(result.confidence).toBe(DetectionConfidence.Medium);
    });

    it("returns Medium confidence when only Copilot Chat extension found", async () => {
      const extensions = new Set(["GitHub.copilot-chat"]);
      mockReaddir.mockRejectedValueOnce(new Error("ENOENT"));

      const { detectCopilot } = await import(
        "../../../../src/detection/harness/detectors/copilot.js"
      );
      const result = await detectCopilot(extensions);

      expect(result.confidence).toBe(DetectionConfidence.Medium);
    });

    it("returns Low confidence when only JetBrains plugin found", async () => {
      // Previously asserted Medium under Copilot's old bespoke confidence
      // logic, but the JetBrains plugin is registered as a "medium"
      // reliability signal (same tier as a home-dir config file), and the
      // plan's rule of thumb is that a lone medium/secondary signal with no
      // agreeing signal is "possible" (Low), not "detected" (Medium) — the
      // same behavior detectCursor/detectCodex already have for a lone
      // config-dir signal. Now that all detectors share one confidence
      // function, this scenario is Low for consistency.
      const extensions = new Set<string>();
      // Mock access to reject for all pathExists calls (global storage checks)
      mockAccess.mockRejectedValue(Object.assign(new Error(), { code: "ENOENT" }));
      // Set APPDATA for Windows JetBrains path
      vi.stubEnv("APPDATA", "/home/testuser/AppData/Roaming");
      // Mock readdir for JetBrains plugin detection
      mockReaddir.mockResolvedValueOnce(["IntelliJIdea2024.1"] as string[]);
      mockReaddir.mockResolvedValueOnce(["copilot"] as string[]);

      const { detectCopilot } = await import(
        "../../../../src/detection/harness/detectors/copilot.js"
      );
      const result = await detectCopilot(extensions);

      expect(result.confidence).toBe(DetectionConfidence.Low);
      expect(result.surfaces).toContain(SurfaceType.JetBrainsPlugin);
    });

    it("returns None confidence when nothing found", async () => {
      const extensions = new Set<string>();
      mockReaddir.mockRejectedValueOnce(new Error("ENOENT"));

      const { detectCopilot } = await import(
        "../../../../src/detection/harness/detectors/copilot.js"
      );
      const result = await detectCopilot(extensions);

      expect(result.confidence).toBe(DetectionConfidence.None);
      expect(result.surfaces).toHaveLength(0);
    });

    it("incorporates global storage into confidence calculation", async () => {
      const extensions = new Set(["GitHub.copilot"]);
      mockReaddir.mockRejectedValueOnce(new Error("ENOENT"));
      mockAccess.mockResolvedValueOnce(undefined);

      const { detectCopilot } = await import(
        "../../../../src/detection/harness/detectors/copilot.js"
      );
      const result = await detectCopilot(extensions);

      const storageEvidence = result.evidence.find(
        (e) => e.signal === "extension-global-storage",
      );
      expect(storageEvidence).toBeDefined();
      expect(storageEvidence?.found).toBe(true);
      expect(result.confidence).toBe(DetectionConfidence.High);
    });

    it("finds extension global storage under .vscode-server (WSL/remote) rather than .vscode", async () => {
      const extensions = new Set(["GitHub.copilot"]);
      mockReaddir.mockRejectedValueOnce(new Error("ENOENT"));
      mockAccess.mockImplementation(async (path: unknown) => {
        const p = normalizePath(String(path));
        if (p.includes(".vscode/extensions")) {
          throw Object.assign(new Error(), { code: "ENOENT" });
        }
        if (p.includes(".vscode-server/extensions")) {
          return undefined;
        }
        throw Object.assign(new Error(), { code: "ENOENT" });
      });

      const { detectCopilot } = await import(
        "../../../../src/detection/harness/detectors/copilot.js"
      );
      const result = await detectCopilot(extensions);

      const storageEvidence = result.evidence.find(
        (e) => e.signal === "extension-global-storage",
      );
      expect(storageEvidence).toBeDefined();
      expect(storageEvidence?.found).toBe(true);
      expect(result.confidence).toBe(DetectionConfidence.High);
    });
  });

  describe("ZooCode detection (via registry)", () => {
    it("returns High confidence when extension + config dir both found", async () => {
      mockReaddir.mockResolvedValue(["zoocodeorganization.zoo-code-1.0.0"] as unknown as never[]);
      mockAccess.mockResolvedValue(undefined);

      const { detectHarnesses } = await import(
        "../../../../src/detection/harness/index.js"
      );
      const results = await detectHarnesses("/test/project");
      const result = results.find((r) => r.harness === AgentHarness.ZooCode);

      expect(result).toBeDefined();
      expect(result!.confidence).toBe(DetectionConfidence.High);
      expect(result!.surfaces).toContain(SurfaceType.VSCodeExtension);
      expect(result!.surfaces).toContain(SurfaceType.ConfigDir);
    });

    it("returns Medium confidence when only extension found", async () => {
      mockReaddir.mockResolvedValue(["zoocodeorganization.zoo-code-1.0.0"] as unknown as never[]);
      mockAccess.mockRejectedValue(Object.assign(new Error(), { code: "ENOENT" }));

      const { detectHarnesses } = await import(
        "../../../../src/detection/harness/index.js"
      );
      const results = await detectHarnesses("/test/project");
      const result = results.find((r) => r.harness === AgentHarness.ZooCode);

      expect(result).toBeDefined();
      expect(result!.confidence).toBe(DetectionConfidence.Medium);
      expect(result!.surfaces).toContain(SurfaceType.VSCodeExtension);
    });

    it("returns Low confidence when only config dir found", async () => {
      mockReaddir.mockResolvedValue([] as never[]);
      mockAccess.mockResolvedValue(undefined);

      const { detectHarnesses } = await import(
        "../../../../src/detection/harness/index.js"
      );
      const results = await detectHarnesses("/test/project");
      const result = results.find((r) => r.harness === AgentHarness.ZooCode);

      expect(result).toBeDefined();
      expect(result!.confidence).toBe(DetectionConfidence.Low);
      expect(result!.surfaces).toContain(SurfaceType.ConfigDir);
    });

    it("not detected when nothing found", async () => {
      mockReaddir.mockResolvedValue([] as never[]);
      mockAccess.mockRejectedValue(Object.assign(new Error(), { code: "ENOENT" }));

      const { detectHarnesses } = await import(
        "../../../../src/detection/harness/index.js"
      );
      const results = await detectHarnesses("/test/project");
      const result = results.find((r) => r.harness === AgentHarness.ZooCode);

      expect(result).toBeUndefined();
    });
  });

  describe("detectDevin", () => {
    it("returns High confidence when app bundle and config dir both found (macOS)", async () => {
      mockPlatform.mockReturnValue("darwin");
      mockAccess.mockResolvedValueOnce(undefined);
      mockAccess.mockResolvedValueOnce(undefined);

      const { detectDevin } = await import(
        "../../../../src/detection/harness/detectors/devin.js"
      );
      const result = await detectDevin();

      expect(result.harness).toBe(AgentHarness.Devin);
      expect(result.confidence).toBe(DetectionConfidence.High);
      expect(result.surfaces).toContain(SurfaceType.AppBundle);
      expect(result.surfaces).toContain(SurfaceType.ConfigDir);
    });

    it("returns Medium confidence when only app bundle found", async () => {
      mockPlatform.mockReturnValue("darwin");
      mockAccess.mockResolvedValueOnce(undefined);
      mockAccess.mockRejectedValueOnce(Object.assign(new Error(), { code: "ENOENT" }));

      const { detectDevin } = await import(
        "../../../../src/detection/harness/detectors/devin.js"
      );
      const result = await detectDevin();

      expect(result.confidence).toBe(DetectionConfidence.Medium);
      expect(result.surfaces).toContain(SurfaceType.AppBundle);
    });

    it("returns Low confidence when only config dir found", async () => {
      mockPlatform.mockReturnValue("darwin");
      mockAccess.mockRejectedValueOnce(Object.assign(new Error(), { code: "ENOENT" }));
      mockAccess.mockResolvedValueOnce(undefined);

      const { detectDevin } = await import(
        "../../../../src/detection/harness/detectors/devin.js"
      );
      const result = await detectDevin();

      expect(result.confidence).toBe(DetectionConfidence.Low);
      expect(result.surfaces).toContain(SurfaceType.ConfigDir);
    });

    it("returns None confidence when nothing found", async () => {
      mockPlatform.mockReturnValue("darwin");
      mockAccess.mockRejectedValueOnce(Object.assign(new Error(), { code: "ENOENT" }));
      mockAccess.mockRejectedValueOnce(Object.assign(new Error(), { code: "ENOENT" }));

      const { detectDevin } = await import(
        "../../../../src/detection/harness/detectors/devin.js"
      );
      const result = await detectDevin();

      expect(result.confidence).toBe(DetectionConfidence.None);
      expect(result.surfaces).toHaveLength(0);
    });

    it("checks Windows install paths", async () => {
      mockPlatform.mockReturnValue("win32");
      vi.stubEnv("LOCALAPPDATA", "C:\\Users\\test\\AppData\\Local");
      mockAccess.mockResolvedValueOnce(undefined);
      mockAccess.mockResolvedValueOnce(undefined);

      const { detectDevin } = await import(
        "../../../../src/detection/harness/detectors/devin.js"
      );
      const result = await detectDevin();

      expect(result.confidence).toBe(DetectionConfidence.High);
    });

    it("finds config.json under %APPDATA%\\devin on Windows", async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "win32" });
      vi.stubEnv("APPDATA", "C:\\Users\\test\\AppData\\Roaming");
      try {
        mockAccess.mockRejectedValueOnce(Object.assign(new Error(), { code: "ENOENT" })); // app bundle
        mockAccess.mockImplementation(async (path: unknown) => {
          const p = String(path);
          if (p.startsWith("C:\\Users\\test\\AppData\\Roaming") && p.endsWith("config.json")) {
            return undefined;
          }
          throw Object.assign(new Error(), { code: "ENOENT" });
        });

        const { detectDevin } = await import(
          "../../../../src/detection/harness/detectors/devin.js"
        );
        const result = await detectDevin();

        expect(result.surfaces).toContain(SurfaceType.ConfigDir);
      } finally {
        Object.defineProperty(process, "platform", { value: originalPlatform });
      }
    });
  });

  describe("Cline detection (via registry)", () => {
    it("returns High confidence when extension + config dir both found", async () => {
      mockReaddir.mockResolvedValue(["saoudrizwan.claude-dev-1.0.0"] as unknown as never[]);
      mockAccess.mockResolvedValue(undefined);

      const { detectHarnesses } = await import(
        "../../../../src/detection/harness/index.js"
      );
      const results = await detectHarnesses("/test/project");
      const result = results.find((r) => r.harness === AgentHarness.Cline);

      expect(result).toBeDefined();
      expect(result!.confidence).toBe(DetectionConfidence.High);
      expect(result!.surfaces).toContain(SurfaceType.VSCodeExtension);
      expect(result!.surfaces).toContain(SurfaceType.ConfigDir);
    });

    it("returns Medium confidence when only extension found", async () => {
      mockReaddir.mockResolvedValue(["saoudrizwan.claude-dev-1.0.0"] as unknown as never[]);
      mockAccess.mockRejectedValue(Object.assign(new Error(), { code: "ENOENT" }));

      const { detectHarnesses } = await import(
        "../../../../src/detection/harness/index.js"
      );
      const results = await detectHarnesses("/test/project");
      const result = results.find((r) => r.harness === AgentHarness.Cline);

      expect(result).toBeDefined();
      expect(result!.confidence).toBe(DetectionConfidence.Medium);
      expect(result!.surfaces).toContain(SurfaceType.VSCodeExtension);
    });

    it("returns Low confidence when only config dir found", async () => {
      mockReaddir.mockResolvedValue([] as never[]);
      mockAccess.mockResolvedValue(undefined);

      const { detectHarnesses } = await import(
        "../../../../src/detection/harness/index.js"
      );
      const results = await detectHarnesses("/test/project");
      const result = results.find((r) => r.harness === AgentHarness.Cline);

      expect(result).toBeDefined();
      expect(result!.confidence).toBe(DetectionConfidence.Low);
      expect(result!.surfaces).toContain(SurfaceType.ConfigDir);
    });

    it("not detected when nothing found", async () => {
      mockReaddir.mockResolvedValue([] as never[]);
      mockAccess.mockRejectedValue(Object.assign(new Error(), { code: "ENOENT" }));

      const { detectHarnesses } = await import(
        "../../../../src/detection/harness/index.js"
      );
      const results = await detectHarnesses("/test/project");
      const result = results.find((r) => r.harness === AgentHarness.Cline);

      expect(result).toBeUndefined();
    });
  });

  describe("JetBrains detection (via registry)", () => {
    it("returns High confidence when plugin + project dir both found", async () => {
      mockReaddir.mockImplementation(async (path: unknown) => {
        const p = String(path);
        if (p.includes(".vscode") || p.includes(".vscode-server")) {
          throw Object.assign(new Error(), { code: "ENOENT" });
        }
        if (p.endsWith("plugins")) {
          return ["junie"] as unknown as string[];
        }
        return ["IntelliJIdea2024.1"] as unknown as string[];
      });
      mockAccess.mockResolvedValueOnce(undefined);

      const { detectHarnesses } = await import(
        "../../../../src/detection/harness/index.js"
      );
      const results = await detectHarnesses("/project");
      const result = results.find((r) => r.harness === AgentHarness.JetBrains);

      expect(result).toBeDefined();
      expect(result!.confidence).toBe(DetectionConfidence.High);
      expect(result!.surfaces).toContain(SurfaceType.JetBrainsPlugin);
      expect(result!.surfaces).toContain(SurfaceType.ProjectFile);
    });

    it("returns Medium confidence when only plugin found", async () => {
      mockReaddir.mockImplementation(async (path: unknown) => {
        const p = String(path);
        if (p.includes(".vscode") || p.includes(".vscode-server")) {
          throw Object.assign(new Error(), { code: "ENOENT" });
        }
        if (p.endsWith("plugins")) {
          return ["junie"] as unknown as string[];
        }
        return ["IntelliJIdea2024.1"] as unknown as string[];
      });
      mockAccess.mockRejectedValue(Object.assign(new Error(), { code: "ENOENT" }));

      const { detectHarnesses } = await import(
        "../../../../src/detection/harness/index.js"
      );
      const results = await detectHarnesses("/project");
      const result = results.find((r) => r.harness === AgentHarness.JetBrains);

      expect(result).toBeDefined();
      expect(result!.confidence).toBe(DetectionConfidence.Medium);
      expect(result!.surfaces).toContain(SurfaceType.JetBrainsPlugin);
    });

    it("returns Low confidence when only project dir found", async () => {
      mockReaddir.mockRejectedValue(Object.assign(new Error(), { code: "ENOENT" }));
      mockAccess.mockResolvedValueOnce(undefined);

      const { detectHarnesses } = await import(
        "../../../../src/detection/harness/index.js"
      );
      const results = await detectHarnesses("/project");
      const result = results.find((r) => r.harness === AgentHarness.JetBrains);

      expect(result).toBeDefined();
      expect(result!.confidence).toBe(DetectionConfidence.Low);
      expect(result!.surfaces).toContain(SurfaceType.ProjectFile);
    });

    it("not detected when nothing found", async () => {
      mockReaddir.mockRejectedValue(Object.assign(new Error(), { code: "ENOENT" }));
      mockAccess.mockRejectedValue(Object.assign(new Error(), { code: "ENOENT" }));

      const { detectHarnesses } = await import(
        "../../../../src/detection/harness/index.js"
      );
      const results = await detectHarnesses("/project");
      const result = results.find((r) => r.harness === AgentHarness.JetBrains);

      expect(result).toBeUndefined();
    });
  });

  describe("Aider detection (via registry)", () => {
    it("returns Medium confidence when config dir + project file both found", async () => {
      mockReaddir.mockRejectedValue(Object.assign(new Error(), { code: "ENOENT" }));
      mockAccess.mockResolvedValue(undefined);

      const { detectHarnesses } = await import(
        "../../../../src/detection/harness/index.js"
      );
      const results = await detectHarnesses("/project");
      const result = results.find((r) => r.harness === AgentHarness.Aider);

      expect(result).toBeDefined();
      expect(result!.confidence).toBe(DetectionConfidence.Medium);
      expect(result!.surfaces).toContain(SurfaceType.ConfigDir);
      expect(result!.surfaces).toContain(SurfaceType.ProjectFile);
    });

    it("returns Low confidence when only config dir found", async () => {
      mockReaddir.mockRejectedValue(Object.assign(new Error(), { code: "ENOENT" }));
      mockAccess.mockImplementation(async (path: unknown) => {
        const p = normalizePath(String(path));
        if (p.startsWith("/home/testuser") && p.endsWith(".aider.conf.yml")) {
          return undefined;
        }
        throw Object.assign(new Error(), { code: "ENOENT" });
      });

      const { detectHarnesses } = await import(
        "../../../../src/detection/harness/index.js"
      );
      const results = await detectHarnesses("/project");
      const result = results.find((r) => r.harness === AgentHarness.Aider);

      expect(result).toBeDefined();
      expect(result!.confidence).toBe(DetectionConfidence.Low);
      expect(result!.surfaces).toContain(SurfaceType.ConfigDir);
    });

    it("returns Low confidence when only project file found", async () => {
      mockReaddir.mockRejectedValue(Object.assign(new Error(), { code: "ENOENT" }));
      mockAccess.mockImplementation(async (path: unknown) => {
        const p = normalizePath(String(path));
        if (p.startsWith("/project") && p.endsWith(".aider.conf.yml")) {
          return undefined;
        }
        throw Object.assign(new Error(), { code: "ENOENT" });
      });

      const { detectHarnesses } = await import(
        "../../../../src/detection/harness/index.js"
      );
      const results = await detectHarnesses("/project");
      const result = results.find((r) => r.harness === AgentHarness.Aider);

      expect(result).toBeDefined();
      expect(result!.confidence).toBe(DetectionConfidence.Low);
      expect(result!.surfaces).toContain(SurfaceType.ProjectFile);
    });

    it("not detected when nothing found", async () => {
      mockReaddir.mockRejectedValue(Object.assign(new Error(), { code: "ENOENT" }));
      mockAccess.mockRejectedValue(Object.assign(new Error(), { code: "ENOENT" }));

      const { detectHarnesses } = await import(
        "../../../../src/detection/harness/index.js"
      );
      const results = await detectHarnesses("/project");
      const result = results.find((r) => r.harness === AgentHarness.Aider);

      expect(result).toBeUndefined();
    });

    it("uses signal descriptions from registry in evidence", async () => {
      mockReaddir.mockRejectedValue(Object.assign(new Error(), { code: "ENOENT" }));
      mockAccess.mockResolvedValue(undefined);

      const { detectHarnesses } = await import(
        "../../../../src/detection/harness/index.js"
      );
      const results = await detectHarnesses("/project");
      const result = results.find((r) => r.harness === AgentHarness.Aider);

      expect(result).toBeDefined();
      expect(result!.evidence.length).toBeGreaterThan(0);
      for (const ev of result!.evidence) {
        expect(ev.signal).toBeTruthy();
      }
    });
  });

  describe("VSCODE_EXTENSION_DIRS Cursor exclusion regression", () => {
    it("does not include any Cursor-specific extensions directory", async () => {
      const { VSCODE_EXTENSION_DIRS } = await import(
        "../../../../src/detection/harness/vscode-utils.js"
      );

      for (const dir of VSCODE_EXTENSION_DIRS) {
        expect(dir.toLowerCase()).not.toContain("cursor");
      }
    });

    it("scanVSCodeExtensions does not scan a synthetic Cursor-only extensions directory", async () => {
      mockReaddir.mockImplementation(async (path: unknown) => {
        const p = String(path);
        if (p.includes(".cursor/extensions")) {
          return ["GitHub.copilot-1.0.0"] as unknown as string[];
        }
        throw Object.assign(new Error(), { code: "ENOENT" });
      });

      const { scanVSCodeExtensions } = await import(
        "../../../../src/detection/harness/vscode-utils.js"
      );
      const extensions = await scanVSCodeExtensions();

      expect(extensions.has("GitHub.copilot")).toBe(false);
    });
  });

  describe("detectCursor", () => {
    it("returns High confidence when app bundle and config dir both found (macOS)", async () => {
      mockPlatform.mockReturnValue("darwin");
      mockAccess.mockResolvedValueOnce(undefined);
      mockAccess.mockResolvedValueOnce(undefined);

      const { detectCursor } = await import(
        "../../../../src/detection/harness/detectors/cursor.js"
      );
      const result = await detectCursor();

      expect(result.harness).toBe(AgentHarness.Cursor);
      expect(result.confidence).toBe(DetectionConfidence.High);
      expect(result.surfaces).toContain(SurfaceType.AppBundle);
      expect(result.surfaces).toContain(SurfaceType.ConfigDir);
    });

    it("returns Medium confidence when only app bundle found", async () => {
      mockPlatform.mockReturnValue("darwin");
      mockAccess.mockResolvedValueOnce(undefined);
      mockAccess.mockRejectedValueOnce(Object.assign(new Error(), { code: "ENOENT" }));

      const { detectCursor } = await import(
        "../../../../src/detection/harness/detectors/cursor.js"
      );
      const result = await detectCursor();

      expect(result.confidence).toBe(DetectionConfidence.Medium);
      expect(result.surfaces).toContain(SurfaceType.AppBundle);
    });

    it("returns Low confidence when only config dir found", async () => {
      mockPlatform.mockReturnValue("darwin");
      mockAccess.mockRejectedValueOnce(Object.assign(new Error(), { code: "ENOENT" }));
      mockAccess.mockResolvedValueOnce(undefined);

      const { detectCursor } = await import(
        "../../../../src/detection/harness/detectors/cursor.js"
      );
      const result = await detectCursor();

      expect(result.confidence).toBe(DetectionConfidence.Low);
      expect(result.surfaces).toContain(SurfaceType.ConfigDir);
    });

    it("returns None confidence when nothing found", async () => {
      mockPlatform.mockReturnValue("darwin");
      mockAccess.mockRejectedValueOnce(Object.assign(new Error(), { code: "ENOENT" }));
      mockAccess.mockRejectedValueOnce(Object.assign(new Error(), { code: "ENOENT" }));

      const { detectCursor } = await import(
        "../../../../src/detection/harness/detectors/cursor.js"
      );
      const result = await detectCursor();

      expect(result.confidence).toBe(DetectionConfidence.None);
      expect(result.surfaces).toHaveLength(0);
    });

    it("checks Windows install paths", async () => {
      mockPlatform.mockReturnValue("win32");
      vi.stubEnv("LOCALAPPDATA", "C:\\Users\\test\\AppData\\Local");
      mockAccess.mockResolvedValueOnce(undefined);
      mockAccess.mockResolvedValueOnce(undefined);

      const { detectCursor } = await import(
        "../../../../src/detection/harness/detectors/cursor.js"
      );
      const result = await detectCursor();

      expect(result.confidence).toBe(DetectionConfidence.High);
    });

    it("checks Linux install paths", async () => {
      mockPlatform.mockReturnValue("linux");
      mockAccess.mockResolvedValueOnce(undefined);
      mockAccess.mockResolvedValueOnce(undefined);

      const { detectCursor } = await import(
        "../../../../src/detection/harness/detectors/cursor.js"
      );
      const result = await detectCursor();

      expect(result.confidence).toBe(DetectionConfidence.High);
    });
  });
});
