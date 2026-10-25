import { MANAGED_SECTION_START, MANAGED_SECTION_END } from "./markers";

const GLOBAL_HEADER = `## ⛔ GLOBAL CODEFLEX ENGINEERING STANDARDS — HARD GATE (ALL MODES)

**This section applies to ALL execution modes: plan, code, explore, review, etc.**
**No exceptions. No mode-specific bypasses.**

This is the **global** CodeFlex Engineering Standards file. It applies to **ALL projects** and is loaded by agents **before** any project-level \`AGENTS.md\`.

Global skills are stored under \`~/.agents/skills/\`.`;

const LOADING_ORDER = `**Loading order:**
1. **This file** (\`~/.agents/AGENTS.md\`) — intended to be loaded FIRST (agents must be instructed to read it via project-level AGENTS.md or harness projections)
2. **Project-level** \`AGENTS.md\` — loaded SECOND (may override or extend global instructions)`;

const STAGE_1 = `### ⛔ STAGE 1 — BEFORE EXPLORATION (Global Cross-Cutting Skills)

**Load these BEFORE any file reading, searching, or exploration:**

1. **Load global cross-cutting skills** — Invoke \`skill\` for each skill listed below. These apply to every task in every project.

2. **Check for project-level AGENTS.md** — If a project-level \`AGENTS.md\` exists in the project root, read it and follow its Stage 1 instructions. Project-level standards may override or extend these global standards.

3. **State what you loaded** — Before your first non-skill tool call, state explicitly in your response:

   > "Stage 1 skills loaded: <list>."

Global cross-cutting skills are the **only** skills loaded before exploration. Technology-specific skills are determined by the project-level AGENTS.md in Stage 2.`;

const STAGE_2 = `### ⛔ STAGE 2 — AFTER EXPLORATION, BEFORE DESIGN (Project-Level)

**After Stage 1 exploration, follow the project-level AGENTS.md for Stage 2 instructions:**

1. The project-level \`AGENTS.md\` will instruct you to identify technologies from exploration results.
2. Load technology-specific skills as directed by the project-level AGENTS.md.
3. Complete Stage 2 BEFORE any design, planning, or implementation work.

Technology-specific skill loading is managed at the project level, not globally.`;

const SUBAGENT_DELEGATION = `### ⛔ SUBAGENT DELEGATION — HARD REQUIREMENT

**CRITICAL: Subagents do NOT inherit your loaded skills. You MUST include skill loading instructions in EVERY subagent prompt. This is not optional.**

**Before spawning ANY subagent, you MUST:**

1. Copy the skill loading block below into the subagent's prompt (verbatim, do not paraphrase)
2. Verify the skill loading block is present before calling the \`task\` tool
3. If the skill loading block is missing from your prompt, STOP and add it

**Skill loading block to include in EVERY subagent prompt:**

\`\`\`
MANDATORY: Load these skills via the \`skill\` tool BEFORE any other work:
- *(global cross-cutting skills from the list above)*

After loading skills, state: "Skills loaded: <list>."
Do NOT proceed with your task until you have loaded these skills and stated what you loaded.
\`\`\`

**Skill assignment by subagent type:**

| Subagent Type | Global Cross-Cutting Skills | Project Technology-Specific Skills |
|---------------|----------------------------|-----------------------------------|
| Explore (read/search only) | YES (always) | Per project-level AGENTS.md |
| Design/Plan | YES (always) | Per project-level AGENTS.md |
| Implementation (write code) | YES (always) | Per project-level AGENTS.md |
| Verification/Test | YES (always) | Per project-level AGENTS.md |

**VERIFICATION CHECKLIST BEFORE SPAWNING SUBAGENT:**
- [ ] I have included the skill loading block in the subagent prompt
- [ ] The skill loading block lists all global cross-cutting skills
- [ ] The skill loading block instructs the subagent to load skills BEFORE any other work
- [ ] The skill loading block instructs the subagent to state what it loaded

**If any checkbox is unchecked, DO NOT spawn the subagent. Add the missing content first.**

**Skipping skill loading in subagents is a process failure. The orchestrator is responsible for ensuring every subagent loads skills.**`;

const VERIFICATION_CHECKLIST = `### ⛔ VERIFICATION CHECKLIST (REQUIRED BEFORE PROCEEDING)

**Before making ANY tool call other than \`skill\`, verify ALL of the following:**

**Stage 1 (before exploration):**
- [ ] I have invoked the \`skill\` tool for ALL global cross-cutting skills listed below
- [ ] I have checked for project-level \`AGENTS.md\` and followed its Stage 1 instructions
- [ ] I have stated "Stage 1 skills loaded: <list>." in my response

**Stage 2 (after exploration, before design/implementation):**
- [ ] I have followed the project-level \`AGENTS.md\` Stage 2 instructions
- [ ] I have stated "Stage 2 skills loaded: <list>. Technologies detected: <list>." in my response

**If any checkbox is unchecked, STOP and complete it before proceeding.**`;

const CONSEQUENCES = `### ⛔ CONSEQUENCES OF SKIPPING

**Skipping skill loading is a process failure regardless of:**
- The execution mode (plan, code, explore, review, etc.)
- Whether the resulting code or plan is correct
- Whether you believe the skills are not relevant
- Time pressure or task urgency

Skills exist to prevent entire categories of defects. A correct-looking fix or plan that bypasses standards still introduces unreviewed risk.`;

const CROSS_CUTTING_HEADER = `### ⛔ GLOBAL CROSS-CUTTING SKILLS — ALWAYS LOAD

These skills apply to **every** task in **every** project. You MUST load all of them unconditionally.`;

const SKILL_LOADING_RULES = `### Skill Loading Rules

1. **Stage 1: Always load global cross-cutting skills** — The skills listed above apply to every task in every project. Load them unconditionally BEFORE any exploration.
2. **Then check project-level AGENTS.md** — If it exists, follow its Stage 1 and Stage 2 instructions.
3. **Stage 2: Project manages technology-specific skills** — Technology-specific skill loading is determined by the project-level AGENTS.md after exploration identifies technologies.
4. **Project overrides global** — Where project-level standards conflict with global standards, the project-level standards take precedence.`;

const TASK_CHECKLIST = `### Task Initialization Checklist

**⚠️ THIS CHECKLIST IS A HARD GATE. ALL ITEMS MUST BE VERIFIED BEFORE ANY NON-SKILL TOOL CALLS.**

**Stage 1 (before exploration):**
- [ ] Loaded ALL global cross-cutting skills listed above (always required)
- [ ] Checked for project-level \`AGENTS.md\` and followed its Stage 1 instructions
- [ ] Stated "Stage 1 skills loaded: <list>." in response

**Stage 2 (after exploration, before design/implementation):**
- [ ] Followed project-level \`AGENTS.md\` Stage 2 instructions
- [ ] Understood the mandatory standards from loaded skills
- [ ] Stated "Stage 2 skills loaded: <list>. Technologies detected: <list>." in response`;

const BEFORE_EVERY_EDIT = `### Before Every Edit, Not Just Task Start

The checklist above is not a one-time gate. Re-verify it before every subsequent file edit for the rest of the task — a later edit can touch a different technology or area than the one you started with. This applies to small or trivial edits too; edit size is never a basis for skipping standards.`;

const BEFORE_COMPLETE = `### ⛔ Before Declaring the Task Complete

State whether you loaded the required global skills at the start. If you did not, say so explicitly and note which standards may not have been applied. This guarantees the gap surfaces instead of going unnoticed.`;

const EXAMPLE = `### Example

Task: "Fix bug in component X"

**Stage 1 (before exploration):**
→ Load global cross-cutting skills via skill tool (e.g., codeflex-code-craftsmanship, codeflex-no-magic-strings)
→ Check for project-level \`AGENTS.md\`; if present, follow its Stage 1 instructions.
→ STATE: "Stage 1 skills loaded: codeflex-code-craftsmanship, codeflex-no-magic-strings."

**Exploration:**
→ Read source files, search codebase, understand the bug

**Stage 2 (after exploration, before fix):**
→ Follow project-level \`AGENTS.md\` Stage 2 instructions to identify technologies and load technology-specific skills.
→ STATE: "Stage 2 skills loaded: codeflex-vitest. Technologies detected: TypeScript, Vitest."

**Implementation:**
→ NOW begin fixing the bug`;

/** Generates the managed section content for the global ~/.agents/AGENTS.md file. */
export function generateGlobalManagedSection(crossCuttingSlugs: string[] = []): string {
  const crossCuttingList = crossCuttingSlugs.length > 0
    ? crossCuttingSlugs.map((slug) => `- \`${slug}\``).join("\n")
    : "- *(No cross-cutting skills installed)*";

  const crossCuttingSection = `${CROSS_CUTTING_HEADER}\n\n${crossCuttingList}`;

  return `${MANAGED_SECTION_START}\n${[
    GLOBAL_HEADER,
    LOADING_ORDER,
    STAGE_1,
    STAGE_2,
    SUBAGENT_DELEGATION,
    VERIFICATION_CHECKLIST,
    CONSEQUENCES,
    crossCuttingSection,
    SKILL_LOADING_RULES,
    TASK_CHECKLIST,
    BEFORE_EVERY_EDIT,
    BEFORE_COMPLETE,
    EXAMPLE,
  ].join("\n\n")}\n${MANAGED_SECTION_END}`;
}
