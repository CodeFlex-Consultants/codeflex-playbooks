import { describe, it, expect, vi } from "vitest";
import { join } from "node:path";
import { homedir } from "node:os";

vi.mock("node:os", () => ({
  homedir: vi.fn(() => "/home/testuser"),
}));

import {
  globalAgentsDirPath,
  globalAgentsMdPath,
  GLOBAL_AGENTS_DIR_NAME,
  GLOBAL_AGENTS_MD_FILENAME,
  GLOBAL_SKILLS_DIR_NAME,
} from "../../../src/agents-md/global-paths";

const mockHomedir = vi.mocked(homedir);

describe("global-paths", () => {
  describe("constants", () => {
    it("GLOBAL_AGENTS_DIR_NAME is .agents", () => {
      expect(GLOBAL_AGENTS_DIR_NAME).toBe(".agents");
    });

    it("GLOBAL_AGENTS_MD_FILENAME is AGENTS.md", () => {
      expect(GLOBAL_AGENTS_MD_FILENAME).toBe("AGENTS.md");
    });

    it("GLOBAL_SKILLS_DIR_NAME is skills", () => {
      expect(GLOBAL_SKILLS_DIR_NAME).toBe("skills");
    });
  });

  describe("globalAgentsDirPath", () => {
    it("returns ~/.agents", () => {
      expect(globalAgentsDirPath()).toBe(join("/home/testuser", ".agents"));
    });

    it("reflects homedir changes", () => {
      mockHomedir.mockReturnValueOnce("/other/user");
      expect(globalAgentsDirPath()).toBe(join("/other/user", ".agents"));
    });
  });

  describe("globalAgentsMdPath", () => {
    it("returns ~/.agents/AGENTS.md", () => {
      expect(globalAgentsMdPath()).toBe(
        join("/home/testuser", ".agents", "AGENTS.md"),
      );
    });
  });
});
