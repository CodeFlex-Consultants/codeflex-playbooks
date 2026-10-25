export { detectProject } from "./detection/index";

export { resolveStandards } from "./resolution/index";
export { loadSkillsFromSource } from "./resolution/skill-loader";

export {
  installSkills,
  fetchCodeFlexSource,
  fetchClientSource,
  readCanonicalStore,
  writeCanonicalStore,
  swapDirectory,
} from "./skills/index";
export type { InstallInput, InstallResult, FetchOptions, SkillDirectory, SkillContent } from "./skills/index";

export {
  HARNESS_REGISTRY,
  calculateProjectionTopology,
  projectSkills,
  cleanStaleProjections,
  generateScopedRules,
  calculateScopedRules,
} from "./projection/index";
export type {
  HarnessCapability,
  ProjectionTarget,
  ProjectionPlan,
  ProjectSkillsInput,
  ProjectSkillsResult,
  CleanStaleInput,
  CleanStaleResult,
  ScopedRule,
  GenerateScopedRulesInput,
  GenerateScopedRulesResult,
} from "./projection/index";

export {
  loadConfig,
  saveConfig,
  loadLock,
  saveLock,
  createDefaultConfig,
  codeflexDir,
  skillsDir,
} from "./config/index";

export {
  normalizeAgentsMd,
  generateClaudeMd,
  generateCursorRulesMd,
  generateZooCodeRulesMd,
  generateJetbrainsGuidelinesMd,
  generateClinerulesMd,
  generateManagedSection,
  ensureAiderReadsAgentsMd,
  MANAGED_SECTION_START,
  MANAGED_SECTION_END,
} from "./agents-md/index";
export type {
  NormalizeInput,
  NormalizeResult,
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
  EnsureAiderReadsAgentsMdInput,
  EnsureAiderReadsAgentsMdResult,
} from "./agents-md/index";

export {
  verifyTrustedRelease,
  verifyLockfileConsistency,
  verifyProjection,
} from "./integrity/index";
export type {
  IntegrityResult,
  ConsistencyResult,
  ProjectionVerification,
  StaleProjection,
  MissingProjection,
} from "./integrity/index";

export {
  CodeFlexError,
  ConfigValidationError,
  LockfileMissingError,
  IntegrityError,
  ResolutionConflictError,
  SourceFetchError,
  ClientStandardsDroppedError,
} from "./utils/errors";

export type {
  CodeFlexYaml,
  InstallCondition,
  SkillManifest,
  EngineeringConfig,
  ClientStandardSource,
  RepositorySource,
  GitSource,
  RepositoryStandardSource,
  ReleaseChannel,
  CodeFlexSource,
  ReleaseManifest,
  RuleException,
  EngineeringLock,
  LockedClientSource,
  LockedRepositorySource,
  LockedProjection,
  Capability,
  DetectionResult,
  DetectedTechnology,
  ResolvedSkill,
  ResolutionResult,
  ResolutionConflict,
  LoadedSkill,
  StandardsSource,
  Diagnostic,
  CommandContext,
  ResolutionInput,
  ResolutionExplanation,
  UnmatchedTechnology,
} from "./types/index";
