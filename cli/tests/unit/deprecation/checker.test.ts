import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  checkDeprecations,
  hasDeprecationErrors,
} from "../../../src/deprecation/checker";
import { DeprecationSeverity } from "../../../src/deprecation/types";

function getDetectedDeprecations(report: { results: { detected: boolean }[] }) {
  return report.results.filter((r) => r.detected);
}

describe("deprecation checker", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "deprecation-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("checkDeprecations", () => {
    it("returns no issues for a clean project", async () => {
      const report = await checkDeprecations({ projectRoot: tempDir });
      expect(report.hasIssues).toBe(false);
      expect(report.warnings).toEqual([]);
      expect(report.errors).toEqual([]);
    });

    it("detects legacy .kilocode/ directory", async () => {
      await mkdir(join(tempDir, ".kilocode"), { recursive: true });

      const report = await checkDeprecations({ projectRoot: tempDir });
      expect(report.hasIssues).toBe(true);

      const detected = getDetectedDeprecations(report);
      const kilocodeDeprecation = detected.find(
        (r) => r.entry.id === "LEGACY_KILOCODE_DIRECTORY",
      );
      expect(kilocodeDeprecation).toBeDefined();
      expect(kilocodeDeprecation?.entry.severity).toBe(DeprecationSeverity.Warning);
    });

    it("does not flag .opencode/ (current, supported OpenCode config directory)", async () => {
      await mkdir(join(tempDir, ".opencode"), { recursive: true });

      const report = await checkDeprecations({ projectRoot: tempDir });
      const detected = getDetectedDeprecations(report);
      const opencodeDeprecation = detected.find(
        (r) => r.entry.id === "LEGACY_OPENCODE_DIRECTORY",
      );
      expect(opencodeDeprecation).toBeUndefined();
    });

    it("detects legacy .cursorrules with modern .cursor/rules/", async () => {
      await writeFile(join(tempDir, ".cursorrules"), "old format");
      await mkdir(join(tempDir, ".cursor", "rules"), { recursive: true });

      const report = await checkDeprecations({ projectRoot: tempDir });
      expect(report.hasIssues).toBe(true);

      const detected = getDetectedDeprecations(report);
      const cursorDeprecation = detected.find(
        (r) => r.entry.id === "LEGACY_CURSOR_RULES_FILE",
      );
      expect(cursorDeprecation).toBeDefined();
    });

    it("flags .cursorrules alone without .cursor/rules/", async () => {
      await writeFile(join(tempDir, ".cursorrules"), "old format");

      const report = await checkDeprecations({ projectRoot: tempDir });
      expect(report.hasIssues).toBe(true);
      const detected = getDetectedDeprecations(report);
      const cursorDeprecation = detected.find(
        (r) => r.entry.id === "LEGACY_CURSOR_RULES_FILE",
      );
      expect(cursorDeprecation).toBeDefined();
    });

    it("detects legacy state directories alongside .codeflex/", async () => {
      await mkdir(join(tempDir, ".codeflex"), { recursive: true });
      await mkdir(join(tempDir, ".engineering"), { recursive: true });

      const report = await checkDeprecations({ projectRoot: tempDir });
      expect(hasDeprecationErrors(report)).toBe(true);

      const detected = getDetectedDeprecations(report);
      const stateDeprecation = detected.find(
        (r) => r.entry.id === "LEGACY_CODEFLEX_STATE_DIRECTORY",
      );
      expect(stateDeprecation).toBeDefined();
      expect(stateDeprecation?.entry.severity).toBe(DeprecationSeverity.Error);
    });

    it("does not flag .agents/ without .codeflex/ (valid Codex projection path)", async () => {
      await mkdir(join(tempDir, ".agents"), { recursive: true });

      const report = await checkDeprecations({ projectRoot: tempDir });
      const detected = getDetectedDeprecations(report);
      const stateDeprecation = detected.find(
        (r) => r.entry.id === "LEGACY_CODEFLEX_STATE_DIRECTORY",
      );
      expect(stateDeprecation).toBeUndefined();
    });

    it("does not flag .agents/ alongside .codeflex/ (valid Codex projection path)", async () => {
      await mkdir(join(tempDir, ".codeflex"), { recursive: true });
      await mkdir(join(tempDir, ".agents"), { recursive: true });

      const report = await checkDeprecations({ projectRoot: tempDir });
      const detected = getDetectedDeprecations(report);
      const stateDeprecation = detected.find(
        (r) => r.entry.id === "LEGACY_CODEFLEX_STATE_DIRECTORY",
      );
      expect(stateDeprecation).toBeUndefined();
    });

    it("detects multiple deprecations simultaneously", async () => {
      await mkdir(join(tempDir, ".kilocode"), { recursive: true });
      await writeFile(join(tempDir, ".cursorrules"), "old format");

      const report = await checkDeprecations({ projectRoot: tempDir });
      expect(report.hasIssues).toBe(true);
      expect(getDetectedDeprecations(report).length).toBeGreaterThanOrEqual(2);
    });

    it("detects legacy backend/ skills directory when moved skills are present", async () => {
      await mkdir(join(tempDir, ".codeflex", "skills", "backend", "caching"), { recursive: true });

      const report = await checkDeprecations({ projectRoot: tempDir });
      expect(report.hasIssues).toBe(true);

      const detected = getDetectedDeprecations(report);
      const backendDeprecation = detected.find(
        (r) => r.entry.id === "LEGACY_BACKEND_SKILLS_DIRECTORY",
      );
      expect(backendDeprecation).toBeDefined();
      expect(backendDeprecation?.entry.severity).toBe(DeprecationSeverity.Warning);
    });

    it("does not flag backend/ directory without moved skills", async () => {
      await mkdir(join(tempDir, ".codeflex", "skills", "backend", "aspnet-core"), { recursive: true });

      const report = await checkDeprecations({ projectRoot: tempDir });
      const detected = getDetectedDeprecations(report);
      const backendDeprecation = detected.find(
        (r) => r.entry.id === "LEGACY_BACKEND_SKILLS_DIRECTORY",
      );
      expect(backendDeprecation).toBeUndefined();
    });

    it("does not flag architecture/ skills directory", async () => {
      await mkdir(join(tempDir, ".codeflex", "skills", "architecture"), { recursive: true });

      const report = await checkDeprecations({ projectRoot: tempDir });
      const detected = getDetectedDeprecations(report);
      const backendDeprecation = detected.find(
        (r) => r.entry.id === "LEGACY_BACKEND_SKILLS_DIRECTORY",
      );
      expect(backendDeprecation).toBeUndefined();
    });
  });

  describe("helper functions", () => {
    it("hasDeprecationErrors returns true when errors exist", async () => {
      await mkdir(join(tempDir, ".codeflex"), { recursive: true });
      await mkdir(join(tempDir, ".engineering"), { recursive: true });

      const report = await checkDeprecations({ projectRoot: tempDir });
      expect(hasDeprecationErrors(report)).toBe(true);
    });

    it("hasDeprecationErrors returns false for warnings only", async () => {
      await mkdir(join(tempDir, ".kilocode"), { recursive: true });

      const report = await checkDeprecations({ projectRoot: tempDir });
      expect(hasDeprecationErrors(report)).toBe(false);
    });
  });

  describe("error handling", () => {
    it("propagates errors from failing detect functions", async () => {
      const { DEPRECATION_REGISTRY } = await import("../../../src/deprecation/registry.js");
      const originalDetect = DEPRECATION_REGISTRY[0].detect;
      const failingDetect = vi.fn().mockRejectedValue(new Error("detect failed"));

      DEPRECATION_REGISTRY[0].detect = failingDetect;

      try {
        await expect(
          checkDeprecations({ projectRoot: tempDir }),
        ).rejects.toThrow("detect failed");
      } finally {
        DEPRECATION_REGISTRY[0].detect = originalDetect;
      }
    });

    it("invokes all entries' detect functions even when one rejects", async () => {
      const { DEPRECATION_REGISTRY } = await import("../../../src/deprecation/registry.js");
      const originalDetects = DEPRECATION_REGISTRY.map((e) => e.detect);

      const failingDetect = vi.fn().mockRejectedValue(new Error("detect failed"));
      const spies = DEPRECATION_REGISTRY.map((entry, i) =>
        i === 0 ? failingDetect : vi.fn(originalDetects[i]),
      );
      DEPRECATION_REGISTRY.forEach((e, i) => {
        e.detect = spies[i];
      });

      try {
        await expect(
          checkDeprecations({ projectRoot: tempDir }),
        ).rejects.toThrow("detect failed");

        for (const spy of spies) {
          expect(spy).toHaveBeenCalledTimes(1);
        }
      } finally {
        DEPRECATION_REGISTRY.forEach((e, i) => {
          e.detect = originalDetects[i];
        });
      }
    });
  });
});
