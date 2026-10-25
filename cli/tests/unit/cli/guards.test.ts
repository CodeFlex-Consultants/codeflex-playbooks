import { describe, it, expect } from "vitest";
import { requireInitialized, parseChannel } from "../../../src/cli/guards";
import { ReleaseChannel } from "../../../src/types/index";
import type { EngineeringConfig } from "../../../src/types/index";
import { mockLock } from "../../fixtures/builders";

function makeConfig(): EngineeringConfig {
  return {
    version: 1,
    autoDetect: true,
    agentHarnesses: [],
    standards: { codeflex: { enabled: true } },
    include: [],
    exclude: [],
    scopes: {},
    exceptions: [],
  };
}

describe("requireInitialized", () => {
  it("throws when config is null", () => {
    expect(() => requireInitialized(null, mockLock({ sources: {} }))).toThrow("Not initialized");
  });

  it("throws when lock is undefined", () => {
    expect(() => requireInitialized(makeConfig(), undefined)).toThrow("Not initialized");
  });

  it("throws when both are null", () => {
    expect(() => requireInitialized(null, null)).toThrow("Not initialized");
  });

  it("returns tuple when both present", () => {
    const config = makeConfig();
    const lock = mockLock({ sources: {} });
    const result = requireInitialized(config, lock);
    expect(result).toEqual([config, lock]);
  });
});

describe("parseChannel", () => {
  it("returns undefined for undefined input", () => {
    expect(parseChannel(undefined)).toBeUndefined();
  });

  it("returns stable channel", () => {
    expect(parseChannel(ReleaseChannel.Stable)).toBe(ReleaseChannel.Stable);
  });

  it("returns canary channel", () => {
    expect(parseChannel(ReleaseChannel.Canary)).toBe(ReleaseChannel.Canary);
  });

  it("throws for invalid channel", () => {
    expect(() => parseChannel("beta")).toThrow("Invalid channel");
  });
});
