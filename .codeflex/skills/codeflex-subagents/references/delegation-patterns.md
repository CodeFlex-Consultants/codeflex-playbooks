# Delegation Patterns

Detailed guidance for deciding when and how to delegate work to subagents.

## Triviality gate

A task is trivial — and should be handled inline — when ALL of these are true:

- Touches a single file.
- Changes fewer than 10 lines.
- Introduces no new behaviour (bug fix with a known one-line correction,
  typo, config value change).
- The exact change is already clear without further search.

Everything else is a candidate for delegation. When unsure, the triviality
gate has not been passed — consider delegation.

## Parallelisable work identification

Work is parallelisable when it meets all three criteria:

1. **Independence** — the task does not depend on the output of another
   concurrent task.
2. **No shared mutable state** — the task does not write to files or
   resources that another concurrent task also writes to.
3. **Non-trivial scope** — the task is large enough that the subagent
   overhead is justified (see triviality gate above).

**Important:** distinguish between parallel tool calls (lightweight I/O in
a single agent turn) and subagents (separate agent processes for heavyweight
work). See `parallel-tool-calls.md` for detailed guidance on when to use each.

Examples of parallelisable work:

- Searching multiple independent areas of a codebase for a pattern.
- Running tests across independent modules.
- Researching multiple library options in parallel.
- Generating documentation for unrelated modules.

Examples of non-parallelisable work:

- Refactoring a shared interface used by multiple modules.
- Migrating a database schema that affects multiple features.
- Any task where the output of one subagent is input to another.

## Context isolation benefits

Subagents provide context isolation: each subagent starts with a clean
context window. This is beneficial when:

- The main context is already large and adding more work would risk
  hitting context limits.
- The task requires deep focus on a specific area without distraction
  from the broader task context.
- Multiple independent investigations can run simultaneously without
  their intermediate findings polluting each other's context.

Context isolation is NOT beneficial when:

- The task requires knowledge of decisions made in the main context.
- The task is small enough that context size is not a concern.
- The task depends on iterative back-and-forth with the user.

## Fan-out / fan-in topology

The standard delegation pattern is fan-out / fan-in:

1. **Fan-out** — the orchestrator decomposes the work into independent
   subtasks and spawns subagents in parallel.
2. **Fan-in** — the orchestrator collects results, verifies them, resolves
   conflicts, and integrates them into the final deliverable.

The orchestrator must:

- Define clear scope boundaries before fanning out.
- Wait for all subagents to complete before fanning in.
- Verify each result independently before integration.
- Resolve any conflicts between results before presenting the final output.

## Good vs bad delegation decisions

**Good delegation:**
- "Research the top 3 .NET caching libraries, comparing API surface,
  performance characteristics, and maintenance status. Return a comparison
  table." — independent research, clear output format, non-trivial scope.
- "Run the test suite for modules A, B, and C in parallel and report
  failures." — independent test runs, no shared state.
- "Generate API documentation for the User, Order, and Product modules." —
  independent documentation tasks, no overlapping files.

**Bad delegation:**
- "Fix the typo in README.md" — trivial, inline is faster.
- "Refactor the shared BaseService class and update all consumers" —
  overlapping scope, sequential dependency.
- "Implement the new feature" — scope too vague, no clear boundaries.
