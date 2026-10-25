import { z } from "zod";
import { SkillSource, OverridePolicy, ClientSourceType, CodeFlexSourceType, ReleaseChannel, AgentHarness } from "./enums";

const installConditionSchema = z.object({
  packageReference: z.object({
    package: z.string(),
    version: z.string(),
  }).optional(),
  file: z.object({
    pattern: z.string(),
  }).optional(),
});

export const codeflexYamlSchema = z.object({
  id: z.string(),
  source: z.enum(SkillSource),
  overridePolicy: z.enum(OverridePolicy),
  nonOverridableRules: z.array(z.string()).optional(),
  owner: z.object({
    team: z.string(),
  }),
  installWhen: z.object({
    any: z.array(installConditionSchema),
  }).optional(),
  requires: z.array(z.string()).optional(),
  appliesWhen: z.object({
    paths: z.array(z.string()).optional(),
    capabilities: z.array(z.string()).optional(),
  }).optional(),
  rules: z.array(z.string()).optional(),
  references: z.array(z.string()).optional(),
  scripts: z.array(z.string()).optional(),
  review: z.object({
    lastReviewed: z.string(),
    reviewBy: z.string(),
    requiredReviewers: z.array(z.string()).optional(),
  }).optional(),
  overrides: z.array(z.string()).optional(),
});

export const skillManifestSchema = z.object({
  name: z.string(),
  version: z.string().optional(),
  description: z.string(),
});

const repositorySourceSchema = z.object({
  type: z.literal(ClientSourceType.Repository),
  path: z.string(),
  url: z.string().optional(),
  ref: z.string().optional(),
});

const gitSourceSchema = z.object({
  type: z.literal(ClientSourceType.Git),
  path: z.string().optional(),
  url: z.string().url(),
  ref: z.string().optional(),
});

const clientStandardSourceSchema = z.object({
  id: z.string(),
  source: z.discriminatedUnion("type", [repositorySourceSchema, gitSourceSchema]),
});

const repositoryStandardSourceSchema = z.object({
  id: z.string(),
  path: z.string(),
});

const releaseChannelSchema = z.enum(ReleaseChannel);

const codeflexLocalSourceSchema = z.object({
  type: z.literal(CodeFlexSourceType.Local),
  path: z.string(),
});

const codeflexGitSourceSchema = z.object({
  type: z.literal(CodeFlexSourceType.Git),
  url: z.string().url(),
  ref: z.string().optional(),
  expectedCommit: z.string().optional(),
  protectedBranches: z.array(z.string()).optional(),
  channel: releaseChannelSchema.optional(),
});

const codeflexReleaseSourceSchema = z.object({
  type: z.literal(CodeFlexSourceType.Release),
  url: z.string().url(),
  expectedSha256: z.string(),
  channel: releaseChannelSchema.optional(),
});

export const codeflexSourceSchema = z.discriminatedUnion("type", [
  codeflexLocalSourceSchema,
  codeflexGitSourceSchema,
  codeflexReleaseSourceSchema,
]);

export const releaseManifestSchema = z.object({
  release: z.string(),
  commit: z.string(),
  sha256: z.string(),
  branch: z.string(),
  pipeline: z.object({
    id: z.string(),
    runId: z.string(),
    url: z.string().optional(),
  }).optional(),
  attestation: z.object({
    type: z.string(),
    signature: z.string(),
    verified: z.boolean(),
  }).optional(),
});

const ruleExceptionSchema = z.object({
  rule: z.string(),
  reason: z.string().optional(),
  approvedBy: z.string().optional(),
  reference: z.string().optional(),
  expires: z.string().optional(),
});

export const engineeringConfigSchema = z.object({
  version: z.number().int().min(1),
  autoDetect: z.boolean(),
  agentHarnesses: z.array(z.enum(AgentHarness)),
  standards: z.object({
    codeflex: z.object({
      enabled: z.boolean(),
      source: codeflexSourceSchema.optional(),
    }),
    client: z.array(clientStandardSourceSchema).optional(),
    repository: z.array(repositoryStandardSourceSchema).optional(),
  }),
  include: z.array(z.string()),
  exclude: z.array(z.string()),
  scopes: z.record(z.string(), z.array(z.string())),
  exceptions: z.array(ruleExceptionSchema),
});

const lockedClientSourceSchema = z.object({
  id: z.string(),
  source: z.string(),
  sha256: z.string(),
});

const lockedRepositorySourceSchema = z.object({
  id: z.string(),
  path: z.string(),
  sha256: z.string(),
});

const lockedProjectionSchema = z.object({
  adapters: z.array(z.enum(AgentHarness)),
  path: z.string(),
});

export const engineeringLockSchema = z.object({
  version: z.number().int().min(1),
  sources: z.object({
    codeflex: z.object({
      release: z.string(),
      commit: z.string(),
      sha256: z.string(),
      channel: releaseChannelSchema.optional(),
    }).optional(),
    client: z.array(lockedClientSourceSchema).optional(),
    repository: z.array(lockedRepositorySourceSchema).optional(),
  }),
  skills: z.array(z.string()),
  skillSources: z.record(z.string(), z.enum(SkillSource)).optional(),
  skillHashes: z.record(z.string(), z.string()).optional(),
  resolvedOverrides: z.record(z.string(), z.string()).optional(),
  projections: z.array(lockedProjectionSchema).optional(),
  managedProjections: z.record(z.string(), z.array(z.string())).optional(),
  crossCuttingSkills: z.array(z.string()).optional(),
});

export type EngineeringConfigInput = z.infer<typeof engineeringConfigSchema>;
export type EngineeringLockInput = z.infer<typeof engineeringLockSchema>;
export type CodeFlexYamlInput = z.infer<typeof codeflexYamlSchema>;
export type SkillManifestInput = z.infer<typeof skillManifestSchema>;
