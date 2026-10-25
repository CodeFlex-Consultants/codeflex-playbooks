import { describe, it, expect } from "vitest";
import { generateGlobalManagedSection } from "../../../src/agents-md/global-section-generator";
import { MANAGED_SECTION_START, MANAGED_SECTION_END } from "../../../src/agents-md/markers";

describe("generateGlobalManagedSection", () => {
  it("includes start and end markers", () => {
    const section = generateGlobalManagedSection();
    expect(section).toContain(MANAGED_SECTION_START);
    expect(section).toContain(MANAGED_SECTION_END);
  });

  it("references global AGENTS.md location", () => {
    const section = generateGlobalManagedSection();
    expect(section).toContain("~/.agents/AGENTS.md");
  });

  it("references global skills directory", () => {
    const section = generateGlobalManagedSection();
    expect(section).toContain("~/.agents/skills/");
  });

  it("explains loading order", () => {
    const section = generateGlobalManagedSection();
    expect(section).toContain("loaded FIRST");
    expect(section).toContain("loaded SECOND");
  });

  it("includes cross-cutting skills when provided", () => {
    const section = generateGlobalManagedSection(["codeflex-security", "codeflex-code-craftsmanship"]);
    expect(section).toContain("`codeflex-security`");
    expect(section).toContain("`codeflex-code-craftsmanship`");
  });

  it("shows placeholder when no cross-cutting skills exist", () => {
    const section = generateGlobalManagedSection([]);
    expect(section).toContain("No cross-cutting skills installed");
  });

  it("instructs to check project-level AGENTS.md", () => {
    const section = generateGlobalManagedSection();
    expect(section).toContain("project-level");
    expect(section).toContain("AGENTS.md");
  });

  it("states project overrides global", () => {
    const section = generateGlobalManagedSection();
    expect(section).toContain("Project overrides global");
  });

  it("includes two-stage loading structure", () => {
    const section = generateGlobalManagedSection();
    expect(section).toContain("STAGE 1 — BEFORE EXPLORATION");
    expect(section).toContain("STAGE 2 — AFTER EXPLORATION, BEFORE DESIGN");
  });

  it("includes subagent delegation section", () => {
    const section = generateGlobalManagedSection();
    expect(section).toContain("SUBAGENT DELEGATION — HARD REQUIREMENT");
    expect(section).toContain("Subagents do NOT inherit your loaded skills");
    expect(section).toContain("MANDATORY: Load these skills");
  });

  it("includes verification checklist with both stages", () => {
    const section = generateGlobalManagedSection();
    expect(section).toContain("Stage 1 (before exploration)");
    expect(section).toContain("Stage 2 (after exploration, before design/implementation)");
  });
});
