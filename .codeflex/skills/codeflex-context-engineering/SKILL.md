---
name: codeflex-context-engineering
version: 1.0.0
last_reviewed: 2026-09-23
description: >
  CodeFlex engineering standards for context engineering: designing what
  information an AI coding agent holds in its context window at each step.
  Use when designing or reviewing agent system prompts, SKILL.md/reference
  structures, retrieval-augmented (RAG) or "just-in-time" lookup strategies
  for agents, prompt caching layout, context-graph modeling of a codebase or
  knowledge base, or compaction/summarization strategies for long-running
  agent sessions and multi-agent workflows. Distinct from prompt engineering
  (wording of a single prompt) — this skill covers the entire context state:
  system instructions, tools, retrieved data, memory, and message history.
---

# Context Engineering for AI Agents

Context engineering treats the model's context window as a finite, precious
resource and a design surface, not a scratch pad. As agent tasks span more
turns and longer time horizons, the discipline shifts from "write a good
prompt" to "curate the smallest set of high-signal tokens likely to produce
the desired behavior at every step." Dumping raw data into a large context
window degrades reasoning ("context rot"); the antidotes below are the
techniques currently maturing across the industry (ThoughtWorks Technology
Radar rates context engineering **Adopt** as of April 2026, with progressive
context disclosure and context graphs as supporting techniques).

## CTX-001 — Progressive context disclosure over static context stuffing

Do not front-load every instruction, reference document, or file an agent
might need. Start with a lightweight index (a short SKILL.md, a table of
contents, a directory listing) and let the agent pull in only the specific
reference material relevant to the current step. This repository's own
`SKILL.md` + `references/*.md` structure is the canonical implementation:
agent-facing contracts stay short, and detailed guidance loads on demand.
Apply the same pattern to system prompts, tool descriptions, and
retrieval-augmented pipelines: an index first, full content only when a
concrete need for it is identified.

## CTX-002 — Structure prompts for cache reuse

When the harness or API supports prompt caching (e.g. Anthropic prompt
caching, OpenAI prompt caching), order context from most-stable to
most-volatile: system instructions and tool definitions first, static
reference/background content next, then retrieved or session-specific data,
with conversation history and the latest user turn last. Do not interleave
volatile content (timestamps, session IDs, randomized ordering) into the
stable prefix — a single changed token invalidates the cached prefix from
that point forward. Reordering context for cache-friendliness reduces cost
and time-to-first-token without changing model behavior.

## CTX-003 — Prefer dynamic, just-in-time retrieval over static context stuffing

Favor agents that hold lightweight references (file paths, stored queries,
IDs) and load the underlying data only when a tool call needs it, over
pipelines that pre-embed and inject large blocks of content into every turn.
Just-in-time retrieval mirrors how engineers work: a file system, an index,
or a search tool is consulted on demand rather than memorized in advance. Use
a hybrid strategy when task latency matters: pre-load a small amount of
consistently-needed context (e.g. project conventions), and retrieve
everything else on demand.

## CTX-004 — Model structured knowledge as a queryable context graph

For institutional or codebase knowledge with real structure (policies,
exceptions, precedents, code dependencies, ownership boundaries), represent
it as structured, queryable data — a graph with typed nodes and edges — rather
than flattening it into prose that an agent must re-parse from scratch every
time. A context graph lets an agent query "what depends on this" or "what
supersedes this rule" directly, instead of re-deriving relationships from
unstructured text on every turn. Treat this as complementary to, not a
replacement for, progressive disclosure: the graph is the index; the
referenced documents are what gets pulled in.

## CTX-005 — Compress and checkpoint state in long-running agent workflows

Long-horizon tasks (multi-hour migrations, multi-session research, iterative
builds) will exceed any fixed context window. Use one or more of:
- **Compaction**: summarize the conversation history near the context limit,
  preserving architectural decisions, unresolved issues, and load-bearing
  facts, while discarding redundant tool output and superseded intermediate
  results; reinitiate with the summary plus recently-touched files.
- **Structured note-taking**: persist a running state file (todo list,
  decisions log, NOTES.md-style artifact) outside the context window and
  re-read it after a reset, rather than relying on the window to hold
  everything.
- **Sub-agent isolation**: delegate deep exploration to a sub-agent with its
  own clean context, and have it return a condensed summary (not its full
  trace) to the coordinating agent.

Choose based on the task shape: compaction for extended back-and-forth,
note-taking for iterative work with clear milestones, sub-agents for
parallel or exploratory work whose raw trace does not need to survive.

## CTX-006 — Treat tool and reference surfaces as part of the context budget

Every tool definition and every loaded reference document consumes context
before a single turn of real work happens. Keep tool sets minimal and
non-overlapping so an agent (or a human reading the same definitions) can
tell unambiguously which tool applies. Prefer token-efficient tool outputs
(structured, filtered results) over dumping raw payloads. A bloated tool
surface or an eagerly-loaded reference library is a context cost paid on
every turn, whether or not it is used.

## CTX-007 — Anti-patterns: context rot, redundancy, and stale re-reads

- **Context rot**: as token count grows, recall accuracy degrades even within
  the stated window limit. Do not treat "fits in the window" as "safe to
  include" — irrelevant content has a real cost even when it technically
  fits.
- **Redundant context**: do not re-inject content already present in the
  window (repeated system reminders, duplicated file contents, restated
  instructions). Redundancy competes for the same attention budget as new
  information.
- **Unneeded re-reads**: do not re-fetch or re-summarize data that has not
  changed since it was last loaded. Track what is already in context and
  reference it rather than reloading it.
- **Wrong altitude instructions**: system prompts that hardcode brittle,
  over-specific control flow are as harmful as prompts so vague they assume
  shared context the model doesn't have. Aim for the minimal instruction set
  that fully specifies expected behavior, not the shortest one.

## Additional guidance

For the mechanics of progressive disclosure and prompt-cache-friendly context
ordering, read:
- `references/progressive-disclosure-and-caching.md`

For context graph modeling and stateful compression/compaction strategies in
long-running agent workflows, read:
- `references/context-graphs-and-compression.md`
