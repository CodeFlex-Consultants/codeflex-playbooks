# Parallel Tool Calls

Detailed guidance for using parallel tool calls within a single agent turn,
as distinct from spawning subagents.

## What are parallel tool calls?

Parallel tool calls are multiple tool invocations issued in a single agent
message. The harness executes them concurrently, reducing total latency. This
is the most common and efficient form of parallelism for lightweight I/O.

Examples:
- Reading three related files in one message (three `Read` calls)
- Running two independent searches simultaneously (two `Grep` calls)
- Fetching data from multiple sources at once

## When to use parallel tool calls

Use parallel tool calls when ALL of these are true:

1. **Lightweight I/O** — the operations are reads, searches, or lookups
   (not large code changes or complex computations).
2. **Independent** — the operations do not depend on each other's output.
   If operation B needs the result of operation A, they must be sequential.
3. **No shared mutable state** — the operations do not write to the same
   files or resources. Reads can always be parallelised; writes require
   careful scoping.
4. **Small scope** — each operation is small enough that the result fits
   comfortably in the main context window.

## Examples of parallel tool calls

**Good — parallel reads:**
```
Message: "Let me read the controller, repository, and service files to
understand the full pattern."
Tool calls: [Read("Controller.cs"), Read("Repository.cs"), Read("Service.cs")]
```

**Good — parallel searches:**
```
Message: "Let me search for the interface definition and all its
implementations."
Tool calls: [Grep("interface IFoo"), Grep("class.*:.*IFoo")]
```

**Good — parallel lookups:**
```
Message: "Let me check the package.json, tsconfig.json, and vite.config.ts
to understand the project setup."
Tool calls: [Read("package.json"), Read("tsconfig.json"), Read("vite.config.ts")]
```

## Anti-patterns

**Bad — saying "parallel" but making sequential calls:**
```
Message: "Let me read multiple files in parallel."
Tool call: Read("Controller.cs")
Message: "Now let me read the next file."
Tool call: Read("Repository.cs")
Message: "Now let me read the service."
Tool call: Read("Service.cs")
```
This is sequential, not parallel. Issue all three `Read` calls in one message.

**Bad — parallel writes to the same file:**
```
Message: "Let me update the imports and the exports."
Tool calls: [Edit("file.ts", imports), Edit("file.ts", exports)]
```
Two edits to the same file in parallel will conflict. Run them sequentially.

**Bad — dependent operations in parallel:**
```
Message: "Let me find the file and read it."
Tool calls: [Grep("filename"), Read("unknown-path")]
```
The `Read` depends on the `Grep` result. These must be sequential.

**Bad — using a subagent for lightweight I/O:**
```
Message: "Let me spawn a subagent to read three files."
Tool call: task("Read Controller.cs, Repository.cs, and Service.cs")
```
This is overkill. Just issue three `Read` calls in parallel.

## Decision flowchart

```
Need to gather information or perform I/O?
  ↓
Are the operations lightweight (reads, searches, lookups)?
  ↓ Yes
Can they run independently (no dependencies)?
  ↓ Yes
Do they avoid shared mutable state (no writes to same file)?
  ↓ Yes
→ Use parallel tool calls (multiple tools in one message)

Otherwise:
  ↓
Is the work heavyweight (large changes, deep exploration)?
  ↓ Yes
Does it benefit from context isolation?
  ↓ Yes
→ Use subagents (separate agent processes)
```

## Token cost comparison

Parallel tool calls are significantly cheaper than subagents:

- **Parallel tool calls** — one context window, one prompt overhead, minimal
  result reporting cost.
- **Subagents** — each subagent has its own context window, prompt overhead,
  and result reporting cost. A subagent that reads three files costs ~3x
  more than three parallel `Read` calls.

Always prefer parallel tool calls for lightweight I/O. Reserve subagents for
work that truly benefits from context isolation or parallel execution of
heavyweight tasks.
