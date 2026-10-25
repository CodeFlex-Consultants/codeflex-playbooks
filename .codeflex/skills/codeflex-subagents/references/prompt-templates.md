# Subagent Prompt Templates

Templates for structuring subagent prompts across common task types.
Every prompt must include all five required sections per SUBAGENT-002.

## Required sections

Every subagent prompt must contain these five sections, in this order:

1. **Objective** — one sentence stating what the subagent must accomplish.
2. **Scope boundaries** — the specific files, directories, or areas the
   subagent may read and modify.
3. **Expected output format** — what the subagent returns.
4. **Success criteria** — how the orchestrator will verify the result.
5. **Report-back format** — what the subagent must include in its final
   message.

## Explore / research subagent

Use when the task is to investigate, search, or gather information without
making changes.

```
Objective: Research [specific topic] and return a structured summary.

Scope boundaries:
- Read-only access to [directories/files].
- May search the web for [specific sources] if needed.
- Must not modify any files.

Expected output format:
- A markdown summary with sections for [topic areas].
- Each claim must cite its source (file path and line, or URL).

Success criteria:
- All [specific aspects] are covered.
- Every claim is backed by a citation.
- No speculation without evidence.

Report-back format:
- Summary of findings (structured as above).
- List of sources consulted.
- Any areas where information was incomplete or conflicting.
```

## Implementation subagent

Use when the task is to make specific code changes.

```
Objective: Implement [specific change] in [specific area].

Scope boundaries:
- May read and modify files in [directory/file list].
- Must not modify files outside this scope.
- Must not add new dependencies without explicit approval.

Expected output format:
- List of files modified with a one-line summary of each change.
- Any new files created.

Success criteria:
- [Specific functional requirement] is met.
- Existing tests still pass (or are updated if the change requires it).
- No regressions in [specific area].

Report-back format:
- Files changed and what was changed in each.
- Test results (pass/fail with counts).
- Any deviations from the plan and why.
- Any blockers encountered.
```

## Verification subagent

Use when the task is to verify that changes meet requirements.

```
Objective: Verify that [specific changes] meet [specific requirements].

Scope boundaries:
- Read-only access to [directories/files].
- May run tests, lint, build, or other verification commands.
- Must not modify any files.

Expected output format:
- Verification report with pass/fail for each criterion.
- Evidence for each verdict (test output, build log, inspection result).

Success criteria:
- Every requirement in [list] has a corresponding verification.
- Every verification has evidence (not just "looks correct").

Report-back format:
- Table of requirements vs verification status.
- Evidence for each (command output, file inspection, test results).
- Any requirements that could not be verified and why.
- Overall verdict: PASS or FAIL with reason.
```

## Anti-patterns

**Vague objective:** "Look into the caching issue" — no clear deliverable.
**Missing scope:** "Fix the bug" — no boundaries, subagent may touch anything.
**No output format:** "Do the research" — orchestrator cannot integrate unstructured results.
**No success criteria:** "Make it better" — no way to verify the result.
**No report-back format:** subagent returns a wall of text the orchestrator cannot parse.
