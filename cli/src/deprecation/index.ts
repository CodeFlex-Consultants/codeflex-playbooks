export {
  DeprecationSeverity,
  DeprecationCategory,
  type DeprecationEntry,
  type DeprecationCheckResult,
  type DeprecationCheckOptions,
  type DeprecationReport,
} from "./types";

export {
  DEPRECATION_REGISTRY,
} from "./registry";

export {
  checkDeprecations,
  hasDeprecationErrors,
} from "./checker";

export {
  formatDeprecationReport,
  formatDeprecationsClassified,
  type FormattedDeprecations,
} from "./formatter";
