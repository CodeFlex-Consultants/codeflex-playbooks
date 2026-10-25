import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgentHarness } from "../../src/types/index";
import type { EngineeringConfig } from "../../src/types/index";
import type { Reporter } from "../../src/cli/reporter";

const { detectHarnessesMock, saveConfigMock } = vi.hoisted(() => ({
  detectHarnessesMock: vi.fn(),
  saveConfigMock: vi.fn(),
}));

vi.mock("../../src/detection/harness/index.js", () => ({
  detectHarnesses: detectHarnessesMock,
}));

vi.mock("../../src/config/index.js", async () => {
  const actual = await vi.importActual<typeof import("../../src/config/index.js")>(
    "../../src/config/index.js",
  );
  return {
    ...actual,
    saveConfig: saveConfigMock,
  };
});

import { autoDetectHarnesses } from "../../src/cli/harness-autodetect";
import { DetectionConfidence } from "../../src/detection/harness/types";

function makeConfig(overrides?: Partial<EngineeringConfig>): EngineeringConfig {
  return {
    version: 1,
    autoDetect: true,
    agentHarnesses: [],
    standards: { codeflex: { enabled: true } },
    include: [],
    exclude: [],
    scopes: {},
    exceptions: [],
    ...overrides,
  };
}

function makeReporter(): Reporter {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe("autoDetectHarnesses", () => {
  beforeEach(() => {
    detectHarnessesMock.mockReset();
    saveConfigMock.mockReset();
  });

  it("does nothing when autoDetect is disabled", async () => {
    const config = makeConfig({ autoDetect: false, agentHarnesses: [AgentHarness.Codex] });
    const reporter = makeReporter();

    const result = await autoDetectHarnesses("/project", config, reporter);

    expect(result).toBe(config);
    expect(detectHarnessesMock).not.toHaveBeenCalled();
  });

  it("preserves existing harnesses when detection finds nothing (no CLIs/extensions installed)", async () => {
    const config = makeConfig({ agentHarnesses: [AgentHarness.Codex, AgentHarness.Kilo] });
    const reporter = makeReporter();
    detectHarnessesMock.mockResolvedValue([]);

    const result = await autoDetectHarnesses("/project", config, reporter);

    expect(result.agentHarnesses).toEqual([AgentHarness.Codex, AgentHarness.Kilo]);
    expect(saveConfigMock).not.toHaveBeenCalled();
    expect(reporter.warn).toHaveBeenCalledWith(expect.stringContaining("codex, kilo"));
  });

  it("adds newly detected harnesses while keeping existing ones", async () => {
    const config = makeConfig({ agentHarnesses: [AgentHarness.Codex] });
    const reporter = makeReporter();
    detectHarnessesMock.mockResolvedValue([
      { harness: AgentHarness.Codex, surfaces: [], confidence: DetectionConfidence.High, evidence: [] },
      { harness: AgentHarness.Cursor, surfaces: [], confidence: DetectionConfidence.High, evidence: [] },
    ]);

    const result = await autoDetectHarnesses("/project", config, reporter);

    expect(result.agentHarnesses).toEqual([AgentHarness.Codex, AgentHarness.Cursor]);
    expect(saveConfigMock).toHaveBeenCalledTimes(1);
    expect(saveConfigMock).toHaveBeenCalledWith(
      "/project",
      expect.objectContaining({ agentHarnesses: [AgentHarness.Codex, AgentHarness.Cursor] }),
    );
  });

  it("does not persist when nothing new is added and nothing was dropped", async () => {
    const config = makeConfig({ agentHarnesses: [AgentHarness.Codex] });
    const reporter = makeReporter();
    detectHarnessesMock.mockResolvedValue([
      { harness: AgentHarness.Codex, surfaces: [], confidence: DetectionConfidence.High, evidence: [] },
    ]);

    const result = await autoDetectHarnesses("/project", config, reporter);

    expect(result).toBe(config);
    expect(saveConfigMock).not.toHaveBeenCalled();
  });
});
