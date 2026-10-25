import { MANAGED_SECTION_START, MANAGED_SECTION_END } from "./markers";

/**
 * Generates the CodeFlex Engineering Standards managed section content for AGENTS.md.
 *
 * The section is delimited by HTML comment markers and contains instructions for coding agents
 * on how to discover and apply resolved engineering skills.
 *
 * @param skillSlugs - The resolved skills slugs for this project
 * @param crossCuttingSlugs - Skill slugs that are cross-cutting (apply to every task)
 * @returns The complete managed section string including start/end markers
 */
export function generateManagedSection(skillSlugs: string[] = [], crossCuttingSlugs: string[] = []): string {
  const codeflexSkills = skillSlugs.filter(slug => slug.startsWith("codeflex-"));
  const otherSkills = skillSlugs.filter(slug => !slug.startsWith("codeflex-"));

  const crossCuttingSet = new Set(crossCuttingSlugs);
  const crossCutting = codeflexSkills.filter(slug => crossCuttingSet.has(slug));
  const techSpecific = codeflexSkills.filter(slug => !crossCuttingSet.has(slug));

  const crossCuttingList = crossCutting.length > 0
    ? crossCutting.map((slug) => `- \`${slug}\``).join("\n")
    : "- *(No cross-cutting skills resolved)*";

  const techSpecificList = techSpecific.length > 0
    ? techSpecific.map((slug) => `- \`${slug}\``).join("\n")
    : "- *(No technology-specific skills resolved)*";

  const otherSkillsList = otherSkills.length > 0
    ? otherSkills.map((slug) => `- \`${slug}\``).join("\n")
    : "- *(No additional skills resolved)*";

  return `${MANAGED_SECTION_START}
## ⛔ MANDATORY PRE-FLIGHT — TWO-STAGE SKILL LOADING (ALL MODES)

**This section applies to ALL execution modes: plan, code, explore, review, etc.**
**No exceptions. No mode-specific bypasses.**

The resolved Engineering Standards for this repository are mandatory. They may include CodeFlex baseline Skills and configured client/repository Skills. Approved client/repository standards supersede conflicting CodeFlex defaults where the resolved configuration says they do; rules marked non-overridable must not be bypassed automatically.

Canonical resolved Engineering Skills for this repository are stored under \`.codeflex/skills/\`.

### ⛔ STAGE 1 — BEFORE EXPLORATION (Cross-Cutting Skills)

**Load these BEFORE any file reading, searching, or exploration:**

1. **Check for global standards** — Check whether \`~/.agents/AGENTS.md\` exists (a global CodeFlex Engineering Standards file shared across all projects on this machine, with skills stored under \`~/.agents/skills/\`). If it exists, read it and load any cross-cutting skills it lists — these apply in addition to the skills below, regardless of harness. If it does not exist, skip this step.

2. **Load cross-cutting skills** — Invoke \`skill\` for each skill in the "ALWAYS LOAD (Cross-Cutting)" section below. These apply to every task regardless of technology.

3. **State what you loaded** — Before your first non-skill tool call, state explicitly in your response:

   > "Stage 1 skills loaded: <list>."

Cross-cutting skills are the **only** skills loaded before exploration. Technology-specific skills wait until Stage 2.

### ⛔ STAGE 2 — AFTER EXPLORATION, BEFORE DESIGN (Technology-Specific Skills)

**After Stage 1 exploration identifies technologies, load relevant skills BEFORE any design, planning, or implementation:**

1. **Identify technologies** — Based on exploration results, determine which technologies are involved (e.g., TypeScript, .NET, Angular, Vitest).

2. **Determine which skills apply** — Check if your harness supports scoped rule files (codeflex-scoped-*.md in the harness rules directory like .kilo/rules/, .claude/rules/, .cursor/rules/). If they exist, read them to determine which skills apply to the file paths you expect to touch. If not, use the technology-specific skills listed below directly based on the technologies identified.

3. **Load technology-specific skills** — Invoke \`skill\` for each skill (codeflex and client/repository) that applies to the identified technologies.

4. **State what you loaded** — Before any design or implementation work, state explicitly:

   > "Stage 2 skills loaded: <list>. Technologies detected: <list>."

**DO NOT** proceed to design, planning, or implementation until Stage 2 is complete. Exploration (reading files, searching, understanding the codebase) happens between Stage 1 and Stage 2.

### ⛔ SUBAGENT DELEGATION — HARD REQUIREMENT

**CRITICAL: Subagents do NOT inherit your loaded skills. You MUST include skill loading instructions in EVERY subagent prompt. This is not optional.**

**Before spawning ANY subagent, you MUST:**

1. Copy the skill loading block below into the subagent's prompt (verbatim, do not paraphrase)
2. Verify the skill loading block is present before calling the \`task\` tool
3. If the skill loading block is missing from your prompt, STOP and add it

**Skill loading block to include in EVERY subagent prompt:**

\`\`\`
MANDATORY: Load these skills via the \`skill\` tool BEFORE any other work:
${crossCutting.length > 0 ? crossCutting.map((slug) => `- ${slug}`).join("\n") : "- *(No cross-cutting skills resolved)*"}
${techSpecific.length > 0 ? `\nTechnology-specific skills (if applicable to your task):\n${techSpecific.slice(0, 3).map((slug) => `- ${slug}`).join("\n")}` : ""}

After loading skills, state: "Skills loaded: <list>. Technologies detected: <list>."
Do NOT proceed with your task until you have loaded these skills and stated what you loaded.
\`\`\`

**Skill assignment by subagent type:**

| Subagent Type | Cross-Cutting Skills | Technology-Specific Skills |
|---------------|---------------------|---------------------------|
| Explore (read/search only) | YES (always) | YES (if task touches specific technologies) |
| Design/Plan | YES (always) | YES (always) |
| Implementation (write code) | YES (always) | YES (always) |
| Verification/Test | YES (always) | YES (always) |

**Example: Explore subagent prompt (COPY THIS STRUCTURE)**

\`\`\`
Objective: Find how authentication is implemented

MANDATORY: Load these skills via the \`skill\` tool BEFORE any other work:
${crossCutting.length > 0 ? crossCutting.map((slug) => `- ${slug}`).join("\n") : "- *(No cross-cutting skills resolved)*"}

After loading skills, state: "Skills loaded: <list>. Technologies detected: <list>."
Do NOT proceed with your task until you have loaded these skills and stated what you loaded.

Scope: src/auth/, src/middleware/
Expected output: Summary of auth flow with file paths
\`\`\`

**Example: Implementation subagent prompt (COPY THIS STRUCTURE)**

\`\`\`
Objective: Add rate limiting to API endpoints

MANDATORY: Load these skills via the \`skill\` tool BEFORE any other work:
${crossCutting.length > 0 ? crossCutting.map((slug) => `- ${slug}`).join("\n") : "- *(No cross-cutting skills resolved)*"}
${techSpecific.length > 0 ? techSpecific.slice(0, 3).map((slug) => `- ${slug}`).join("\n") : "- *(No technology-specific skills resolved)*"}

After loading skills, state: "Skills loaded: <list>. Technologies detected: <list>."
Do NOT proceed with your task until you have loaded these skills and stated what you loaded.

Scope: src/Api/Controllers/
Expected output: Updated endpoints with rate limiting, tests passing
\`\`\`

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

**Before making ANY tool call other than \`skill\`, verify ALL of the following:**

**Stage 1 (before exploration):**
- [ ] I have checked for \`~/.agents/AGENTS.md\` and loaded its cross-cutting skills if present
- [ ] I have invoked the \`skill\` tool for ALL cross-cutting codeflex-* skills listed below
- [ ] I have stated "Stage 1 skills loaded: <list>." in my response

**Stage 2 (after exploration, before design/implementation):**
- [ ] I have checked for scoped rule files (if supported by harness) and identified applicable skills
- [ ] I have invoked the \`skill\` tool for ALL technology-specific codeflex-* skills matching the identified technologies
- [ ] I have invoked the \`skill\` tool for ALL client/repository skills matching the identified technologies
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

${crossCuttingList}

### ⛔ CODEFLEX SKILLS — LOAD WHEN RELEVANT (Technology-Specific)

Load these in Stage 2 after exploration identifies the technologies involved. If your harness supports scoped rule files (codeflex-scoped-*.md), they provide the authoritative mapping of which skills apply to which file paths. If not, load skills from this list based on the technologies identified during exploration.

Do not substitute codeflex-* skills with generic alternatives.

${techSpecificList}

### Client/Repository Skills (Load ALL RELEVANT)

Load these in Stage 2 after exploration identifies the technologies involved. These contain project-specific standards that override or extend CodeFlex defaults. Client skills may also appear in scoped rule files if they have path-specific scopes.

${otherSkillsList}

### Skill Loading Rules

1. **Stage 1: Always load cross-cutting skills** — Load global cross-cutting skills from \`~/.agents/AGENTS.md\` (if it exists) first, then the project cross-cutting skills in the "Always Load" section below. Load them unconditionally BEFORE any exploration.
2. **Stage 2: Load technology-specific skills after exploration** — After exploration identifies technologies, use scoped rule files if available to determine which skills apply. If not, use the technology-specific skills lists above based on the technologies identified.
3. **Load ALL matching skills** — If a scoped rule lists a skill (codeflex or client) for files you will touch, or if a technology-specific skill clearly applies to the identified technologies, load it. Do not skip relevant skills.
4. **Load matching client/repository skills** — These apply to the same technologies as above and may also be in scoped rules.
5. **Load additional skills as needed** — Based on the specific technologies identified during exploration.

**CRITICAL:** Cross-cutting skills load in Stage 1 (before exploration). Technology-specific skills load in Stage 2 (after exploration, before design/implementation).

### Task Initialization Checklist

**⚠️ THIS CHECKLIST IS A HARD GATE. ALL ITEMS MUST BE VERIFIED BEFORE ANY NON-SKILL TOOL CALLS.**

**Stage 1 (before exploration):**
- [ ] Checked for \`~/.agents/AGENTS.md\` (global standards) and loaded its cross-cutting skills if present
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
→ Check for \`~/.agents/AGENTS.md\`; if present, load its cross-cutting skills.
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
${MANAGED_SECTION_END}`;
}
