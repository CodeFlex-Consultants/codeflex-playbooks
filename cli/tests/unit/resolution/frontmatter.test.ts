import { describe, it, expect } from "vitest";
import { parseFrontmatter } from "../../../src/resolution/frontmatter";

describe("parseFrontmatter", () => {
  it("parses valid frontmatter with metadata and body", () => {
    const content = [
      "---",
      "name: test-skill",
      "description: A test skill",
      "---",
      "# Body content",
      "",
      "Some text here.",
    ].join("\n");

    const result = parseFrontmatter(content);

    expect(result.metadata).toEqual({ name: "test-skill", description: "A test skill" });
    expect(result.body).toContain("# Body content");
    expect(result.body).toContain("Some text here.");
  });

  it("parses frontmatter with empty body", () => {
    const content = [
      "---",
      "name: test",
      "---",
    ].join("\n");

    const result = parseFrontmatter(content);

    expect(result.metadata).toEqual({ name: "test" });
    expect(result.body).toBe("");
  });

  it("parses frontmatter with complex YAML", () => {
    const content = [
      "---",
      "name: complex",
      "description: Complex skill",
      "tags:",
      "  - tag1",
      "  - tag2",
      "nested:",
      "  key: value",
      "---",
      "Body",
    ].join("\n");

    const result = parseFrontmatter(content);

    expect(result.metadata.name).toBe("complex");
    expect(result.metadata.tags).toEqual(["tag1", "tag2"]);
    expect(result.metadata.nested).toEqual({ key: "value" });
    expect(result.body).toBe("Body");
  });

  it("throws when frontmatter does not start with ---", () => {
    const content = "name: test\n---\nBody";

    expect(() => parseFrontmatter(content)).toThrow("Frontmatter must start with ---");
  });

  it("throws when frontmatter has no closing ---", () => {
    const content = "---\nname: test\nNo closing delimiter";

    expect(() => parseFrontmatter(content)).toThrow("Frontmatter must end with ---");
  });

  it("handles body with multiple lines and whitespace", () => {
    const content = [
      "---",
      "name: test",
      "---",
      "",
      "Line 1",
      "",
      "Line 2",
      "",
      "Line 3",
    ].join("\n");

    const result = parseFrontmatter(content);

    expect(result.body).toContain("Line 1");
    expect(result.body).toContain("Line 2");
    expect(result.body).toContain("Line 3");
  });

  it("handles empty YAML section between delimiters", () => {
    const content = [
      "---",
      "---",
      "Body text",
    ].join("\n");

    const result = parseFrontmatter(content);

    expect(result.body).toBe("Body text");
  });

  it("handles whitespace around delimiters", () => {
    const content = [
      "  ---  ",
      "name: test",
      "  ---  ",
      "Body",
    ].join("\n");

    const result = parseFrontmatter(content);

    expect(result.metadata).toEqual({ name: "test" });
    expect(result.body).toBe("Body");
  });

  it("parses frontmatter with version field", () => {
    const content = [
      "---",
      "name: versioned",
      "version: 1.2.3",
      "description: Versioned skill",
      "---",
      "Content",
    ].join("\n");

    const result = parseFrontmatter(content);

    expect(result.metadata.name).toBe("versioned");
    expect(result.metadata.version).toBe("1.2.3");
  });
});
