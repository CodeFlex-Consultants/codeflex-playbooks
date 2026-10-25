# Integration and Error Handling

Detailed guidance for verifying subagent results, resolving conflicts,
handling failures, and reporting honestly.

## Result verification checklist

Before accepting a subagent's result, verify each of these:

1. **Completeness** — does the result address every part of the objective?
   Check each requirement or deliverable named in the prompt.
2. **Scope adherence** — did the subagent stay within its declared scope?
   Check that no files outside the scope were modified.
3. **Correctness** — does the result actually work? Run tests, check
   builds, inspect output. A subagent's self-reported success is not
   sufficient.
4. **Consistency** — if multiple subagents ran in parallel, are their
   results consistent with each other? Do they make compatible decisions
   about shared interfaces, naming, or architecture?
5. **Evidence** — does the result include evidence (test output, file
   paths, command results) rather than just claims?

## Conflict resolution between parallel results

When parallel subagents produce conflicting results:

1. **Identify the conflict** — what specifically contradicts? (e.g., two
   subagents modified the same interface differently, or made incompatible
   architectural decisions.)
2. **Determine precedence** — which subagent's scope was more specific to
   the conflicting area? The subagent with narrower, more specific scope
   takes precedence for that area.
3. **Resolve manually** — the orchestrator must make the decision, not
   defer to either subagent. Choose the resolution that best serves the
   overall objective.
4. **Apply the resolution** — make the necessary adjustments to ensure
   consistency across all results.
5. **Re-verify** — after resolving conflicts, re-run verification to
   ensure the integrated result is correct.

## Retry strategy

When a subagent fails:

1. **Analyse the failure** — read the subagent's error report. What
   specifically went wrong? Was the prompt ambiguous? Did the subagent
   lack information? Was the scope too broad?
2. **Refine the prompt** — address the specific failure cause. Do not
   retry with the same prompt. Examples:
   - If the subagent was confused about scope, add explicit file paths.
   - If the subagent lacked context, include the relevant information.
   - If the task was too broad, narrow the scope.
3. **Retry once** — spawn a new subagent with the refined prompt.
4. **Fall back to inline** — if the retry also fails, complete the work
   inline. The orchestrator has the full context and can handle the task
   directly.

Never retry more than once. Never retry with an identical or nearly
identical prompt. Two failures indicate a fundamental issue with the
decomposition, not bad luck.

## Fallback to inline execution

When falling back to inline execution after subagent failure:

1. **Acknowledge the failure** — tell the user that subagent delegation
   failed and you are completing the work inline.
2. **Use the subagent's partial results** — if the subagent produced any
   useful intermediate output, incorporate it. Do not start from scratch
   if partial progress was made.
3. **Complete the work** — perform the task directly in the main context.
4. **Verify** — apply the same verification you would have expected from
   the subagent.

## Honest failure reporting

When reporting subagent failures:

- **State what failed** — which subagent, what objective, what went wrong.
- **Include the error** — quote the subagent's error message or describe
  the failure mode.
- **State what was tried** — how many retries, what prompt refinements
  were made.
- **State the resolution** — did you fall back to inline? Did you skip
  the task? Did you ask the user for guidance?
- **Do not mask failures** — never report a failed subagent as "partially
  successful" or "completed with caveats" when it actually failed. A
  failure is a failure; report it honestly.

## When to report to the user vs handle internally

Handle internally:
- A single subagent failure that you successfully resolved by retry or
  inline fallback, with no impact on the final result.
- Minor scope deviations that you corrected during integration.

Report to the user:
- A subagent failure that affected the final result or required you to
  skip part of the task.
- Conflicts between parallel results that you could not resolve
  confidently.
- Any situation where the user's input is needed to decide how to
  proceed.
