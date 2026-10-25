import { ReleaseChannel } from "../types/index";
import { ConfigValidationError } from "../utils/errors";
import type { EngineeringConfig, EngineeringLock } from "../types/index";

export function requireInitialized(config: EngineeringConfig | undefined | null, lock: EngineeringLock | undefined | null): [EngineeringConfig, EngineeringLock] {
  if (!config || !lock) {
    throw new ConfigValidationError("Not initialized. Run 'codeflex-playbooks init' first.");
  }
  return [config, lock];
}

export function parseChannel(input: string | undefined): ReleaseChannel | undefined {
  if (!input) return undefined;
  if (input !== ReleaseChannel.Stable && input !== ReleaseChannel.Canary) {
    throw new ConfigValidationError(`Invalid channel '${input}'. Must be 'stable' or 'canary'.`);
  }
  return input;
}
