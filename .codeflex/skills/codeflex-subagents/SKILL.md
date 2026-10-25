---
name: codeflex-subagents
version: 1.1.0
last_reviewed: 2026-09-24
description: >
  Standards for coding agents to delegate work to subagents and use parallel
  tool calls: when to spawn subagents vs working inline, how to structure
  subagent prompts with clear scope and output expectations, parallel tool
  calls vs subagents for parallelism, parallel vs sequential execution, result
  integration and verification, error handling, and token cost awareness.
  Use when planning or executing any multi-step task that can benefit from
  parallelisation, specialisation, or context isolation.
---

# Subagent Delegation Standards

These rules are mandatory whenever this Skill applies. They express
CodeFlex's baseline expectations for how coding agents delegate work to
subagents. Where a configured client or repository standard explicitly
supersedes one of these rules, the resolved override takes precedence;
rules marked non-overridable must not be bypassed automatically.

## SUBAGENT-001 — Delegation decision criteria

Spawn subagents only for non-trivial independent workstreams: tasks that
are parallelisable, require specialised domain knowledge, or benefit from
context isolation. Never delegate trivial changes (fewer than 10 lines
changed in a single file). When in doubt, work inline — a poorly scoped
subagent costs more tokens than doing the work directly.

## SUBAGENT-002 — Task prompt structure

Every subagent prompt must include all five of these sections:

1. **Objective** — one sentence stating what the subagent must accomplish.
2. **Scope boundaries** — the specific files, directories, or areas the
   subagent may read and modify.
3. **Expected output format** — what the subagent returns (file paths,
   structured data, a summary, a diff).
4. **Success criteria** — how the orchestrator will verify the result.
5. **Report-back format** — what the subagent must include in its final
   message (changes made, files touched, verification output, blockers).

Ambiguous prompts produce unusable results. A prompt missing any of these
five sections is incomplete; complete it before spawning.

## SUBAGENT-003 — Parallel tool calls vs subagents

Distinguish between two forms of parallelism:

**Parallel tool calls** (within a single agent turn) — issue multiple tool
invocations in one message (e.g., three `Read` calls, two `Grep` calls).
Use for lightweight I/O operations: reading multiple files, running
independent searches, fetching related data. This is the most common form
of parallelism and has minimal overhead.

**Subagents** (separate agent processes) — spawn independent agent tasks
using the `task` or `delegate` tool. Use for heavyweight workstreams that
benefit from context isolation: large independent research tasks, parallel
test runs across modules, or work that would bloat the main context.

Decision rule: if the work is lightweight I/O (reads, searches, lookups),
use parallel tool calls. If the work is heavyweight (large code changes,
deep exploration, independent test suites), use subagents. Never use a
subagent for what could be done with parallel tool calls.

Independent tasks with no shared mutable state run in parallel. Tasks with
dependencies or shared state run sequentially. Never parallelise writes to
the same file. When two tasks might touch overlapping files, run them
sequentially even if they appear independent.

## SUBAGENT-004 — Scope isolation

Each subagent receives a focused, non-overlapping scope. Two subagents
must not edit the same file or make interdependent decisions. Overlapping
scope causes merge conflicts, wasted tokens, and integration failures.
When a task cannot be decomposed into non-overlapping scopes, it is a
single task — do not split it across subagents.

## SUBAGENT-005 — Result integration

Verify subagent results before accepting them:

- Check completeness against the original objective.
- Resolve conflicts between parallel results (overlapping edits,
  contradictory decisions).
- Never blindly concatenate outputs — review each result for correctness
  and consistency.

The orchestrator owns the final quality. A subagent's self-reported
success is not sufficient verification; confirm mechanically where
possible (run tests, check build, inspect output).

## SUBAGENT-006 — Error handling

On subagent failure:

1. Retry once with a refined prompt that addresses the specific failure.
2. On second failure, fall back to inline execution.
3. Never infinite-loop retries with the same or similar prompt.

Report failures honestly. Do not mask subagent errors as partial success.
If a subagent cannot complete its task, the orchestrator must either
complete the work inline or report the failure to the user with enough
context to decide the next step.

## SUBAGENT-007 — Token cost awareness

Subagents multiply token consumption: each subagent carries its own
context window, prompt overhead, and result reporting cost. Prefer inline
work for simple tasks. Choose the smallest viable subagent scope. Use
background subagents for non-blocking work where the result is not needed
before continuing; use foreground subagents only when the result must be
available before the next step.

## Additional guidance

For parallel tool call patterns, examples, and anti-patterns, read:
- `references/parallel-tool-calls.md`

For delegation decision patterns, triviality gates, and fan-out/fan-in
topology, read:
- `references/delegation-patterns.md`

For subagent prompt templates covering explore, implementation, and
verification tasks, read:
- `references/prompt-templates.md`

For result verification checklists, conflict resolution, retry strategy,
and honest failure reporting, read:
- `references/integration-and-error-handling.md`

## Canonical numbers and sources of truth

- **Triviality threshold** — fewer than 10 lines changed in a single file is trivial; do not delegate (`SUBAGENT-001`).
- **Prompt sections** — every subagent prompt requires 5 sections: objective, scope, output format, success criteria, report-back format (`SUBAGENT-002`).
- **Retry limit** — maximum one retry with a refined prompt; second failure falls back to inline (`SUBAGENT-006`).
- **Parallel tool calls** — use for lightweight I/O (reads, searches, lookups); issue multiple tool invocations in a single message (`SUBAGENT-003`).
- **Subagents** — use for heavyweight independent workstreams that benefit from context isolation (`SUBAGENT-003`).
- **Parallelisation rule** — never parallelise writes to the same file (`SUBAGENT-003`).
- **Scope rule** — two subagents must not edit the same file (`SUBAGENT-004`).
