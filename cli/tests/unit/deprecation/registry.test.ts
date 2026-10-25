import { describe, it, expect } from "vitest";
import {
  DEPRECATION_REGISTRY,
} from "../../../src/deprecation/registry";

describe("deprecation registry", () => {
  describe("DEPRECATION_REGISTRY", () => {
    it("contains at least one deprecation entry", () => {
      expect(DEPRECATION_REGISTRY.length).toBeGreaterThan(0);
    });

    it("all entries have unique IDs", () => {
      const ids = DEPRECATION_REGISTRY.map((entry) => entry.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("all entries have required fields", () => {
      for (const entry of DEPRECATION_REGISTRY) {
        expect(entry.id).toBeTruthy();
        expect(entry.category).toBeTruthy();
        expect(entry.severity).toBeTruthy();
        expect(entry.title).toBeTruthy();
        expect(entry.description).toBeTruthy();
        expect(entry.replacement).toBeTruthy();
        expect(typeof entry.detect).toBe("function");
      }
    });
  });
});
