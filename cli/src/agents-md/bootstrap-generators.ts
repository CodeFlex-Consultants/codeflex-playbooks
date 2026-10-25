import { join } from "node:path";
import { AgentHarness } from "../types/index";
import { createBootstrapGenerator } from "./bootstrap-file";
import type { BootstrapFileInput, BootstrapFileResult } from "./bootstrap-file";

export type GenerateClaudeMdInput = BootstrapFileInput;
export type GenerateClaudeMdResult = BootstrapFileResult;
export const generateClaudeMd = createBootstrapGenerator(AgentHarness.ClaudeCode);

export type GenerateCursorRulesMdInput = BootstrapFileInput;
export type GenerateCursorRulesMdResult = BootstrapFileResult;
export const generateCursorRulesMd = createBootstrapGenerator(AgentHarness.Cursor);

export type GenerateZooCodeRulesMdInput = BootstrapFileInput;
export type GenerateZooCodeRulesMdResult = BootstrapFileResult;
export const generateZooCodeRulesMd = createBootstrapGenerator(AgentHarness.ZooCode);

// NOTE: Devin has no dedicated bootstrap-file generator. Devin CLI reads project
// rules from `AGENTS.md` at the project root natively (see `HARNESS_REGISTRY` in
// `../projection/registry.js`), so no per-harness bootstrap file is generated for it.

// NOTE: JetBrains Junie reads AGENTS.md from the project root natively (verified
// at https://www.jetbrains.com/help/ai-assistant/junie-agent.html), so no
// dedicated bootstrap file is generated for it (same as Devin/Aider). Legacy
// .junie/AGENTS.md and .junie/guidelines.md files are cleaned up via
// legacyBootstrapFiles in HARNESS_REGISTRY.
export type GenerateJetbrainsGuidelinesMdInput = BootstrapFileInput;
export type GenerateJetbrainsGuidelinesMdResult = BootstrapFileResult;
export async function generateJetbrainsGuidelinesMd(input: BootstrapFileInput): Promise<BootstrapFileResult> {
  return { action: "skipped", path: join(input.projectRoot, "AGENTS.md") };
}

export type GenerateClinerulesMdInput = BootstrapFileInput;
export type GenerateClinerulesMdResult = BootstrapFileResult;
export const generateClinerulesMd = createBootstrapGenerator(AgentHarness.Cline);

// NOTE: Aider has no dedicated bootstrap-file generator either. Aider only loads
// `AGENTS.md` when explicitly listed under `read:` in `.aider.conf.yml`; see
// `ensureAiderReadsAgentsMd` in `./aider-config.js` for that wiring.
