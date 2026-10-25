import type { RuleException } from "../types/index";

export interface ExceptionResult {
  active: Map<string, string>;
  excepted: RuleException[];
  expired: RuleException[];
}

export function applyExceptions(
  rules: Map<string, string>,
  exceptions: RuleException[]
): ExceptionResult {
  const active = new Map(rules);
  const excepted: RuleException[] = [];
  const expired: RuleException[] = [];

  const now = new Date();

  for (const exception of exceptions) {
    if (exception.expires) {
      const expiresDate = new Date(exception.expires);
      if (expiresDate < now) {
        expired.push(exception);
        continue;
      }
    }

    if (active.has(exception.rule)) {
      active.delete(exception.rule);
      excepted.push(exception);
    }
  }

  return { active, excepted, expired };
}
