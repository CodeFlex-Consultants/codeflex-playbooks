import { describe, it, expect } from "vitest";
import { applyExceptions } from "../../../src/resolution/exception-handler";
import type { RuleException } from "../../../src/types/index";

describe("applyExceptions", () => {
  it("removes a rule from the active map when exception applies", () => {
    const rules = new Map([
      ["RULE-1", "skill-a"],
      ["RULE-2", "skill-b"],
    ]);
    const exceptions: RuleException[] = [{ rule: "RULE-1" }];

    const result = applyExceptions(rules, exceptions);

    expect(result.active.has("RULE-1")).toBe(false);
    expect(result.active.has("RULE-2")).toBe(true);
    expect(result.excepted).toHaveLength(1);
    expect(result.excepted[0]!.rule).toBe("RULE-1");
  });

  it("ignores expired exceptions", () => {
    const rules = new Map([["RULE-1", "skill-a"]]);
    const exceptions: RuleException[] = [{ rule: "RULE-1", expires: "2020-01-01" }];

    const result = applyExceptions(rules, exceptions);

    expect(result.active.has("RULE-1")).toBe(true);
    expect(result.expired).toHaveLength(1);
    expect(result.expired[0]!.rule).toBe("RULE-1");
    expect(result.excepted).toHaveLength(0);
  });

  it("applies non-expired exceptions", () => {
    const rules = new Map([["RULE-1", "skill-a"]]);
    const exceptions: RuleException[] = [{ rule: "RULE-1", expires: "2099-12-31" }];

    const result = applyExceptions(rules, exceptions);

    expect(result.active.has("RULE-1")).toBe(false);
    expect(result.excepted).toHaveLength(1);
    expect(result.expired).toHaveLength(0);
  });

  it("ignores exceptions for rules that do not exist in the map", () => {
    const rules = new Map([["RULE-1", "skill-a"]]);
    const exceptions: RuleException[] = [{ rule: "RULE-NONEXISTENT" }];

    const result = applyExceptions(rules, exceptions);

    expect(result.active.size).toBe(1);
    expect(result.excepted).toHaveLength(0);
    expect(result.expired).toHaveLength(0);
  });

  it("processes multiple exceptions correctly", () => {
    const rules = new Map([
      ["RULE-1", "skill-a"],
      ["RULE-2", "skill-b"],
      ["RULE-3", "skill-c"],
    ]);
    const exceptions: RuleException[] = [
      { rule: "RULE-1" },
      { rule: "RULE-2", expires: "2020-01-01" },
      { rule: "RULE-3", expires: "2099-12-31" },
    ];

    const result = applyExceptions(rules, exceptions);

    expect(result.active.has("RULE-1")).toBe(false);
    expect(result.active.has("RULE-2")).toBe(true);
    expect(result.active.has("RULE-3")).toBe(false);
    expect(result.excepted).toHaveLength(2);
    expect(result.expired).toHaveLength(1);
  });

  it("returns original rules when exceptions array is empty", () => {
    const rules = new Map([
      ["RULE-1", "skill-a"],
      ["RULE-2", "skill-b"],
    ]);

    const result = applyExceptions(rules, []);

    expect(result.active.size).toBe(2);
    expect(result.excepted).toHaveLength(0);
    expect(result.expired).toHaveLength(0);
  });

  it("does not mutate the original rules map", () => {
    const rules = new Map([["RULE-1", "skill-a"]]);
    const exceptions: RuleException[] = [{ rule: "RULE-1" }];

    applyExceptions(rules, exceptions);

    expect(rules.has("RULE-1")).toBe(true);
  });

  it("handles exception without expiry as always active", () => {
    const rules = new Map([["RULE-1", "skill-a"]]);
    const exceptions: RuleException[] = [{ rule: "RULE-1", reason: "approved" }];

    const result = applyExceptions(rules, exceptions);

    expect(result.active.has("RULE-1")).toBe(false);
    expect(result.excepted).toHaveLength(1);
    expect(result.expired).toHaveLength(0);
  });

  it("returns empty active map when all rules are excepted", () => {
    const rules = new Map([
      ["RULE-1", "skill-a"],
      ["RULE-2", "skill-b"],
    ]);
    const exceptions: RuleException[] = [
      { rule: "RULE-1" },
      { rule: "RULE-2" },
    ];

    const result = applyExceptions(rules, exceptions);

    expect(result.active.size).toBe(0);
    expect(result.excepted).toHaveLength(2);
  });
});
