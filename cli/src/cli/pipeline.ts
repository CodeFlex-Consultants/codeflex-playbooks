import type { StandardsSource, EngineeringConfig, DetectionResult, Diagnostic } from "../types/index";
import { ReleaseChannel, SkillSource, DiagnosticSeverity } from "../types/index";
import { resolveStandards } from "../resolution/index";
import { loadSkillsFromSource, loadSkillsFromSourceWithDiagnostics } from "../resolution/skill-loader";
import { verifyTrustedRelease } from "../integrity/release-verifier";
import { fetchCodeFlexSource, fetchClientSource, fetchRepositorySource } from "../skills/source-fetcher";
import { ConfigValidationError, ResolutionConflictError, errorMessage } from "../utils/errors";
import type { Reporter } from "./reporter";
import { consoleReporter } from "./reporter";

export interface FetchSourcesOptions {
  projectRoot: string;
  config: EngineeringConfig;
  channel?: ReleaseChannel;
  reporter?: Reporter;
}

export interface FetchedSources {
  codeflexSource: StandardsSource;
  clientSourceList: StandardsSource[];
  repositorySourceList: StandardsSource[];
  sources: StandardsSource[];
}

export async function fetchAllSources(options: FetchSourcesOptions): Promise<FetchedSources> {
  const { projectRoot, config, channel } = options;
  const reporter = options.reporter ?? consoleReporter;

  reporter.info("Fetching sources...");
  let codeflexSource: StandardsSource;
  try {
    const codeflexResult = await fetchCodeFlexSource(config.standards.codeflex.source, undefined, channel);
    codeflexSource = codeflexResult.source;
    for (const warning of codeflexResult.warnings) {
      reporter.warn(`Warning: ${warning}`);
    }
  } catch (err) {
    const message = errorMessage(err);
    throw new ConfigValidationError(`Failed to fetch CodeFlex source: ${message}`);
  }

  const sources: StandardsSource[] = [codeflexSource];
  const clientSourceList: StandardsSource[] = [];
  const repositorySourceList: StandardsSource[] = [];

  if (config.standards.client && config.standards.client.length > 0) {
    const clientResults = await Promise.all(
      config.standards.client.map(async (clientConfig) => {
        try {
          return { source: await fetchClientSource({ source: clientConfig, projectRoot }), id: clientConfig.id };
        } catch (err) {
          const message = errorMessage(err);
          throw new ConfigValidationError(`Failed to fetch client source '${clientConfig.id}': ${message}`);
        }
      }),
    );
    for (const result of clientResults) {
      clientSourceList.push(result.source);
      sources.push(result.source);
    }
  }

  if (config.standards.repository && config.standards.repository.length > 0) {
    const repoResults = await Promise.all(
      config.standards.repository.map(async (repoConfig) => {
        try {
          return { source: await fetchRepositorySource(repoConfig, projectRoot), id: repoConfig.id };
        } catch (err) {
          const message = errorMessage(err);
          throw new ConfigValidationError(`Failed to fetch repository source '${repoConfig.id}': ${message}`);
        }
      }),
    );
    for (const result of repoResults) {
      repositorySourceList.push(result.source);
      sources.push(result.source);
    }
  }

  return { codeflexSource, clientSourceList, repositorySourceList, sources };
}

export interface VerifyIntegrityOptions {
  codeflexSource: StandardsSource;
  reporter?: Reporter;
}

/**
 * Soft integrity check: verifies the trusted-release signature of the CodeFlex
 * source against the lockfile and warns on any issues, but never throws.
 *
 * Distinct from `assertCodeFlexIntegrity` (in `integrity/release-verifier.ts`),
 * which throws on failure. Use this during pipelines where a degraded result
 * is acceptable and the operator should decide how to react.
 */
export async function verifyIntegrity(options: VerifyIntegrityOptions): Promise<void> {
  const { codeflexSource } = options;
  const reporter = options.reporter ?? consoleReporter;

  const integrityResult = await verifyTrustedRelease(codeflexSource, {
    version: 1,
    sources: {
      codeflex: {
        release: codeflexSource.release ?? "local",
        commit: codeflexSource.commit ?? "",
        sha256: codeflexSource.sha256,
      },
    },
    skills: [],
  });
  if (!integrityResult.valid) {
    reporter.warn("Warning: Integrity verification found issues:");
    for (const error of integrityResult.errors) {
      reporter.warn(`  - ${error}`);
    }
  }
}


export interface LoadAllSkillsOptions {
  codeflexSource: StandardsSource;
  clientSourceList: StandardsSource[];
  repositorySourceList: StandardsSource[];
  config: EngineeringConfig;
  reporter?: Reporter;
}

export interface LoadedAllSkills {
  codeflexSkills: Awaited<ReturnType<typeof loadSkillsFromSource>>;
  clientSkills: Awaited<ReturnType<typeof loadSkillsFromSource>>;
  repositorySkills: Awaited<ReturnType<typeof loadSkillsFromSource>>;
}

function reportDiagnostics(reporter: Reporter, label: string, diagnostics: Diagnostic[]): void {
  for (const diagnostic of diagnostics) {
    const message = `${label}: ${diagnostic.message}`;
    if (diagnostic.severity === DiagnosticSeverity.Error) {
      reporter.error(message);
    } else {
      reporter.warn(message);
    }
  }
}

export async function loadAllSkills(options: LoadAllSkillsOptions): Promise<LoadedAllSkills> {
  const { codeflexSource, clientSourceList, repositorySourceList } = options;
  const reporter = options.reporter ?? consoleReporter;

  const codeflexResult = await loadSkillsFromSourceWithDiagnostics(codeflexSource.skillsDir, SkillSource.CodeFlex);
  reportDiagnostics(reporter, "CodeFlex skill source", codeflexResult.diagnostics);
  const codeflexSkills = codeflexResult.skills;

  const clientResults = await Promise.all(
    clientSourceList.map((cs) => loadSkillsFromSourceWithDiagnostics(cs.skillsDir, SkillSource.Client).then((r) => ({ ...r, id: cs.id }))),
  );
  let clientSkills: Awaited<ReturnType<typeof loadSkillsFromSource>> = [];
  for (const result of clientResults) {
    reportDiagnostics(reporter, `Client skill source '${result.id ?? "unknown"}'`, result.diagnostics);
    clientSkills.push(...result.skills);
  }

  const repoResults = await Promise.all(
    repositorySourceList.map((rs) => loadSkillsFromSourceWithDiagnostics(rs.skillsDir, SkillSource.Repository).then((r) => ({ ...r, id: rs.id }))),
  );
  let repositorySkills: Awaited<ReturnType<typeof loadSkillsFromSource>> = [];
  for (const result of repoResults) {
    reportDiagnostics(reporter, `Repository skill source '${result.id ?? "unknown"}'`, result.diagnostics);
    repositorySkills.push(...result.skills);
  }

  if (codeflexSkills.length === 0) {
    reporter.warn(
      `Warning: No CodeFlex skills were loaded from ${codeflexSource.skillsDir}. ` +
      `No CodeFlex baseline standards will be applied to this repository.`
    );
  }

  return { codeflexSkills, clientSkills, repositorySkills };
}

export interface ResolveAndCheckOptions {
  detection: DetectionResult;
  config: EngineeringConfig;
  codeflexSkills: Awaited<ReturnType<typeof loadSkillsFromSource>>;
  clientSkills: Awaited<ReturnType<typeof loadSkillsFromSource>>;
  repositorySkills: Awaited<ReturnType<typeof loadSkillsFromSource>>;
  reporter?: Reporter;
}

export async function resolveAndCheck(options: ResolveAndCheckOptions): Promise<Awaited<ReturnType<typeof resolveStandards>>> {
  const reporter = options.reporter ?? consoleReporter;

  reporter.info("Resolving standards...");
  const resolution = await resolveStandards({
    detection: options.detection,
    config: options.config,
    codeflexSkills: options.codeflexSkills,
    clientSkills: options.clientSkills,
    repositorySkills: options.repositorySkills,
  });

  if (resolution.nonOverridableConflicts.length > 0) {
    const details = resolution.nonOverridableConflicts.map(
      (c) => `  - Rule "${c.rule}" is required (non-overridable) but conflicts between: ${c.sources.join(", ")}`
    ).join("\n");
    throw new ResolutionConflictError(
      "Non-overridable rule conflicts detected. These require explicit escalation.",
      details,
    );
  }

  if (resolution.conflicts.length > 0) {
    reporter.warn("Warning: Resolution conflicts detected:");
    for (const conflict of resolution.conflicts) {
      reporter.warn(`  - ${conflict.rule}: ${conflict.sources.join(" vs ")}`);
    }
  }

  if (resolution.unmatchedTechnologies.length > 0) {
    const techList = resolution.unmatchedTechnologies.map((t) => t.name).join(", ");
    reporter.info(`Note: ${resolution.unmatchedTechnologies.length} detected technologies have no corresponding skill: ${techList}`);
  }

  return resolution;
}

export function findCodeFlexSource(sources: StandardsSource[]): StandardsSource | undefined {
  return sources.find((s) => s.type === SkillSource.CodeFlex);
}

export interface RunPostFetchPipelineOptions {
  codeflexSource: StandardsSource;
  clientSourceList: StandardsSource[];
  repositorySourceList: StandardsSource[];
  detection: DetectionResult;
  config: EngineeringConfig;
  reporter?: Reporter;
}

export interface PostFetchPipelineResult {
  codeflexSkills: Awaited<ReturnType<typeof loadSkillsFromSource>>;
  clientSkills: Awaited<ReturnType<typeof loadSkillsFromSource>>;
  repositorySkills: Awaited<ReturnType<typeof loadSkillsFromSource>>;
  resolution: Awaited<ReturnType<typeof resolveStandards>>;
}

/**
 * Runs the shared integrity-verify -> skill-load -> resolve sequence used by
 * both `init` (fresh project setup) and `diff`/`update` (re-detection against
 * existing config), once sources have already been fetched via
 * `fetchAllSources`. Keeping this in one place ensures both flows stay in
 * lockstep when the pipeline order or error handling changes.
 *
 * Deliberately excludes `fetchAllSources` so callers can fetch sources
 * outside of their own try/finally and guarantee `cleanupSources` runs even
 * if this step throws.
 */
export async function runPostFetchPipeline(options: RunPostFetchPipelineOptions): Promise<PostFetchPipelineResult> {
  const { codeflexSource, clientSourceList, repositorySourceList, detection, config } = options;
  const reporter = options.reporter ?? consoleReporter;

  await verifyIntegrity({ codeflexSource, reporter });

  reporter.info("Loading skills...");
  const { codeflexSkills, clientSkills, repositorySkills } = await loadAllSkills({
    codeflexSource,
    clientSourceList,
    repositorySourceList,
    config,
    reporter,
  });

  const resolution = await resolveAndCheck({
    detection,
    config,
    codeflexSkills,
    clientSkills,
    repositorySkills,
    reporter,
  });

  return { codeflexSkills, clientSkills, repositorySkills, resolution };
}

export interface DetectionPipelineOptions {
  projectRoot: string;
  config: EngineeringConfig;
  channel?: ReleaseChannel;
  reporter?: Reporter;
}

export interface DetectionPipelineResult {
  detection: import("../types/index.js").DetectionResult;
  config: EngineeringConfig;
  codeflexSource: StandardsSource;
  clientSourceList: StandardsSource[];
  repositorySourceList: StandardsSource[];
  sources: StandardsSource[];
  codeflexSkills: Awaited<ReturnType<typeof loadSkillsFromSource>>;
  clientSkills: Awaited<ReturnType<typeof loadSkillsFromSource>>;
  repositorySkills: Awaited<ReturnType<typeof loadSkillsFromSource>>;
  resolution: Awaited<ReturnType<typeof resolveStandards>>;
}

export async function runDetectionPipeline(
  options: DetectionPipelineOptions,
  autoDetectHarnesses: (projectRoot: string, config: EngineeringConfig, reporter: Reporter) => Promise<EngineeringConfig>,
): Promise<DetectionPipelineResult> {
  const { projectRoot, config, channel } = options;
  const reporter = options.reporter ?? consoleReporter;

  reporter.info("Detecting technologies...");
  const { detectProject } = await import("../detection/index.js");
  const detection = await detectProject(projectRoot);

  const updatedConfig = await autoDetectHarnesses(projectRoot, config, reporter);

  const { codeflexSource, clientSourceList, repositorySourceList, sources } = await fetchAllSources({
    projectRoot,
    config: updatedConfig,
    channel,
    reporter,
  });

  const postFetchResult = await runPostFetchPipeline({
    codeflexSource,
    clientSourceList,
    repositorySourceList,
    detection,
    config: updatedConfig,
    reporter,
  });

  return {
    detection,
    config: updatedConfig,
    codeflexSource,
    clientSourceList,
    repositorySourceList,
    sources,
    ...postFetchResult,
  };
}


