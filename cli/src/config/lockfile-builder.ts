import type { StandardsSource, EngineeringLock } from "../types/index";
import { ReleaseChannel } from "../types/index";
import { resolveStandards } from "../resolution/index";

export function buildLock(
  codeflexSource: StandardsSource,
  clientSourceList: StandardsSource[],
  repositorySourceList: StandardsSource[],
  resolution: Awaited<ReturnType<typeof resolveStandards>>,
  channel?: ReleaseChannel,
): Omit<EngineeringLock, "projections" | "managedProjections"> {
  return {
    version: 1,
    sources: {
      codeflex: {
        release: codeflexSource.release ?? "local",
        commit: codeflexSource.commit ?? "",
        sha256: codeflexSource.sha256,
        ...(channel ? { channel } : {}),
      },
      client: clientSourceList.map((cs) => ({
        id: cs.id ?? "local",
        source: cs.type,
        sha256: cs.sha256,
      })),
      repository: repositorySourceList.map((rs) => ({
        id: rs.id ?? "local",
        path: rs.skillsDir,
        sha256: rs.sha256,
      })),
    },
    skills: resolution.skills.map((s) => s.slug),
    skillSources: Object.fromEntries(resolution.skills.map((s) => [s.slug, s.source])),
    resolvedOverrides: resolution.overrides,
    ...((resolution.unmatchedTechnologies?.length ?? 0) > 0
      ? {
          unmatchedTechnologies: resolution.unmatchedTechnologies!.map((t) => ({
            name: t.name,
            ...(t.version ? { version: t.version } : {}),
            matchedBy: t.matchedBy,
          })),
        }
      : {}),
  };
}
