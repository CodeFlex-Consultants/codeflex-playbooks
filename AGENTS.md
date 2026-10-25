<!-- codeflex-engineering-standards:start -->
## ⛔ MANDATORY PRE-FLIGHT — TWO-STAGE SKILL LOADING (ALL MODES)

**This section applies to ALL execution modes: plan, code, explore, review, etc.**
**No exceptions. No mode-specific bypasses.**

The resolved Engineering Standards for this repository are mandatory. They may include CodeFlex baseline Skills and configured client/repository Skills. Approved client/repository standards supersede conflicting CodeFlex defaults where the resolved configuration says they do; rules marked non-overridable must not be bypassed automatically.

Canonical resolved Engineering Skills for this repository are stored under `.codeflex/skills/`.

### ⛔ STAGE 1 — BEFORE EXPLORATION (Cross-Cutting Skills)

**Load these BEFORE any file reading, searching, or exploration:**

1. **Check for global standards** — Check whether `~/.agents/AGENTS.md` exists (a global CodeFlex Engineering Standards file shared across all projects on this machine, with skills stored under `~/.agents/skills/`). If it exists, read it and load any cross-cutting skills it lists — these apply in addition to the skills below, regardless of harness. If it does not exist, skip this step.

2. **Load cross-cutting skills** — Invoke `skill` for each skill in the "ALWAYS LOAD (Cross-Cutting)" section below. These apply to every task regardless of technology.

3. **State what you loaded** — Before your first non-skill tool call, state explicitly in your response:

   > "Stage 1 skills loaded: <list>."

Cross-cutting skills are the **only** skills loaded before exploration. Technology-specific skills wait until Stage 2.

### ⛔ STAGE 2 — AFTER EXPLORATION, BEFORE DESIGN (Technology-Specific Skills)

**After Stage 1 exploration identifies technologies, load relevant skills BEFORE any design, planning, or implementation:**

1. **Identify technologies** — Based on exploration results, determine which technologies are involved (e.g., TypeScript, .NET, Angular, Vitest).

2. **Determine which skills apply** — Check if your harness supports scoped rule files (codeflex-scoped-*.md in the harness rules directory like .kilo/rules/, .claude/rules/, .cursor/rules/). If they exist, read them to determine which skills apply to the file paths you expect to touch. If not, use the technology-specific skills listed below directly based on the technologies identified.

3. **Load technology-specific skills** — Invoke `skill` for each skill (codeflex and client/repository) that applies to the identified technologies.

4. **State what you loaded** — Before any design or implementation work, state explicitly:

   > "Stage 2 skills loaded: <list>. Technologies detected: <list>."

**DO NOT** proceed to design, planning, or implementation until Stage 2 is complete. Exploration (reading files, searching, understanding the codebase) happens between Stage 1 and Stage 2.

### ⛔ SUBAGENT DELEGATION — HARD REQUIREMENT

**CRITICAL: Subagents do NOT inherit your loaded skills. You MUST include skill loading instructions in EVERY subagent prompt. This is not optional.**

**Before spawning ANY subagent, you MUST:**

1. Copy the skill loading block below into the subagent's prompt (verbatim, do not paraphrase)
2. Verify the skill loading block is present before calling the `task` tool
3. If the skill loading block is missing from your prompt, STOP and add it

**Skill loading block to include in EVERY subagent prompt:**

```
MANDATORY: Load these skills via the `skill` tool BEFORE any other work:
- codeflex-domain-driven-design
- codeflex-code-craftsmanship
- codeflex-context-engineering
- codeflex-documentation
- codeflex-fable-domain
- codeflex-fable-judge
- codeflex-fable-loop
- codeflex-fable-method
- codeflex-no-magic-strings
- codeflex-subagents

Technology-specific skills (if applicable to your task):
- codeflex-vitest

After loading skills, state: "Skills loaded: <list>. Technologies detected: <list>."
Do NOT proceed with your task until you have loaded these skills and stated what you loaded.
```

**Skill assignment by subagent type:**

| Subagent Type | Cross-Cutting Skills | Technology-Specific Skills |
|---------------|---------------------|---------------------------|
| Explore (read/search only) | YES (always) | YES (if task touches specific technologies) |
| Design/Plan | YES (always) | YES (always) |
| Implementation (write code) | YES (always) | YES (always) |
| Verification/Test | YES (always) | YES (always) |

**Example: Explore subagent prompt (COPY THIS STRUCTURE)**

```
Objective: Find how authentication is implemented

MANDATORY: Load these skills via the `skill` tool BEFORE any other work:
- codeflex-domain-driven-design
- codeflex-code-craftsmanship
- codeflex-context-engineering
- codeflex-documentation
- codeflex-fable-domain
- codeflex-fable-judge
- codeflex-fable-loop
- codeflex-fable-method
- codeflex-no-magic-strings
- codeflex-subagents

After loading skills, state: "Skills loaded: <list>. Technologies detected: <list>."
Do NOT proceed with your task until you have loaded these skills and stated what you loaded.

Scope: src/auth/, src/middleware/
Expected output: Summary of auth flow with file paths
```

**Example: Implementation subagent prompt (COPY THIS STRUCTURE)**

```
Objective: Add rate limiting to API endpoints

MANDATORY: Load these skills via the `skill` tool BEFORE any other work:
- codeflex-domain-driven-design
- codeflex-code-craftsmanship
- codeflex-context-engineering
- codeflex-documentation
- codeflex-fable-domain
- codeflex-fable-judge
- codeflex-fable-loop
- codeflex-fable-method
- codeflex-no-magic-strings
- codeflex-subagents
- codeflex-vitest

After loading skills, state: "Skills loaded: <list>. Technologies detected: <list>."
Do NOT proceed with your task until you have loaded these skills and stated what you loaded.

Scope: src/Api/Controllers/
Expected output: Updated endpoints with rate limiting, tests passing
```

**VERIFICATION CHECKLIST BEFORE SPAWNING SUBAGENT:**
- [ ] I have included the skill loading block in the subagent prompt
- [ ] The skill loading block lists all cross-cutting skills
- [ ] The skill loading block includes technology-specific skills (if applicable)
- [ ] The skill loading block instructs the subagent to load skills BEFORE any other work
- [ ] The skill loading block instructs the subagent to state what it loaded

**If any checkbox is unchecked, DO NOT spawn the subagent. Add the missing content first.**

**Skipping skill loading in subagents is a process failure. The orchestrator is responsible for ensuring every subagent loads skills.**

### ⛔ HARNESS-SPECIFIC ANCHORING

**For harnesses with phased modes (e.g., Claude Code Plan Mode), anchor skill loading to harness-native checkpoints:**

- **Stage 1 skills** load before Phase 1 (Explore)
- **Stage 2 skills** load before Phase 2 (Design)
- Anchor to harness-native checkpoints, not generic "before any action"

This ensures skill loading complements harness workflows rather than conflicting with them.

### ⛔ VERIFICATION CHECKLIST (REQUIRED BEFORE PROCEEDING)

**Before making ANY tool call other than `skill`, verify ALL of the following:**

**Stage 1 (before exploration):**
- [ ] I have checked for `~/.agents/AGENTS.md` and loaded its cross-cutting skills if present
- [ ] I have invoked the `skill` tool for ALL cross-cutting codeflex-* skills listed below
- [ ] I have stated "Stage 1 skills loaded: <list>." in my response

**Stage 2 (after exploration, before design/implementation):**
- [ ] I have checked for scoped rule files (if supported by harness) and identified applicable skills
- [ ] I have invoked the `skill` tool for ALL technology-specific codeflex-* skills matching the identified technologies
- [ ] I have invoked the `skill` tool for ALL client/repository skills matching the identified technologies
- [ ] I have stated "Stage 2 skills loaded: <list>. Technologies detected: <list>." in my response

**If any checkbox is unchecked, STOP and complete it before proceeding.**

### ⛔ CONSEQUENCES OF SKIPPING

**Skipping skill loading is a process failure regardless of:**
- The execution mode (plan, code, explore, review, etc.)
- Whether the resulting code or plan is correct
- Whether you believe the skills are not relevant
- Time pressure or task urgency

Skills exist to prevent entire categories of defects. A correct-looking fix or plan that bypasses standards still introduces unreviewed risk.

### ⛔ CODEFLEX SKILLS — ALWAYS LOAD (Cross-Cutting)

These skills apply to **every** task regardless of technology. You MUST load all of them unconditionally in Stage 1. Do not skip these.

- `codeflex-domain-driven-design`
- `codeflex-code-craftsmanship`
- `codeflex-context-engineering`
- `codeflex-documentation`
- `codeflex-fable-domain`
- `codeflex-fable-judge`
- `codeflex-fable-loop`
- `codeflex-fable-method`
- `codeflex-no-magic-strings`
- `codeflex-subagents`

### ⛔ CODEFLEX SKILLS — LOAD WHEN RELEVANT (Technology-Specific)

Load these in Stage 2 after exploration identifies the technologies involved. If your harness supports scoped rule files (codeflex-scoped-*.md), they provide the authoritative mapping of which skills apply to which file paths. If not, load skills from this list based on the technologies identified during exploration.

Do not substitute codeflex-* skills with generic alternatives.

- `codeflex-vitest`

### Client/Repository Skills (Load ALL RELEVANT)

Load these in Stage 2 after exploration identifies the technologies involved. These contain project-specific standards that override or extend CodeFlex defaults. Client skills may also appear in scoped rule files if they have path-specific scopes.

- *(No additional skills resolved)*

### Skill Loading Rules

1. **Stage 1: Always load cross-cutting skills** — Load global cross-cutting skills from `~/.agents/AGENTS.md` (if it exists) first, then the project cross-cutting skills in the "Always Load" section below. Load them unconditionally BEFORE any exploration.
2. **Stage 2: Load technology-specific skills after exploration** — After exploration identifies technologies, use scoped rule files if available to determine which skills apply. If not, use the technology-specific skills lists above based on the technologies identified.
3. **Load ALL matching skills** — If a scoped rule lists a skill (codeflex or client) for files you will touch, or if a technology-specific skill clearly applies to the identified technologies, load it. Do not skip relevant skills.
4. **Load matching client/repository skills** — These apply to the same technologies as above and may also be in scoped rules.
5. **Load additional skills as needed** — Based on the specific technologies identified during exploration.

**CRITICAL:** Cross-cutting skills load in Stage 1 (before exploration). Technology-specific skills load in Stage 2 (after exploration, before design/implementation).

### Task Initialization Checklist

**⚠️ THIS CHECKLIST IS A HARD GATE. ALL ITEMS MUST BE VERIFIED BEFORE ANY NON-SKILL TOOL CALLS.**

**Stage 1 (before exploration):**
- [ ] Checked for `~/.agents/AGENTS.md` (global standards) and loaded its cross-cutting skills if present
- [ ] Loaded ALL cross-cutting codeflex-* skills (always required)
- [ ] Stated "Stage 1 skills loaded: <list>." in response

**Stage 2 (after exploration, before design/implementation):**
- [ ] Checked for scoped rule files (if supported by harness) and identified applicable skills (codeflex and client)
- [ ] Loaded ALL technology-specific codeflex-* skills matching the identified technologies
- [ ] Loaded ALL client/repository skills matching the identified technologies (may be in scoped rules)
- [ ] Loaded additional skills relevant to the identified technologies
- [ ] Understood the mandatory standards from those skills
- [ ] Stated "Stage 2 skills loaded: <list>. Technologies detected: <list>." in response

### Before Every Edit, Not Just Task Start

The checklist above is not a one-time gate. Re-verify Stage 2 before every subsequent file edit for the rest of the task — a later edit can touch a different technology or area than the one you started with. This applies to small or trivial edits too; edit size is never a basis for skipping standards.

### ⛔ Before Declaring the Task Complete

State whether you loaded the required skills at the start. If you did not, say so explicitly and note which standards may not have been applied. This guarantees the gap surfaces instead of going unnoticed.

### Example

Task: "Fix bug in component X"

**Stage 1 (before exploration):**
→ Check for `~/.agents/AGENTS.md`; if present, load its cross-cutting skills.
→ Load cross-cutting skills via skill tool (e.g., codeflex-code-craftsmanship, codeflex-no-magic-strings)
→ STATE: "Stage 1 skills loaded: codeflex-code-craftsmanship, codeflex-no-magic-strings."

**Exploration:**
→ Read source files, search codebase, understand the bug

**Stage 2 (after exploration, before fix):**
→ Identify technologies from exploration (e.g., TypeScript, Vitest)
→ Check for scoped rule files (codeflex-scoped-*.md in harness rules directory). If they exist, read them. If not, identify technologies from exploration.
→ Load technology-specific skills based on scoped rules (if available) or identified technologies. This includes both codeflex skills (e.g., codeflex-vitest) and client/repository skills if listed in scoped rules or matching identified technologies.
→ STATE: "Stage 2 skills loaded: codeflex-vitest, client-custom-linting. Technologies detected: TypeScript, Vitest."

**Implementation:**
→ NOW begin fixing the bug
<!-- codeflex-engineering-standards:end -->

# codeflex-playbooks

CLI control plane for CodeFlex's Engineering Skills platform. Detects project technologies, resolves engineering standards with client/CodeFlex precedence, and distributes Agent Skills to application repositories.

## Architecture

This CLI is part of a three-part platform:

```
engineering-skills (central standards repo) → Release Pipeline → codeflex-playbooks CLI (this repo) → Application Repository → Coding Agent
```

### This repository's responsibilities

- Deterministic project detection (languages, frameworks, platforms, versions)
- Standards-source discovery and configuration (CodeFlex baseline + client standards)
- Rule precedence and override resolution
- Skill and dependency resolution
- Version compatibility and integrity verification (trusted releases only)
- Installation into `.codeflex/skills/` (canonical store)
- `AGENTS.md` managed-section creation and normalisation (project + global)
- Harness capability registry and projection topology resolution
- Harness adapters generating projections (`.agents/skills/`, `.claude/skills/`, etc.)
- Deprecation tracking and migration guidance
- Configuration diagnostics and auto-fix (`doctor` command)
- Harness migration support (`migrate` command)
- Verification and diagnostics

### Not this repository's responsibilities

- Authoring engineering standards (lives in `engineering-skills`)
- Mechanical enforcement via linters/compilers/CI (lives in application repos)
- Coding agent behaviour (handled by agent harnesses)

## Commands

| Command | Purpose |
|---------|---------|
| `init` | Detect project, resolve initial standards, create `.codeflex/` state |
| `sync` | Restore locked standards from `engineering.lock` (no upgrades) |
| `enter` | Run `init` if `.codeflex/` doesn't exist, or `sync` if it does |
| `update` | Resolve newer approved revisions, update lockfile |
| `diff` | Show what would change before updating |
| `check` | Verify repository matches committed configuration (for CI) |
| `detect` | Show detected technologies |
| `explain` | Explain why a skill was installed or how a rule was resolved |
| `status` | Show CLI and skills version status |
| `doctor` | Diagnose and fix configuration issues |
| `migrate` | Migrate between harness configurations |
| `clean` | Remove projected skill directories and scoped rule files |

### Global AGENTS.md Support

The CLI supports a global `~/.agents/AGENTS.md` file that applies to all projects. Use `--global` flag with `init` or `sync` to manage it. Global AGENTS.md is loaded first, then project-level (which can override/extend).

### Deprecation Warnings

The CLI tracks deprecated features (legacy bootstrap files, old directory structures) and checks for them by default during `init` (suppressible with `--suppress-deprecations`) and during `doctor`. `check` only checks for deprecations when run with `--check-deprecations`; `sync` does not check for deprecations.

## Key Design Decisions

- **TypeScript on Node.js** — distributed as `@codeflex-consultants/codeflex-playbooks` via npm
- **Deterministic detection** — no LLM classification; uses file patterns, package references, and version ranges
- **CodeFlex synchronisation** — download → verify → resolve → generate → validate → codeflex replacement; existing state untouched on failure
- **Minimum projection topology** — calculates the smallest set of harness projections needed, avoiding duplicate skill discovery
- **Managed AGENTS.md section** — owns only the `CodeFlex Engineering Standards` block; preserves all other project content
- **Offline-capable check** — `check` works without network access against committed state
- **Automated versioning** — GitVersion-driven releases; no manual version bumps

## Automated Releases

**Branching model:** `dev` → `main` (dev→main workflow)

- **`dev` branch** — Pre-releases (`x.y.z-dev.N`). Every commit triggers a dev release to npm with `@dev` tag.
- **`main` branch** — Stable releases (`x.y.z`). Every merge triggers a stable release to npm with `@latest` tag.

**Version bumps:** Controlled via `+semver:` markers in merge commit messages to `main`:
- No marker = patch bump (0.1.1 → 0.1.2)
- `+semver: minor` or `+semver: feature` = minor bump (0.1.1 → 0.2.0)
- `+semver: breaking` or `+semver: major` = major bump (0.1.1 → 1.0.0)

**Important:**
- Do NOT manually bump versions in `package.json` — GitVersion computes versions from git tags
- Dev versions are ephemeral; only `main` commits the version back to `package.json`
- Workflows use GitHub App tokens to push to protected branches
- `[skip ci]` in commit-back messages prevents infinite loops

**Configuration:** `GitVersion.yml` at repository root (GitVersion 6.x format)

## Standards Resolution Precedence

```
Legal/regulatory/contractual + non-overridable CodeFlex rules
        ↓
Client-mandated engineering standards
        ↓
Existing repository architecture/ADRs/conventions
        ↓
CodeFlex engineering baseline
        ↓
Approved exceptions (with expiry)
```

## Development

All CLI development commands are run from the `cli/` directory:

```bash
cd cli
npm install
npm run build          # Compile TypeScript
npm run dev            # Run via tsx
npm run typecheck      # Type-check only
npm run lint           # ESLint
npm test               # Vitest
```

**Version management:** Never manually edit the version in `package.json`. Versions are computed automatically by GitVersion during CI based on git tags and commit history. See "Automated Releases" above.

## Conventions

- Strict TypeScript with `noUncheckedIndexedAccess`
- ESM modules (`"type": "module"`)
- Commands are thin; domain logic lives in `cli/src/detection/`, `cli/src/resolution/`, `cli/src/skills/`, `cli/src/projection/`, `cli/src/agents-md/`, `cli/src/deprecation/`, `cli/src/config/`, `cli/src/integrity/`
- Technology detectors in `cli/src/detection/detectors/` (Vue, Svelte, Python, Go, Rust, Java, Kotlin, Swift, etc.)
- Harness detectors in `cli/src/detection/harness/detectors/` (Cursor, Kilo, Claude, Aider, ZooCode, Devin, Cline, JetBrains, etc.)
- Shared utilities in `cli/src/utils/` (errors, fs, hash, output)
- Types are centralised in `cli/src/types/`
- Fixture-based tests for detection and resolution logic
- No secrets, no network calls during detection
