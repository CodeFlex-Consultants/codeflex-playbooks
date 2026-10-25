export { verifyTrustedRelease } from "./release-verifier";
export type { IntegrityResult } from "./release-verifier";

export { verifyLockfileConsistency } from "./lockfile-verifier";
export type { ConsistencyResult } from "./lockfile-verifier";

export { verifyProjection } from "./projection-verifier";
export type { ProjectionVerification, StaleProjection, MissingProjection } from "./projection-verifier";
