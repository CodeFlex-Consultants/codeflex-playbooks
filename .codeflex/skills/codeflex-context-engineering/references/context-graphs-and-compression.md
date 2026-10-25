# Context Graphs and Stateful Compression

## Context graphs

A context graph represents institutional or codebase knowledge as structured,
queryable data — typed nodes and edges — instead of flat prose an agent must
re-parse and re-infer relationships from on every turn. ThoughtWorks tracks
this as a supporting technique for context engineering (Technology Radar,
"Context graph," Assess as of April 2026).

### What belongs in a context graph

- **Codebase structure**: files, symbols, dependency edges, ownership
  boundaries — the kind of structure a tool like a knowledge-graph builder
  (e.g. the `graphify` pattern of turning any input into a persistent graph
  with community detection and query/path/explain tools) produces once and
  lets an agent query repeatedly, rather than re-deriving from scratch each
  session.
- **Institutional reasoning**: policies, exceptions, precedents, and the
  relationships between them (this policy supersedes that one, this
  exception applies under this condition) — represented as explicit edges an
  agent can traverse, instead of buried across scattered documents the agent
  must reconcile by inference.
- **Decision history**: architecture decisions and their rationale, linked to
  the code or components they constrain, so an agent can query "why is this
  built this way" directly.

### Why a graph over flat text

- Flat prose forces an agent to re-derive relationships (what depends on
  what, what overrides what) from scratch on every session, burning context
  and risking incorrect inference.
- A graph makes relationships first-class and queryable: "what references
  this," "what supersedes this," "what is downstream of this change" become
  direct lookups instead of re-reading and re-reasoning over large amounts of
  unstructured text.
- Graphs compose with progressive disclosure: the graph (or an index derived
  from it) is what the agent consults to decide what detailed material to
  load next, keeping the graph itself lightweight while detailed content
  stays in referenced documents.

### Applying it

- Prefer a graph or index representation for any knowledge base an agent
  queries repeatedly (a codebase, a policy corpus, a decision log) over
  re-embedding and re-injecting the same unstructured corpus per session.
- Keep the graph as the navigation/reasoning layer; keep source-of-truth
  detail in the underlying documents or code, loaded on demand once the graph
  identifies relevance (progressive disclosure, `CTX-001`).
- Treat this as an emerging technique (Assess-level maturity per the
  Technology Radar): pilot it for genuinely relationship-heavy knowledge
  domains before applying it as a default for every knowledge surface.

## Stateful compression for long-running agent workflows

Long-horizon agent tasks — large codebase migrations, multi-hour research,
iterative multi-session builds — generate more potentially-relevant
information than any fixed context window can hold. Anthropic's guidance on
effective context engineering for agents (Sep 2025) documents three
complementary techniques; ThoughtWorks groups the summarization/compaction
side of this as "stateful compression."

### Compaction

Compaction summarizes a conversation nearing its context limit and
reinitializes a new context window from that summary. Effective compaction:

- **Preserves**: architectural decisions, unresolved bugs/issues,
  in-progress implementation details, anything load-bearing for continuing
  correctly.
- **Discards**: redundant tool call outputs, superseded intermediate results,
  raw data already distilled into a decision or conclusion.
- **Recency supplement**: pairs the compacted summary with the most
  recently-touched files or state, since recent work is disproportionately
  likely to be relevant to the immediate next step.

Tune compaction by first maximizing recall (capture everything
load-bearing from real agent traces), then iterating for precision
(trim what turned out to be superfluous). Over-aggressive compaction risks
silently losing details whose importance only becomes clear later — treat
that as a real failure mode, not just an inefficiency.

### Structured note-taking (agentic memory)

The agent periodically writes durable notes (a todo list, a decisions log,
a NOTES.md-style file) outside the context window, and re-reads them after a
context reset or new session. This gives persistent memory with minimal
overhead and lets multi-hour or multi-session work resume coherently without
requiring everything to have stayed in the live context window the entire
time.

### Sub-agent architectures

Delegate deep or exploratory work to a sub-agent operating in its own clean
context window; the sub-agent may use tens of thousands of tokens internally,
but returns only a condensed summary (roughly 1,000–2,000 tokens is a
reasonable target) to the coordinating agent. This isolates detailed search
or analysis context from the main agent's window, keeping the coordinator
focused on synthesis rather than raw exploration detail.

### Choosing among the three

| Technique | Best suited for |
|---|---|
| Compaction | Tasks requiring extensive continuous back-and-forth in one thread |
| Structured note-taking | Iterative work with clear milestones spanning sessions |
| Sub-agent architectures | Complex research/exploration where parallel isolation pays off |

These are not mutually exclusive: a long-running coding agent may use
sub-agents for exploration, structured notes for milestone tracking, and
compaction as the underlying session approaches its window limit.
