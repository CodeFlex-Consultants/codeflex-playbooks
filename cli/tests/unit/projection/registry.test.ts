import { describe, it, expect } from "vitest";
import { HARNESS_REGISTRY } from "../../../src/projection/registry";
import { AgentHarness } from "../../../src/types/index";

describe("HARNESS_REGISTRY", () => {
  describe("global AGENTS.md awareness (metadata only, never a projection target)", () => {
    it("marks Codex as natively reading the global ~/.agents/AGENTS.md file", () => {
      const codex = HARNESS_REGISTRY[AgentHarness.Codex];
      expect(codex.readsGlobalAgentsMd).toBe(true);
    });

    it("marks OpenCode as natively reading the global ~/.agents/AGENTS.md file", () => {
      const opencode = HARNESS_REGISTRY[AgentHarness.OpenCode];
      expect(opencode.readsGlobalAgentsMd).toBe(true);
    });

    it("marks Kilo as natively reading the global ~/.agents/AGENTS.md file", () => {
      const kilo = HARNESS_REGISTRY[AgentHarness.Kilo];
      expect(kilo.readsGlobalAgentsMd).toBe(true);
    });

    it("marks Copilot as natively reading the global ~/.agents/AGENTS.md file", () => {
      const copilot = HARNESS_REGISTRY[AgentHarness.Copilot];
      expect(copilot.readsGlobalAgentsMd).toBe(true);
    });

    it("does not mark ClaudeCode (imports via CLAUDE.md, not native discovery)", () => {
      const claude = HARNESS_REGISTRY[AgentHarness.ClaudeCode];
      expect(claude.readsGlobalAgentsMd).toBeFalsy();
    });

    it("does not mark Cursor (no native ~/.agents/AGENTS.md support)", () => {
      const cursor = HARNESS_REGISTRY[AgentHarness.Cursor];
      expect(cursor.readsGlobalAgentsMd).toBeFalsy();
    });

    it("includes ~/.agents/skills compatibility path for Aider", () => {
      const aider = HARNESS_REGISTRY[AgentHarness.Aider];
      expect(aider.compatibilityPaths).toContain("~/.agents/skills");
    });

    it("does not mark GeminiCli (global context is ~/.gemini/GEMINI.md, not ~/.agents/AGENTS.md)", () => {
      const gemini = HARNESS_REGISTRY[AgentHarness.GeminiCli];
      expect(gemini.readsGlobalAgentsMd).toBeFalsy();
    });

    it("does not mark Antigravity (global rules sources are all under ~/.gemini/, not ~/.agents/AGENTS.md)", () => {
      const antigravity = HARNESS_REGISTRY[AgentHarness.Antigravity];
      expect(antigravity.readsGlobalAgentsMd).toBeFalsy();
    });

    it("does not mark Amp (global AGENTS.md is $HOME/.config/amp/AGENTS.md or $HOME/.config/AGENTS.md, not ~/.agents/AGENTS.md)", () => {
      const amp = HARNESS_REGISTRY[AgentHarness.Amp];
      expect(amp.readsGlobalAgentsMd).toBeFalsy();
    });

    it("does not mark Zed (personal instructions are ~/.config/zed/AGENTS.md, not ~/.agents/AGENTS.md)", () => {
      const zed = HARNESS_REGISTRY[AgentHarness.Zed];
      expect(zed.readsGlobalAgentsMd).toBeFalsy();
    });

    it("does not mark Warp (global rules are cloud-synced via Warp Drive, not ~/.agents/AGENTS.md)", () => {
      const warp = HARNESS_REGISTRY[AgentHarness.Warp];
      expect(warp.readsGlobalAgentsMd).toBeFalsy();
    });

    it("marks FactoryAi as natively reading the global ~/.agents/AGENTS.md file", () => {
      const factory = HARNESS_REGISTRY[AgentHarness.FactoryAi];
      expect(factory.readsGlobalAgentsMd).toBe(true);
    });

    it("does not mark Augment (global scope is ~/.augment/rules/, not ~/.agents/AGENTS.md)", () => {
      const augment = HARNESS_REGISTRY[AgentHarness.Augment];
      expect(augment.readsGlobalAgentsMd).toBeFalsy();
    });

    it("never places a file path in nativeSkillPaths or compatibilityPaths for any harness", () => {
      // calculateProjectionTopology/projectSkills treat every entry in these two
      // arrays as a skill-projection *directory* target and atomically rename a
      // temp directory over it. A file path (e.g. ~/.agents/AGENTS.md) here would
      // cause init/sync to destroy that file. See registry.ts's HarnessCapability
      // doc comment.
      for (const capability of Object.values(HARNESS_REGISTRY)) {
        for (const path of [...capability.nativeSkillPaths, ...capability.compatibilityPaths]) {
          expect(path).not.toBe("~/.agents/AGENTS.md");
          expect(path.endsWith(".md")).toBe(false);
        }
      }
    });
  });

  describe("harnesses using AGENTS.md as bootstrap file", () => {
    it("Codex uses AGENTS.md", () => {
      expect(HARNESS_REGISTRY[AgentHarness.Codex].bootstrapFile).toBe("AGENTS.md");
    });

    it("OpenCode uses AGENTS.md", () => {
      expect(HARNESS_REGISTRY[AgentHarness.OpenCode].bootstrapFile).toBe("AGENTS.md");
    });

    it("Kilo uses AGENTS.md", () => {
      expect(HARNESS_REGISTRY[AgentHarness.Kilo].bootstrapFile).toBe("AGENTS.md");
    });

    it("Copilot uses AGENTS.md", () => {
      expect(HARNESS_REGISTRY[AgentHarness.Copilot].bootstrapFile).toBe("AGENTS.md");
    });

    it("Devin uses AGENTS.md (reads project rules from the root, not .devin/rules/)", () => {
      expect(HARNESS_REGISTRY[AgentHarness.Devin].bootstrapFile).toBe("AGENTS.md");
    });

    it("Aider uses AGENTS.md (wired via .aider.conf.yml's read: key, not a dedicated bootstrap file)", () => {
      expect(HARNESS_REGISTRY[AgentHarness.Aider].bootstrapFile).toBe("AGENTS.md");
    });

    it("GeminiCli uses GEMINI.md (configurable to AGENTS.md via settings.json)", () => {
      expect(HARNESS_REGISTRY[AgentHarness.GeminiCli].bootstrapFile).toBe("GEMINI.md");
    });

    it("Antigravity uses AGENTS.md (reads natively, successor to Gemini CLI)", () => {
      expect(HARNESS_REGISTRY[AgentHarness.Antigravity].bootstrapFile).toBe("AGENTS.md");
    });

    it("Amp uses AGENTS.md", () => {
      expect(HARNESS_REGISTRY[AgentHarness.Amp].bootstrapFile).toBe("AGENTS.md");
    });

    it("Zed uses AGENTS.md", () => {
      expect(HARNESS_REGISTRY[AgentHarness.Zed].bootstrapFile).toBe("AGENTS.md");
    });

    it("Warp uses AGENTS.md (WARP.md remains supported and takes priority when present, but is not a legacy file)", () => {
      expect(HARNESS_REGISTRY[AgentHarness.Warp].bootstrapFile).toBe("AGENTS.md");
    });

    it("FactoryAi uses AGENTS.md", () => {
      expect(HARNESS_REGISTRY[AgentHarness.FactoryAi].bootstrapFile).toBe("AGENTS.md");
    });

    it("Augment uses AGENTS.md", () => {
      expect(HARNESS_REGISTRY[AgentHarness.Augment].bootstrapFile).toBe("AGENTS.md");
    });
  });

  describe("Devin global skills path", () => {
    it("uses the XDG-style ~/.config/devin/skills path, not ~/.devin/skills", () => {
      const devin = HARNESS_REGISTRY[AgentHarness.Devin];
      expect(devin.nativeSkillPaths).toContain("~/.config/devin/skills");
      expect(devin.nativeSkillPaths).not.toContain("~/.devin/skills");
    });

    it("includes all Windsurf channel paths for cross-compatibility", () => {
      const devin = HARNESS_REGISTRY[AgentHarness.Devin];
      expect(devin.compatibilityPaths).toContain("~/.codeium/windsurf/skills");
      expect(devin.compatibilityPaths).toContain("~/.codeium/windsurf-next/skills");
      expect(devin.compatibilityPaths).toContain("~/.codeium/windsurf-insiders/skills");
    });
  });

  describe("GeminiCli native skills path", () => {
    it("uses ~/.gemini/skills as the native skill path", () => {
      const gemini = HARNESS_REGISTRY[AgentHarness.GeminiCli];
      expect(gemini.nativeSkillPaths).toContain("~/.gemini/skills");
    });
  });

  describe("Antigravity native skills path", () => {
    it("uses ~/.gemini/antigravity-cli/skills as the native skill path (per migration docs)", () => {
      const antigravity = HARNESS_REGISTRY[AgentHarness.Antigravity];
      expect(antigravity.nativeSkillPaths).toContain("~/.gemini/antigravity-cli/skills");
    });

    it("includes ~/.agents/skills compatibility path", () => {
      const antigravity = HARNESS_REGISTRY[AgentHarness.Antigravity];
      expect(antigravity.compatibilityPaths).toContain("~/.agents/skills");
    });
  });

  describe("Warp bootstrap file handling", () => {
    it("does not list WARP.md as a legacy bootstrap file, since Warp's own docs state WARP.md takes priority over AGENTS.md and remains fully supported (not superseded/stale)", () => {
      const warp = HARNESS_REGISTRY[AgentHarness.Warp];
      expect(warp.legacyBootstrapFiles ?? []).not.toContain("WARP.md");
    });
  });

  describe("Warp native skills paths", () => {
    it("uses ~/.agents/skills as a native skill path (recommended by docs.warp.dev/agents/capabilities/skills)", () => {
      const warp = HARNESS_REGISTRY[AgentHarness.Warp];
      expect(warp.nativeSkillPaths).toContain("~/.agents/skills");
      expect(warp.nativeSkillPaths).toContain("~/.warp/skills");
      expect(warp.compatibilityPaths).not.toContain("~/.agents/skills");
    });
  });

  describe("FactoryAi native skills paths", () => {
    it("uses .factory/skills and ~/.factory/skills as native skill paths (per docs.factory.ai/docs/harness/skills)", () => {
      const factory = HARNESS_REGISTRY[AgentHarness.FactoryAi];
      expect(factory.nativeSkillPaths).toContain(".factory/skills");
      expect(factory.nativeSkillPaths).toContain("~/.factory/skills");
    });

    it("includes ~/.agents/skills compatibility path", () => {
      const factory = HARNESS_REGISTRY[AgentHarness.FactoryAi];
      expect(factory.compatibilityPaths).toContain("~/.agents/skills");
    });
  });

  describe("Amp native skills path", () => {
    it("uses ~/.agents/skills as a native skill path (documented discovery tier, per ampcode.com/docs/customize/skills)", () => {
      const amp = HARNESS_REGISTRY[AgentHarness.Amp];
      expect(amp.nativeSkillPaths).toContain("~/.agents/skills");
      expect(amp.compatibilityPaths).not.toContain("~/.agents/skills");
    });
  });

  describe("Zed native skills path", () => {
    it("uses ~/.agents/skills as its only native skill path (its sole documented skills mechanism, per zed.dev/docs/ai/skills)", () => {
      const zed = HARNESS_REGISTRY[AgentHarness.Zed];
      expect(zed.nativeSkillPaths).toContain("~/.agents/skills");
      expect(zed.compatibilityPaths).not.toContain("~/.agents/skills");
    });
  });
});
