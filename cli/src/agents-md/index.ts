export { normalizeAgentsMd, isManagedSectionCurrent } from "./normalizer";
export type { NormalizeInput, NormalizeResult } from "./normalizer";

export { normalizeGlobalAgentsMd } from "./global-normalizer";
export type { NormalizeGlobalInput, NormalizeGlobalResult } from "./global-normalizer";

export { generateGlobalManagedSection } from "./global-section-generator";

export {
  globalAgentsDirPath,
  globalAgentsMdPath,
  GLOBAL_AGENTS_DIR_NAME,
  GLOBAL_AGENTS_MD_FILENAME,
  GLOBAL_SKILLS_DIR_NAME,
} from "./global-paths";

export {
  generateClaudeMd,
  generateCursorRulesMd,
  generateZooCodeRulesMd,
  generateJetbrainsGuidelinesMd,
  generateClinerulesMd,
} from "./bootstrap-generators";
export type {
  GenerateClaudeMdInput,
  GenerateClaudeMdResult,
  GenerateCursorRulesMdInput,
  GenerateCursorRulesMdResult,
  GenerateZooCodeRulesMdInput,
  GenerateZooCodeRulesMdResult,
  GenerateJetbrainsGuidelinesMdInput,
  GenerateJetbrainsGuidelinesMdResult,
  GenerateClinerulesMdInput,
  GenerateClinerulesMdResult,
} from "./bootstrap-generators";

export { ensureAiderReadsAgentsMd, AIDER_CONF_FILENAME } from "./aider-config";
export type { EnsureAiderReadsAgentsMdInput, EnsureAiderReadsAgentsMdResult } from "./aider-config";

export { generateManagedSection } from "./section-generator";

export { MANAGED_SECTION_START, MANAGED_SECTION_END } from "./markers";

export { BOOTSTRAP_REGISTRY } from "./bootstrap-registry";
export type { HarnessBootstrapConfig } from "./bootstrap-registry";
export { generateAllBootstrapFiles } from "./bootstrap-file";
