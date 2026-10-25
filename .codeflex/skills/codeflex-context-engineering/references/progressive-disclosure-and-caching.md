# Progressive Disclosure and Prompt Caching

## Progressive context disclosure

Progressive context disclosure replaces a single monolithic prompt with a
layered structure: a small always-loaded index, and detailed material loaded
only when the agent determines it is relevant to the current step. This is
listed by ThoughtWorks as a supporting technique for context engineering
(Technology Radar, "Progressive context disclosure," Trial as of April 2026)
and is exactly the SKILL.md + `references/` pattern used throughout this
repository.

### Why it matters

- Front-loading every instruction and reference an agent might conceivably
  need means most of that content goes unused on most turns, diluting the
  model's attention budget with noise (see CTX-007, context rot).
- An index-first structure lets the agent's own judgment decide what to pull
  in, based on the actual task at hand, rather than a human pre-guessing
  every scenario the agent might encounter.
- It keeps signal-to-noise high at every step: only what's needed for the
  current step is present, not the union of what might ever be needed.

### Applying it

- **Skill/documentation structure**: a short top-level contract (what this is
  for, when it applies, the mandatory rules) plus a `references/` directory
  of deeper material, each reference file named for what it contains so the
  agent can decide relevance from the filename and one line of description
  alone.
- **Tool design**: expose a small number of well-described tools rather than
  one tool per possible variation; let the agent compose primitives (e.g.
  `glob` + `grep` + `read`) instead of providing pre-baked, narrowly-scoped
  tools for every anticipated query shape.
- **Retrieval pipelines**: return a lightweight index or summary first (file
  paths, titles, short descriptions), and load full content for only the
  items the agent selects — instead of embedding and injecting large blocks
  of retrieved text speculatively.
- **Session/task instructions**: state the minimal instruction set that fully
  specifies expected behavior for the common case; push edge-case handling
  into referenced material invoked only when that edge case is actually hit.

### Failure signs

- An agent's context is dominated by material it never referenced in its
  response — a sign the index/detail split is missing or too coarse.
- Reference material duplicates what's already in the index, so both layers
  get loaded together, defeating the purpose of the split.
- References are loaded eagerly "just in case" rather than on the agent's own
  determination of relevance.

## Prompt caching for context setup

Providers with prompt caching (Anthropic's prompt caching, OpenAI's prompt
caching) cache a prefix of the request and skip reprocessing it on
subsequent calls, provided the prefix is byte-identical to what was cached.
This directly rewards structuring context from most-stable to most-volatile.

### Ordering principle

1. **System instructions and tool definitions** — stable across the entire
   session; place first.
2. **Static reference/background content** — stable across most turns within
   a task (e.g. loaded SKILL.md content, project conventions); place next.
3. **Retrieved or session-specific data** — changes per task but not per
   turn; place after static content.
4. **Conversation history and the latest user turn** — changes every turn;
   place last.

A cache breakpoint marks where the stable prefix ends. Any change earlier in
the sequence invalidates the cache from that point forward, so volatile
content (timestamps, randomized ordering, session IDs, live counters) must
never be placed ahead of content intended to be cached.

### Why it matters

- Reduces cost: cached tokens are billed at a reduced rate (or not
  reprocessed at all) versus fresh tokens.
- Reduces latency: skips reprocessing the cached prefix, improving
  time-to-first-token — material for interactive agent sessions and any
  workflow with repeated calls sharing a stable prefix (e.g. a coding agent
  reusing the same system prompt and tool set across many tool-call turns).

### Common cache-busting mistakes

- Embedding a current timestamp or request ID inside the system prompt.
- Non-deterministic ordering of tool definitions or reference content between
  calls.
- Interleaving retrieved (per-task) data into what should be a stable,
  cacheable system-prompt section instead of appending it after the stable
  prefix.
- Regenerating "equivalent" but not byte-identical instructions on each call
  (e.g. re-serializing JSON with different key ordering).
