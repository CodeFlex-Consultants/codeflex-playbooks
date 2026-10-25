# Architecture & Tooling Recommendation — Engineering Playbooks for Coding Agents

## Introduction

This proposal creates a company-wide way of making CodeFlex's existing engineering playbooks consistently available to coding agents without tying the solution to any single agent harness. Engineering guidance is converted into portable Agent Skills, centrally governed and versioned in Git, then a globally installed `codeflex-playbooks` CLI detects the technologies used by each application and installs only the relevant locked Skill set into that repository.

Because CodeFlex is a consultancy, the platform must also support projects where the client or an existing codebase already defines engineering standards. CodeFlex Engineering Skills therefore provide the **default baseline**, while configured client and repository standards are treated as first-class inputs that can supersede CodeFlex defaults where appropriate. The CLI resolves these sources into one effective, project-specific standards set before anything is projected to a coding-agent harness.

When a developer enters or initialises an application, the CLI maintains the repository's `.codeflex` state, keeps the managed `CodeFlex Engineering Standards` section of `AGENTS.md` current, and projects the applicable resolved Skills into the locations required by the supported coding-agent harnesses. This gives agents reliable access to the correct project-specific guidance while keeping unrelated Skills out of context and leaving mechanically enforceable rules to conventional tooling and CI.

# Definitions

**Engineering Playbook**      
Existing CodeFlex engineering guidance describing standards, conventions, workflows and recommended approaches. As part of this proposal, relevant Playbook content is converted into Agent Skills for coding-agent consumption.

**Engineering Skill / Agent Skill**      
A portable, agent-facing package based on the `SKILL.md` format. A Skill contains the instructions an agent should follow for a particular engineering concern and can reference additional material under `references/` or deterministic helper tooling under `scripts/`.

**CodeFlex Baseline**      
The default set of CodeFlex engineering standards applied where a client or existing repository does not define a more specific standard. This is normally the primary standards source for new/greenfield projects where CodeFlex controls the technical approach.

**Client Standard / Client Skill**      
A client-mandated or client-established engineering standard that applies to one or more client projects. Client standards can be represented as Agent Skills and may live directly in the application repository or in a separate access-controlled client Engineering Skills repository where multiple projects share them.

**Effective Engineering Standards**      
The final resolved standards for a specific application after the CLI combines client/repository standards, CodeFlex defaults, explicit rule overrides and approved exceptions according to the precedence model. These are the standards projected to coding-agent harnesses.

**Non-overridable Rule**      
A rule, normally relating to legal, regulatory, contractual, security or compliance requirements, that cannot be automatically superseded by a client or repository standard. A conflict with such a rule must be surfaced for explicit escalation rather than silently resolved.

`SKILL.md`      
The portable agent-facing entry point for a Skill. It describes what the Skill is for, when it applies, the mandatory engineering rules to follow and which additional references should be loaded when required.

`codeflex.yaml`      
CodeFlex-owned machine-readable metadata stored alongside a Skill. It is consumed by `codeflex-playbooks`, not by the coding agent, and describes how the CLI should detect, govern, version, resolve and distribute that Skill.

**Canonical Skill Store**      
The repository-local `.codeflex/skills/` directory containing the exact resolved **effective** set of Engineering Skills applicable to that application, including CodeFlex baseline Skills and any configured client-specific Skills. It is the project-local source of truth used by `codeflex-playbooks`; harness-specific Skill directories are generated projections of this store.

**Projection**      
A generated harness-compatible view of the canonical Skills, for example `.agents/skills/`, `.claude/skills/`, `.opencode/skills/` or `.kilo/skills/`. A projection is not an independently maintained copy of the engineering standard.

**Agent Harness**      
The coding-agent application or runtime used by an engineer, for example Codex, Claude Code, OpenCode, Kilo or Copilot. Different harnesses can use different instruction and Skill discovery locations.

**Trusted Release**      
For centrally distributed CodeFlex Engineering Skills, a release produced by the approved CI/release pipeline from an authorised merge to a protected shared branch such as `dev` or `main`, after the required validation and review checks have passed. A developer-created build or package produced directly from a local machine is not trusted for organisation-wide distribution, because its source revision, validation status and provenance cannot be guaranteed by the platform. Client/repository standards do not have to use CodeFlex's central release pipeline, but their source must be explicitly configured as authoritative for that project and locked by commit/revision or content hash in `engineering.lock`.

**Mechanical / Machine Enforcement**      
A requirement enforced deterministically by software rather than by asking an LLM to comply. Examples include compiler rules, linters, formatters, architecture tests, security checks and CI gates. If the requirement is violated, tooling can detect or block the change regardless of what the coding agent decides to do.

---

## Executive Recommendation

CodeFlex should build a **Git-backed Engineering Skills platform**, distributed into application repositories through a company-owned CLI. CodeFlex Engineering Skills should act as the default baseline, while client-mandated and established repository standards can be configured as higher-priority standards sources for projects where CodeFlex does not own the existing technical conventions.

The `codeflex-playbooks` CLI should be implemented primarily in **TypeScript**, most likely running on **Node.js**, with the exact supporting CLI/framework libraries left as an implementation choice. It should be published as an internal **npm package** and installed globally by developers in the same way as tooling such as the Angular CLI, for example `npm install -g @codeflex-consultants/codeflex-playbooks`. The globally installed CLI provides the developer-facing commands for detecting, initialising, synchronising and updating repository Engineering Skills; CI and central automation should use an explicitly approved CLI version for reproducibility.

The architecture should be:

> *Governed CodeFlex Engineering Skills GitHub repository + configured client/repository standards → immutable/versioned inputs → *`codeflex-playbooks` CLI → deterministic project analysis + standards precedence resolution → locked effective subset of applicable Agent Skills → canonical `.codeflex/skills` store → harness-specific Skill projections + `AGENTS.md` mandatory bootstrap → harness-native scoped rules → progressive Skill loading → conventional CI enforcement.

CodeFlex should **not invent its own agent-facing playbook format**.

Instead, existing Web, Mobile, Backend, Cloud and Architecture playbooks should be converted into *Agent Skills using the open *`SKILL.md` format.

Agent Skills are specifically designed as folders containing instructions, references and optional scripts, with progressive disclosure so detailed content is only loaded when relevant. The specification supports a required `SKILL.md` plus optional resources such as `references/` and `scripts/`.

This approach is already supported by major coding-agent ecosystems. Codex supports repository Skills and the Agent Skills standard; Claude Code follows the Agent Skills standard; and GitHub Copilot supports Agent Skills across several of its coding-agent surfaces.

The `SKILL.md` format is portable, but Skill discovery locations are not universal. For example, Codex uses `.agents/skills`, Claude Code uses `.claude/skills`, OpenCode supports `.opencode/skills` as well as `.agents/skills` and `.claude/skills`, and Kilo uses `.kilo/skills` natively while also supporting compatibility locations including `.agents/skills`. CodeFlex should therefore treat harness-specific Skill locations as deployment details rather than making any one of them canonical.

CodeFlex-specific project detection, governance and versioning should remain **outside** `SKILL.md`, because these are responsibilities of CodeFlex's platform rather than portable instructions for an agent. In practical terms, the Playbook content that an agent needs becomes `SKILL.md` and its supporting references, while CodeFlex-specific metadata describing **when that Skill should be installed, which project technologies or versions it applies to, who owns it, which other Skills it depends on, whether it can be overridden, and which rules it supersedes** is held separately in `codeflex.yaml`. The `codeflex-playbooks` CLI is responsible for reading that metadata, detecting the current application, loading any configured client/repository standards sources, applying the precedence/override model, resolving the effective Skills and versions, and installing/projecting only that resolved subset into the repository.

---

# 1. Architectural Principles

The solution should separate seven concerns.

### Governance

Where CodeFlex engineering standards live, who owns them, how changes are approved and which generated releases are accepted as trusted inputs by the CLI. A **trusted release** is one produced by CodeFlex's approved CI/release pipeline from an authorised merge to a protected shared branch such as `dev` or `main`, after the required review and validation checks have passed. Local developer builds are useful for development and testing but are not trusted organisation-wide releases because they have not passed through that controlled provenance chain.

### Distribution

Which Skills should exist in a particular repository.

### Standards Resolution

How CodeFlex defaults, client-mandated standards, existing repository conventions, explicit overrides and approved exceptions are combined into one effective standards set. For greenfield projects this will normally resolve primarily from the CodeFlex baseline; for existing client projects, configured client/repository standards normally take precedence over conflicting CodeFlex defaults.

### Projection

How the resolved Skills are exposed to each supported coding-agent harness without making any harness-specific directory the canonical source.

### Activation

Which of those installed Skills should apply to the current task.

### Progressive disclosure

How detailed guidance is kept out of the model's context until needed.

### Enforcement

Which requirements can be enforced **mechanically** rather than relying only on an LLM following instructions. Mechanical enforcement means deterministic tooling can validate or block a violation independently of the coding agent: for example, a compiler can reject invalid code, a linter can fail a build, an architecture test can reject a forbidden dependency and CI can prevent a pull request from merging.

This is stronger than an instruction inside `AGENTS.md` or `SKILL.md`: those instructions improve agent behaviour, but the LLM can still misunderstand or ignore them. Wherever a rule can reasonably be represented as compiler configuration, linting, testing, security tooling or a CI gate, that mechanism should provide the actual guarantee and the Skill should explain the expected engineering behaviour.

These concerns should not be collapsed into one large `AGENTS.md`, one MCP service or one custom YAML format. Governance, distribution, standards resolution, projection, activation, progressive disclosure and enforcement have different responsibilities and failure modes, so they should remain separate parts of the platform.

---

# 2. Tooling Responsibilities

## `engineering-skills`

Responsible for:

```text
CodeFlex baseline SKILL.md content
reference material
rule IDs
codeflex.yaml metadata
override policy
ownership
compatibility
detectors
governance
release management
agent evaluations
```

## `codeflex-playbooks`

Responsible for:

```text
project detection
standards-source discovery/configuration
client/repository standards resolution
rule precedence and override resolution
Skill resolution
dependency resolution
version compatibility
integrity verification
installation
AGENTS.md creation
CodeFlex Engineering Standards managed-section normalisation/update
harness capability registry
projection topology resolution
harness adapters/projections
verification
diagnostics
```

## Application repository

Responsible for:

```text
project-specific configuration
configured client standards sources
project-specific/client architectural rules
approved rule overrides and exceptions
locked effective Engineering Skills state
```

## CI

Responsible for:

```text
configuration verification
mechanically enforceable standards
tests
linting
security
architecture constraints
```

---

# 3. Architecture Overview

```text
┌───────────────────────────────────────────────────────────────┐
│                    engineering-skills                         │
│                    Central GitHub Repository                  │
│                                                               │
│  Canonical CodeFlex engineering standards                       │
│                                                               │
│  skills/                                                      │
│    common/                                                    │
│    backend/                                                   │
│    frontend/                                                  │
│    mobile/                                                    │
│    cloud/                                                     │
│    architecture/                                              │
│                                                               │
│  Every Skill:                                                 │
│    SKILL.md           agent-facing standard                   │
│    codeflex.yaml        CodeFlex control metadata                 │
│    references/       detailed guidance                        │
│    scripts/          optional deterministic tools             │
│                                                               │
│  Repository governance controls:                              │
│    CODEOWNERS          required ownership/review              │
│    protected dev/main only approved merges can feed releases  │
└──────────────────────────────┬────────────────────────────────┘
                               │
                               ▼
┌───────────────────────────────────────────────────────────────┐
│                       Release Pipeline                        │
│                                                               │
│  schema validation                                            │
│  Skill validation      validate SKILL.md / codeflex.yaml        │
│                        structure, references and rule IDs     │
│  detector tests       fixture tests for project detection,    │
│                        versions and expected Skill resolution │
│  dependency/conflict validation                               │
│  agent evaluations                                            │
│  generated artefact tests                                     │
│                                                               │
│  Dev → Stable                                                 │
│  immutable/versioned trusted release                          │
└──────────────────────────────┬────────────────────────────────┘
                               │
                               ▼
┌───────────────────────────────────────────────────────────────┐
│                     codeflex-playbooks CLI                      │
│                                                               │
│  deterministic local repository detection                     │
│                                                               │
│  init                                                         │
│  sync                                                         │
│  update                                                       │
│  check                                                        │
│  detect                                                       │
│  explain                                                      │
│  status                                                       │
│                                                               │
│  resolves effective standards / applicable Skills             │
│  verifies trusted release                                     │
│  applies client/repo precedence over CodeFlex defaults          │
│  installs only relevant resolved Skills                       │
│  maintains AGENTS.md CodeFlex Standards section                 │
│  generates other bootstrap/adapters                            │
│  calculates minimum harness projections                       │
└──────────────────────────────┬────────────────────────────────┘
                               │
                               │ run when entering/switching
                               │ to an CodeFlex application repo
                               ▼
┌───────────────────────────────────────────────────────────────┐
│                     Application Repository                    │
│                                                               │
│  AGENTS.md                  portable bootstrap                │
│  CLAUDE.md                  Claude adapter                    │
│  native scoped rules        where supported                   │
│                                                               │
│  .codeflex/                                                     │
│    Repository-local metadata + locked effective Skill state   │
│    for THIS application (for example Machine Store).          │
│                                                               │
│    engineering.yaml         repo config + standards sources   │
│    engineering.lock         exact standards-source revisions  │
│                             + effective Skill set for project │
│    skills/                  canonical locked Skill content    │
│      codeflex-engineering/                                      │
│      codeflex-dotnet/                                           │
│      codeflex-entity-framework/                                 │
│      codeflex-angular/                                          │
│      client-example-dotnet/                                   │
│      ...only relevant resolved Skills                                  │
│                                                               │
│  Project-switch / sync behaviour:                             │
│                                                               │
│    .codeflex missing                                            │
│       → detect language/framework/platform/version            │
│       → load configured client/repository standards           │
│       → resolve precedence, overrides + applicable Skills     │
│       → create engineering.yaml + engineering.lock            │
│       → populate .codeflex/skills                               │
│                                                               │
│    .codeflex already exists                                     │
│       → do NOT re-resolve or silently upgrade                 │
│       → use the existing lockfile/canonical Skill store       │
│                                                               │
│    then, for either case:                                     │
│       → ensure AGENTS.md exists                               │
│       → ensure exactly one CodeFlex Engineering Standards       │
│         managed section exists and refresh its text           │
│       → calculate required harness projection directories     │
│       → remove stale CLI-managed Engineering Skills only      │
│         from those projection directories                     │
│       → project current .codeflex/skills into them              │
│                                                               │
│  Harness projections generated only where needed:             │
│    .agents/skills/                                            │
│    .claude/skills/                                            │
│    .opencode/skills/                                          │
│    .kilo/skills/                                              │
└──────────────────────────────┬────────────────────────────────┘
                               │
                               ▼
┌───────────────────────────────────────────────────────────────┐
│                           Harness                             │
│                                                               │
│  mandatory bootstrap                                          │
│       ↓                                                       │
│  native Skill projection where supported                      │
│  or canonical `.codeflex/skills` fallback                       │
│       ↓                                                       │
│  relevant SKILL.md loaded                                     │
│       ↓                                                       │
│  references loaded only if required                           │
└──────────────────────────────┬────────────────────────────────┘
                               │
                               ▼
┌───────────────────────────────────────────────────────────────┐
│                        CI / Tooling                           │
│                                                               │
│  codeflex-playbooks check                                       │
│  compiler                                                     │
│  static analysis                                              │
│  linting                                                      │
│  architecture tests                                           │
│  automated tests                                              │
│  security tooling                                             │
└───────────────────────────────────────────────────────────────┘
```

### Architecture Diagram Clarifications

\*\*Why \*\*`CODEOWNERS` and protected branches are shown in the `engineering-skills` repository

They are not part of an Engineering Skill and are not consumed by coding agents. They are shown because the `engineering-skills` repository is the organisation-wide source of engineering policy, so the repository itself requires governance controls. `CODEOWNERS` identifies the teams or individuals responsible for reviewing changes to particular Skills, while protected `dev`/`main` branches prevent unreviewed local or feature-branch changes from becoming inputs to the trusted release pipeline. Only approved merges to the configured release branch can produce organisation-wide trusted Engineering Skills releases.

\*\*What \*\*`Skill validation` means

Skill validation checks that each Engineering Skill is structurally and semantically valid before it can be released. This includes validating the required `SKILL.md`, validating its associated `codeflex.yaml`, checking required metadata and stable rule IDs, ensuring referenced files such as `references/*.md` or scripts actually exist, and rejecting malformed or incomplete Skill packages.

\*\*What \*\*`detector tests` means

The CLI uses deterministic detection rules from `codeflex.yaml` to decide which Skills apply to an application. Detector tests run those rules against representative fixture repositories and verify that the expected languages, frameworks, platforms and versions are recognised and that the correct Skill set is resolved. They should include both positive cases and negative/version-boundary cases, for example ensuring an EF Core Skill is selected for the supported EF Core version but is not incorrectly selected for an EF6 project.

\*\*What \*\*`.codeflex` represents inside an application repository

`.codeflex` is repository-local state for the CodeFlex application currently being worked on; it is not a developer-home-directory Skill store. It records the application's Engineering Skills configuration and contains the canonical, project-specific Skill set that was resolved from an approved Engineering Skills release.

`engineering.lock` pins the exact revisions/hashes of the standards sources used by the application and the final resolved set of Skills. `.codeflex/skills/` contains that **effective** Skill content, which may include both CodeFlex baseline Skills and client-specific Skills. This allows different applications and clients to use different approved standards versions without a global update changing the behaviour of every project on a developer's machine.

The intended project-switch workflow is:

1. The developer enters or switches to an CodeFlex application repository and runs the CLI synchronisation workflow.
2. If `.codeflex` does not yet exist, the CLI analyses the repository for languages, frameworks, platforms and relevant versions, loads any configured client/repository standards source, applies the precedence and override model, resolves the effective Engineering Skills, creates the repository configuration and lockfile, and populates `.codeflex/skills/`.
3. If `.codeflex` already exists, the resolution/update stage is currently a no-op: the CLI does not silently re-detect, re-resolve or upgrade the project's Engineering Skills. It uses the existing lockfile and canonical `.codeflex/skills/` state.
4. The CLI ensures that `AGENTS.md` exists and contains **exactly one** CLI-managed `CodeFlex Engineering Standards` section. If the section is missing it is added; if its managed text is out of date it is replaced; if duplicate CodeFlex-managed sections exist they are consolidated to one. Existing project-specific `AGENTS.md` content outside the managed section is preserved.
5. The CLI calculates the projection directories required by the supported harnesses.
6. In those projection directories, it removes only Skills recorded as CLI-managed by the current/previous CodeFlex projection state, including both `codeflex-*` and configured client Skills. Non-managed project, developer or third-party Skills are left untouched.
7. The CLI projects the current canonical Skills from `.codeflex/skills/` into the required harness directories.
8. This bootstrap/projection refresh is run again when switching projects so the current repository has the latest CLI-managed `CodeFlex Engineering Standards` text and stale CodeFlex Skills from another application cannot remain visible to the current coding-agent harness.

This deliberately separates **project Skill resolution** from **bootstrap/projection refresh**: an existing `.codeflex` folder prevents an implicit policy upgrade, while the `AGENTS.md` managed section and harness projections are still normalised on every project-switch/synchronisation run.

**How client/repository standards are handled**

For a greenfield project with no client-defined standards, the effective standards will normally be the applicable CodeFlex baseline Skills. For an existing client codebase, `engineering.yaml` can declare client standards sources and/or repository-specific overrides. Client standards may be stored as Skills directly in the application repository or in a separate restricted client Engineering Skills repository when several projects share the same standards. The CLI resolves those standards against CodeFlex defaults **before** writing `.codeflex/skills`, so coding agents receive one effective standards set rather than multiple contradictory rule sets.

---

# 4. Engineering Standards Become Agent Skills

The existing Confluence playbooks should be converted into Skills.

Using the Agent Skills structure:

```text
entity-framework/
├── SKILL.md
├── codeflex.yaml
├── references/
│   ├── querying.md
│   ├── migrations.md
│   ├── performance.md
│   └── examples.md
└── scripts/
```

The Agent Skills specification is explicitly designed around this model. `SKILL.md` contains the core instructions while additional documentation can live in `references/`; the agent can progressively load those additional files rather than putting everything into its context at once.

---

# 5. `SKILL.md` Is the Agent Contract

`SKILL.md` should contain everything the coding agent needs to understand:

- what the Skill is for;
- when it should be used;
- mandatory engineering rules;
- workflow guidance;
- what additional references should be loaded.

For example:

```yaml
---
name: codeflex-entity-framework
description: >
  CodeFlex engineering standards for Entity Framework Core.
  Use when modifying EF Core queries, DbContexts, mappings,
  migrations, persistence or database access.
---

# Entity Framework Core

These rules are mandatory whenever this Skill applies.

## EF-001 — Read-only queries

Read-only Entity Framework queries must use appropriate
no-tracking behaviour unless entity tracking is explicitly required.

## EF-002 — Query projection

Retrieve only data required by the operation.

## EF-003 — Mapping

Where DTO projections are required, project them at SQL/query
level rather than loading entities and mapping them afterwards.

## Additional guidance

For query implementation and optimisation, read:

`references/querying.md`

For migrations, read:

`references/migrations.md`
```

The description is particularly important because Skill-capable agents use it when deciding whether a Skill applies. Skill-capable coding-agent harnesses generally use the Skill's `name` and `description` metadata to determine when a Skill is relevant, while also allowing some form of explicit invocation. The exact invocation mechanism varies by harness, but the common pattern is that only Skill metadata is initially exposed and the full `SKILL.md` content is loaded when the Skill is selected or invoked.

---

# 6. `codeflex.yaml` Remains Separate

CodeFlex should **not overload the Agent Skills standard with organisation-specific metadata**.

The standard `metadata` property is deliberately simple — a string-to-string map — whereas CodeFlex requires structured concepts such as framework version ranges, ownership, dependencies, rule IDs, detection conditions, standards source, override policy and explicit rule overrides.

Each Skill should therefore have a sidecar:

```text
codeflex.yaml
```

Example:

```yaml
id: backend.entity-framework
source: codeflex

overridePolicy: allowed

owner:
  team: backend-platform

installWhen:
  any:
    - packageReference:
        package: Microsoft.EntityFrameworkCore
        version: ">=8 <11"

requires:
  - backend.dotnet

appliesWhen:
  paths:
    - "**/*.cs"

  capabilities:
    - database
    - persistence
    - query
    - migration

rules:
  - EF-001
  - EF-002
  - EF-003

review:
  lastReviewed: 2026-07-01
  reviewBy: 2027-01-01
```

`overridePolicy` can define a default for the Skill, but the metadata model should also allow individual rule IDs to be marked `non-overridable` where required. This lets normal engineering defaults be superseded by explicit client standards while preventing legal, regulatory, security or compliance guardrails from being bypassed automatically.

This file is **not intended for the agent**.

It is consumed by `codeflex-playbooks`.

That creates a clean separation:

```text
SKILL.md
    ↓
agent semantics

codeflex.yaml
    ↓
CodeFlex distribution/governance semantics
```

---

# 7. Central Repository Structure

The central repository should therefore look approximately like:

```text
engineering-skills/

skills/
  common/
    engineering/
      SKILL.md
      codeflex.yaml
      references/

    security/
      SKILL.md
      codeflex.yaml
      references/

    testing/
      SKILL.md
      codeflex.yaml

  backend/
    dotnet/
      SKILL.md
      codeflex.yaml
      references/

    aspnet-core/
      SKILL.md
      codeflex.yaml
      references/

    entity-framework/
      SKILL.md
      codeflex.yaml
      references/

  frontend/
    angular/
      SKILL.md
      codeflex.yaml
      references/

    ngxs/
      SKILL.md
      codeflex.yaml
      references/

    react/
      SKILL.md
      codeflex.yaml

  mobile/
    android/
    ios/
    react-native/

  cloud/
    azure/
    bicep/
    terraform/
    docker/

  architecture/
    api-design/
    microservices/
    observability/

tests/
  detectors/
  fixtures/
  evaluations/
```

This repository becomes the canonical source for **CodeFlex's baseline engineering standards**.

Client-specific standards should not automatically be placed in the shared CodeFlex repository. Where standards are specific to one project they can live with that application; where multiple projects for the same client share standards they should preferably live in a separate access-controlled client Engineering Skills repository. This avoids exposing confidential client guidance more broadly than necessary while still allowing the CLI to resolve it as a first-class standards source.

---

# 8. Stable Rule IDs

Mandatory rules should have stable identifiers:

```text
SEC-001
DOTNET-014
EF-003
ANGULAR-021
MOBILE-009
```

Rule IDs provide:

- traceability;
- exceptions;
- release notes;
- automated tests;
- code-review references;
- deprecation;
- policy audits;
- deterministic client/repository overrides and conflict resolution.

Rule wording may change without changing its identity.

---

# 9. `codeflex-playbooks` Is the Control Plane

`codeflex-playbooks` should be a **TypeScript-based CLI**, most likely targeting Node.js, packaged and distributed internally through npm so developers can install it globally in the same style as the Angular CLI. The exact supporting CLI framework/library is an implementation detail and can be selected during delivery without changing the architecture.

The CLI should not itself contain the engineering standards.

Its responsibilities are:

```text
Detect
Load standards sources
Resolve precedence / overrides
Resolve Skills
Verify
Install
Generate
Validate
Explain
```

The engineering Skills are versioned independently.

Recommended commands:

```bash
codeflex-playbooks init
codeflex-playbooks sync
codeflex-playbooks update
codeflex-playbooks check
codeflex-playbooks detect
codeflex-playbooks explain
codeflex-playbooks status
```

---

# 10. Deterministic Project Detection

The CLI should determine repository technology using deterministic rules rather than LLM classification.

Examples:

```text
*.csproj
*.sln
    → .NET

Microsoft.EntityFrameworkCore
    → Entity Framework Core

angular.json
@angular/core
    → Angular

@ngxs/store
    → NGXS

build.gradle
    → Android/Gradle

*.bicep
    → Bicep/Azure

*.tf
    → Terraform
```

Detection should also consider framework versions.

For example:

```text
EF6
```

must not receive a Skill intended for:

```text
EF Core 10
```

even though both represent Entity Framework usage.

---

# 11. Monorepos Remain Scoped

Detection must retain **where** technology occurs.

For example:

```text
src/backend/
    .NET + EF

src/web/
    Angular + NGXS

src/mobile/
    React Native
```

should resolve to:

```yaml
codeflex-entity-framework:
  scopes:
    - src/backend/**

codeflex-angular:
  scopes:
    - src/web/**

codeflex-ngxs:
  scopes:
    - src/web/**

codeflex-react-native:
  scopes:
    - src/mobile/**
```

This prevents unrelated standards entering agent context.

---

# 12. Repository Configuration

```text
.codeflex/engineering.yaml
```

Describes the repository's engineering-policy configuration, including the supported harnesses, optional client standards sources, manual inclusions/exclusions, scopes and approved exceptions.

Example:

```yaml
version: 1

autoDetect: true

agentHarnesses:
  - codex
  - claude-code
  - opencode
  - kilo

standards:
  codeflex:
    enabled: true

  # Optional. Absent for a normal greenfield CodeFlex-led project.
  client:
    - id: example-client
      source:
        type: repository
        path: .client/engineering-skills

      # Alternatively this could reference an access-controlled Git source
      # shared by several repositories for the same client.

include:
  - codeflex-api-design

exclude: []

scopes:
  codeflex-entity-framework:
    - src/backend/**

  codeflex-angular:
    - src/web/**

exceptions:
  - rule: DOTNET-014
    reference: ADR-0187
    expires: 2027-01-01
```

Automatic technology detection remains the default. Organisation-level defaults should normally define the supported harness set, with `agentHarnesses` overridden per repository only where necessary.

Client standards are **optional**: greenfield projects normally use the CodeFlex baseline alone, while existing client projects can declare one or more client standards sources. The CLI should not attempt to infer authoritative client policy from arbitrary documentation without an explicit configured source; it may identify likely standards files during `init`, but the selected source should be persisted in `engineering.yaml`.

Explicit configuration exists for edge cases.

---

# 13. Immutable Resolution

The repository should also contain:

```text
.codeflex/engineering.lock
```

Example:

```yaml
version: 1

sources:
  codeflex:
    release: 2026.09.0
    commit: 7f82c...
    sha256: 4128e...

  client:
    - id: example-client
      source: .client/engineering-skills
      sha256: 9ab31...

skills:
  - codeflex-engineering
  - codeflex-security
  - codeflex-dotnet
  - codeflex-entity-framework
  - client-example-dotnet
  - codeflex-angular

resolvedOverrides:
  DOTNET-MAPPING-001: client-example-dotnet

projections:
  - adapter: agents
    path: .agents/skills

  - adapter: claude-code
    path: .claude/skills
```

This makes the standards sources, effective engineering standards and their harness projections reproducible. A historical checkout can therefore reconstruct not just the CodeFlex release in use, but also the client standards and explicit overrides that applied to that project at the time.

---

# 14. Correct CLI Semantics

`sync` and `update` must remain distinct.

### `init`

Detect the project, load configured client/repository standards, resolve precedence against the CodeFlex baseline, and establish the initial effective Skill configuration.

### `sync`

Restore exactly what is specified by `engineering.lock`.

It must **never silently upgrade engineering policy**.

### `update`

Resolve newer approved standards-source revisions (CodeFlex and, where configured, client standards), recalculate the effective standards set, and update the lockfile. Client/repository standards must never be silently replaced by CodeFlex defaults during an update.

### `check`

Verify that the repository matches its committed configuration.

### `detect`

Show what the CLI detects.

### `explain`

Explain why a particular Skill was installed.

### `status`

Show CLI and Engineering Skills version status.

---

# 15. Canonical Skills Store and Harness Projections

The application repository should contain only the **effective resolved Skills** for that project, but **no harness-owned Skill directory should be treated as the canonical copy**. The canonical store can contain CodeFlex baseline Skills and client-specific Skills.

The resolved Skills should be stored once under:

```text
.codeflex/
  skills/
    codeflex-engineering/
    codeflex-security/
    codeflex-dotnet/
    codeflex-aspnet-core/
    codeflex-entity-framework/
    codeflex-angular/
    codeflex-ngxs/
    codeflex-azure/
    client-example-dotnet/
```

It should not receive irrelevant CodeFlex or client Skills for technologies, projects or standards that do not apply to the current repository.

`codeflex-playbooks` should then project those canonical Skills into the minimum set of locations required by the coding-agent harnesses supported by the repository.

Current harnesses do not all use the same native location:

```text
Codex
    .agents/skills/

Claude Code
    .claude/skills/

OpenCode
    .opencode/skills/
    also discovers .agents/skills/ and .claude/skills/

Kilo
    .kilo/skills/
    also discovers .agents/skills/ by default
```

This means a repository supporting Codex, OpenCode and Kilo may require only a single `.agents/skills/` projection, whereas supporting Claude Code as well may require an additional `.claude/skills/` projection.

The CLI should calculate the **minimum compatible projection topology** rather than blindly copying every Skill into every harness directory. This avoids duplicate Skill discovery, unnecessary repository noise and multiple generated copies becoming inconsistent.

The important architectural distinction is:

```text
.codeflex/skills/
    canonical resolved Engineering Skills

harness-specific directories/configuration
    generated projections only
```

Harness discovery behaviour should therefore be implemented and versioned through `codeflex-playbooks` adapters rather than embedded into the Engineering Skills themselves.

### Projection Path Locality

The projection paths shown above (`.agents/skills/`, `.claude/skills/`, etc.) are **home-directory-global**, not repository-local. When the CLI projects skills, it writes them to `~/.agents/skills/`, `~/.claude/skills/`, and so on — the user's home directory — rather than into the current repository.

This matches how these tools actually discover skills:

- **Codex** discovers skills from `~/.agents/skills/` (global user directory)
- **Claude Code** discovers skills from `~/.claude/skills/` (global user directory)
- **OpenCode** discovers skills from `~/.opencode/skills/` and also `~/.agents/skills/` and `~/.claude/skills/`
- **Kilo** discovers skills from `~/.kilo/skills/` and also `~/.agents/skills/`

The canonical source of truth remains `.codeflex/skills/` within the repository, but the harness projections are written to the global user-level directories where each tool expects to find them. This ensures skills are available to the coding agent regardless of which repository is currently active, while the repository-local `.codeflex/skills/` maintains the project-specific resolved skill set.

This design choice means:

- Skills are available immediately when switching between CodeFlex repositories
- Multiple CodeFlex repositories on the same machine share the same projected skill locations
- The repository only commits `.codeflex/skills/` (the canonical source), not the harness projections
- Each developer's machine has its own projections based on their configured harnesses

---

# 16. Skills Provide Progressive Disclosure

Codex initially loads Skill names/descriptions rather than every full `SKILL.md`, then reads the detailed Skill when it selects it.

Claude similarly keeps Skill bodies out of context until a Skill is actually used.

Therefore a repository can have:

```text
codeflex-engineering
codeflex-security
codeflex-dotnet
codeflex-aspnet
codeflex-entity-framework
codeflex-angular
codeflex-ngxs
codeflex-azure
```

available without injecting all eight detailed standards into every prompt.

An EF task should load:

```text
codeflex-engineering
codeflex-dotnet
codeflex-entity-framework
```

while leaving Angular and Azure guidance unloaded.

This directly addresses the original context-pollution requirement.

---

# 17. Do Not Rely Solely on Skill Auto-Selection

Agent Skills alone are **not enough** for mandatory engineering standards.

Skill systems generally involve the model determining whether a Skill matches the task. Codex explicitly supports implicit model-driven Skill selection, and Claude automatically uses Skills when it considers them relevant.

Therefore the architecture must still contain a mandatory bootstrap.

---

# 18. `AGENTS.md` Remains the Portable Bootstrap

`codeflex-playbooks` should \*\*own and maintain only the \*\*`CodeFlex Engineering Standards` section of `AGENTS.md`, not the entire file. This allows repositories to keep their own project-specific agent instructions while ensuring CodeFlex's mandatory bootstrap is always present and current.

Whenever the CLI is run as part of initialising, entering or switching to a project, it should perform an idempotent `AGENTS.md` normalisation step:

1. Create `AGENTS.md` if it does not exist.
2. Locate any existing CLI-managed `CodeFlex Engineering Standards` block.
3. If no managed block exists, add one.
4. If a managed block exists but its text is stale, replace it with the current CLI-defined version.
5. If duplicate CodeFlex-managed blocks exist, remove the duplicates and leave exactly one current block.
6. Preserve all non-CodeFlex/project-specific content outside the managed block.

The managed block should use explicit markers so ownership is unambiguous:

```markdown
<!-- codeflex-engineering-standards:start -->
## CodeFlex Engineering Standards

The resolved Engineering Standards for this repository are mandatory. They may include CodeFlex baseline Skills and configured client/repository Skills. Approved client/repository standards supersede conflicting CodeFlex defaults where the resolved configuration says they do; rules marked non-overridable must not be bypassed automatically.

Canonical resolved Engineering Skills for this repository are stored under `.codeflex/skills/`.

Before planning or modifying code:

1. Determine which technologies and areas the task affects.
2. Use every applicable resolved Engineering Skill in `.codeflex/skills/`, including configured client Skills.
3. If the current harness supports Agent Skills natively, use the generated harness projection.
4. Otherwise read the applicable `SKILL.md` directly from `.codeflex/skills/`.
5. Apply all mandatory rules from those Skills throughout the task.
6. Load additional Skill references only when required.
7. Do not load unrelated Engineering Skills.
<!-- codeflex-engineering-standards:end -->
```

The marker names and exact managed text should be owned by `codeflex-playbooks`, allowing future CLI releases to safely update the bootstrap without overwriting unrelated repository instructions. If an older repository contains the `## CodeFlex Engineering Standards` section without management markers, the CLI should adopt/normalise that section rather than appending a second copy.

For Codex specifically, `AGENTS.md` is read before work begins, making it an appropriate bootstrap mechanism.

The bootstrap is not the playbook.

It simply ensures the agent understands that the installed Engineering Skills are part of its required operating instructions.

---

# 19. Claude Compatibility

Claude Code reads `CLAUDE.md` rather than `AGENTS.md`.

Anthropic explicitly recommends importing an existing `AGENTS.md` into `CLAUDE.md` where repositories support multiple coding agents.

Therefore generate:

```markdown
@AGENTS.md
```

inside `CLAUDE.md`.

Any Claude-specific additions can follow that import.

This avoids maintaining duplicate bootstrap instructions. Where Claude Code is a supported harness, `codeflex-playbooks` should also project the applicable canonical Skills into Claude's supported project Skill location while keeping `.codeflex/skills` as the source of truth.

---

# 20. Harness-Native Scoped Rules

Skills provide progressive disclosure, but the strongest architecture combines that with native deterministic scoping.

Where a harness supports path-scoped instructions, `codeflex-playbooks` should generate them.

For example:

```text
src/backend/**/*.cs
    → .NET / EF rules

src/web/**
    → Angular / NGXS rules
```

Claude supports path-scoped project rules and explicitly recommends them where instructions only matter for particular parts of a codebase.

GitHub Copilot also supports path-specific repository instructions on supported surfaces.

Therefore:

```text
AGENTS.md
    portable requirement

+

Agent Skills
    progressive detailed guidance

+

native scoped instructions
    stronger deterministic activation where supported
```

is preferable to any individual mechanism in isolation.

---

# 21. Avoid Duplication Between Rules and Skills

Do not generate the same large engineering standard into:

```text
AGENTS.md
CLAUDE.md
Copilot instructions
Skill
```

Instead:

```text
SKILL.md
    canonical agent guidance

AGENTS.md
    tiny mandatory bootstrap

CLAUDE.md
    import shim

native path rule
    tiny activation/mandatory-rule optimisation
```

The source of detailed engineering guidance remains the Skill.

---

# 22. Client Standards and Rule Precedence

CodeFlex is a consultancy, so the standards model must support two materially different project types:

### Greenfield / CodeFlex-led projects

Where a client has not prescribed an engineering approach and CodeFlex is responsible for establishing the codebase, the applicable CodeFlex Engineering Skills form the default standards baseline.

### Existing client projects

Where a client already has engineering standards, architecture decisions or established repository conventions, those standards should be treated as **first-class inputs** rather than forcing every difference to be represented as an exception to CodeFlex policy.

Client standards can be represented as Agent Skills using the same `SKILL.md` structure as CodeFlex Skills. They may be stored:

- directly in the client application repository for project-specific standards; or
- in a separate access-controlled client Engineering Skills repository where multiple projects for the same client share standards.

Existing ADRs, architecture documents and repository conventions can remain their human source of truth, but any rules that need to participate in deterministic CLI conflict resolution should be represented as client/repository Skills or explicit rule overrides in `engineering.yaml`. The CLI should not attempt to semantically interpret arbitrary client documentation and decide on its own which policy is authoritative.

The recommended precedence model is:

```text
Legal / regulatory / contractual requirements
        +
CodeFlex rules explicitly marked non-overridable
        ↓
Client-mandated engineering standards
        ↓
Existing repository architecture / ADRs / conventions
        ↓
CodeFlex engineering baseline
        ↓
Task-specific instructions
        ↓
Developer preferences
```

CodeFlex standards should therefore be understood as **mandatory defaults**, not as an assumption that CodeFlex always owns the project's technical standards. Client/repository standards can supersede normal CodeFlex engineering defaults where explicitly configured. If a client requirement conflicts with a non-overridable legal, regulatory, security or compliance rule, the CLI should report a resolution conflict requiring escalation rather than silently choosing either side.

## Explicit rule overrides

Stable rule IDs allow conflicts to be resolved before instructions reach the agent. A client Skill can explicitly declare that it supersedes an CodeFlex default:

```yaml
id: client-example-dotnet
source: client

overrides:
  - DOTNET-MAPPING-001

appliesWhen:
  paths:
    - "**/*.cs"
```

For example, if CodeFlex's future-project default is Mapster but an existing client application is standardised on AutoMapper, `client-example-dotnet` can override the CodeFlex mapping rule. The CLI should resolve that conflict while constructing `.codeflex/skills`, rather than projecting both contradictory instructions and expecting the LLM to decide which one wins.

The resolved state should be inspectable, for example:

```text
codeflex-playbooks explain DOTNET-MAPPING-001

CodeFlex default:
  Use Mapster

Status:
  overridden

Override source:
  client-example-dotnet

Reason/reference:
  Existing client .NET engineering standard
```

This allows CodeFlex's playbooks to fill gaps where the client has no preference while respecting established client standards where they do.

---

# 23. Explicit Exceptions

Repositories sometimes need intentional deviations.

These must be represented explicitly:

```yaml
exceptions:
  - rule: DOTNET-014

    reason: >
      Legacy supplier integration requires synchronous API access.

    approvedBy: architecture

    reference: ADR-0187
```

This prevents teams from solving exceptions by editing generated Skills or simply ignoring standards. Exceptions are best suited to isolated project deviations or temporary migration constraints. Where a client has a repeatable body of positive engineering standards, those standards should be modelled as client Skills instead of creating a large collection of one-off exceptions.

---

# 24. Playbook Governance

Every Engineering Skill requires an owner.

For example:

```yaml
owner:
  team: web-platform

requiredReviewers:
  - web-platform

review:
  lastReviewed: 2026-07-01
  reviewBy: 2027-01-01
```

Suggested ownership:

```text
Security
    Security/platform

.NET/backend
    Backend engineering

Angular/React
    Web engineering

Android/iOS
    Mobile engineering

Architecture
    Principal/architecture group
```

Client Skills also require an explicit owner and source-of-truth policy. Where the client owns the standard, CodeFlex should record the responsible client/CodeFlex contact and the authoritative client reference. Client-specific Skills containing confidential guidance should normally live in the application repository or a restricted client-specific repository rather than the organisation-wide `engineering-skills` repository.

---

# 25. Trusted Release Pipeline

Engineering Skills should be treated as privileged agent instructions.

For this proposal, **trusted** refers to release provenance rather than simply whether a build succeeds. A trusted Engineering Skills release must be produced by CodeFlex's controlled CI/release pipeline from an authorised commit merged to an approved protected branch such as `dev` or `main`, with the required reviews and automated checks completed. Locally produced developer packages or ad-hoc builds must not be accepted by the CLI as organisation-wide trusted releases.

Changes should flow through:

```text
PR
 ↓
CODEOWNERS review
 ↓
schema validation
 ↓
Skill validation
 ↓
detector tests
 ↓
agent evaluations
 ↓
canary/dev release
 ↓
stable immutable release
```

For CodeFlex's centrally distributed baseline, the CLI should install only an approved release whose integrity matches the committed lockfile. Configured client/repository standards may follow the client's or application's own governance process rather than CodeFlex's release pipeline, but the source must be explicitly authorised in `engineering.yaml` and its exact revision/content hash recorded in `engineering.lock` so the effective standards remain auditable and reproducible.

---

# 26. Canary/Dev Before Organisation-Wide Updates

A new Engineering Skills release should first run against representative repositories:

```text
.NET API
.NET + Angular
React
Android
iOS
large monorepo
legacy project
```

Only after validation should it become stable.

Updates modify coding-agent behaviour, so they deserve more controlled rollout than ordinary documentation changes.

---

# 27. Commit Skills Into Each Application Repository

Resolved Skills should be committed.

An agent should not need access to:

```text
Confluence
GitHub
MCP
package registry
central API
```

during an ordinary coding session.

A normal clone should already contain:

```text
AGENTS.md
CLAUDE.md
.codeflex/engineering.yaml
.codeflex/engineering.lock
.codeflex/skills/*
required harness projections (for example `.agents/skills/*` or `.claude/skills/*`)
```

This makes the system work for:

- local agents;
- IDE agents;
- CLI agents;
- remote/cloud agents;
- CI environments;
- temporarily offline environments.

---

# 28. Global CLI Installation and Runtime Behaviour

Developers using the platform should install `codeflex-playbooks` globally from CodeFlex's internal npm registry, in the same way that tools such as the Angular CLI are commonly installed:

```bash
npm install -g @codeflex-consultants/codeflex-playbooks
```

This provides the standard developer commands:

```bash
codeflex-playbooks status
codeflex-playbooks explain
codeflex-playbooks sync
codeflex-playbooks update
```

The global installation is the normal developer entry point for initialising a project, switching into or synchronising a project, diagnosing Skill resolution and deliberately updating Engineering Skills. As part of the initialisation/project-switch synchronisation workflow, the CLI also creates or normalises the `AGENTS.md` `CodeFlex Engineering Standards` managed section so that it exists exactly once and contains the current CLI-defined bootstrap text. However, an **already prepared application repository should not require the CLI to be invoked for every coding-agent session**: the canonical `.codeflex/skills` store, lockfile, bootstrap instructions and required harness projections are committed to the repository.

CI and central automation should use an explicitly approved/pinned CLI version rather than whichever global version happens to be installed on an individual developer machine. This prevents differences such as:

```text
Developer A → CLI 1.5
Developer B → CLI 1.8
CI          → CLI 1.6
```

from becoming the authoritative source of generated repository state.

---

# 29. Synchronisation Must Be CodeFlex

Updates should use:

```text
download
   ↓
verify
   ↓
resolve
   ↓
generate temporary output
   ↓
validate complete output
   ↓
codeflex replacement
```

If any stage fails:

```text
existing repository state remains untouched
```

`check` should normally work offline.

---

# 30. Local-Only Detection

CLI Project detection should run locally.

Application source should not be uploaded to a central service merely to identify project technology.

The only normal network direction should be:

```text
approved Engineering Skills release
        ↓
developer/CI machine
```

This substantially simplifies security and privacy concerns.

---

# 31. Machine Enforcement Remains Essential

Neither `AGENTS.md` nor Skills are security or policy enforcement mechanisms.

Anthropic explicitly describes persistent project instructions as context rather than enforced configuration.

Therefore classify requirements as:

### Delivered

We guarantee that the agent can see the applicable standard.

### Instruction-enforced

The agent is explicitly required to follow it.

### Machine-enforced

Tooling makes violation fail.

Anything suitable for deterministic enforcement should move to:

```text
compiler settings
linters
formatters
architecture tests
security scanning
unit/integration tests
CI
```

Skills should focus on engineering decisions and workflows that cannot easily be encoded mechanically.

---

# 32. Agent Evaluation Suite

The Engineering Skills repository needs behavioural tests.

Fixture repositories might include:

```text
tests/fixtures/
  dotnet-api/
  dotnet-angular/
  react/
  android/
  ios/
  monorepo/
  legacy-dotnet/
  greenfield-client/
  existing-client-standards/
  client-conflicting-standards/
```

Example evaluation:

```text
Repository:
.NET + EF Core

Task:
Add a query returning active customers.

Expected Skills:
codeflex-engineering
codeflex-dotnet
codeflex-entity-framework

Should not activate:
codeflex-angular
codeflex-azure
codeflex-mobile

Expected mandatory rules:
EF-001
EF-002
EF-003
```

Client-standard scenarios should explicitly test:

```text
Greenfield project
    client defines no mapping standard
    → CodeFlex Mapster default applies

Existing client project
    client standard requires AutoMapper
    CodeFlex default requires Mapster
    → client AutoMapper standard is effective

Non-overridable conflict
    client standard conflicts with a non-overridable security/compliance rule
    → resolution fails and requires escalation
```

Test these periodically against supported coding-agent harnesses.

OpenAI itself recommends systematic evaluation of Skills, and both OpenAI and Anthropic now expose dedicated Skill authoring/evaluation workflows.

---

# 33. Maintain an Explicit Compatibility Matrix

Do not promise:

> Works identically with every coding agent.

Instead:

> CodeFlex supplies an open-standard Skill representation and portable bootstrap, with tested adapters for supported harnesses.

Maintain something like:

| Harness | Bootstrap | Skill Discovery / Projection | Native Scoping | CodeFlex Support |
| --- | --- | --- | --- | --- |
| Codex | `AGENTS.md` | `.agents/skills/` | Harness-specific | Supported |
| Claude Code | `CLAUDE.md` importing AGENTS | `.claude/skills/` | Yes | Supported |
| OpenCode | `AGENTS.md` | `.opencode/skills/`, `.agents/skills/`, `.claude/skills/` | Harness-specific | Supported |
| Kilo | `AGENTS.md` | `.kilo/skills/`; `.agents/skills/` compatibility by default | Yes/per-directory AGENTS | Supported |
| Copilot | Surface dependent | Agent Skills on supported surfaces | Yes on supported surfaces | Supported |
| Cursor | Test continuously | Harness/version dependent | Native rules | Supported once verified |
| Other Agent Skills clients | Adapter dependent | Adapter dependent | Varies | Best effort |

Support should be based on automated compatibility testing, not assumptions. The harness compatibility registry in `codeflex-playbooks` should be the single source for supported Skill paths, compatibility locations, bootstrap files and native scoping capabilities.

---

# 34. Repository Layout

A representative application should ultimately look approximately like:

```text
repository/

AGENTS.md
CLAUDE.md

.codeflex/
  engineering.yaml
  engineering.lock

  skills/
    codeflex-engineering/
      SKILL.md
      references/

    codeflex-security/
      SKILL.md
      references/

    codeflex-dotnet/
      SKILL.md
      references/

    codeflex-entity-framework/
      SKILL.md
      references/

    codeflex-angular/
      SKILL.md
      references/

    client-example-dotnet/
      SKILL.md
      references/

.client/
  engineering-skills/
    # optional repository-local client standards source

.agents/
  skills/
    # generated projection where required

.claude/
  skills/
    # generated projection where required

.opencode/
  skills/
    # generated only where required by the resolved harness topology

.kilo/
  skills/
    # generated only where required by the resolved harness topology

.github/
  instructions/
    # generated where useful
```

Only the effective Skills applicable to that repository are installed under `.codeflex/skills`, including configured client Skills where relevant. `.client/engineering-skills` is only one possible repository-local source; shared client standards can instead come from a restricted client-specific Git repository. Harness-specific directories are projections generated only where required for the repository's supported coding-agent harnesses.

---

# Recommended Rollout

## Phase 1 — Prototype

Build:

```text
engineering-skills
codeflex-playbooks
```

Initially convert a limited set:

```text
Engineering Core
Security
.NET
ASP.NET Core
Entity Framework
Angular
NGXS
Azure
```

Test with several representative repositories, including at least one greenfield CodeFlex-led project and one existing client project with standards that intentionally differ from CodeFlex defaults.

## Phase 2 — Harness Evaluation

Test the same engineering tasks using supported agent harnesses, including Codex, Claude Code, OpenCode and Kilo in the initial compatibility set.

Measure:

```text
Skill discovery accuracy
Skill activation accuracy
client/CodeFlex precedence resolution accuracy
rule compliance
incorrect Skill activation
missed Skill activation
context overhead
```

## Phase 3 — Governance

Add:

```text
CODEOWNERS
stable rule IDs
owners
client standards/override policy
exception policy
release lifecycle
canary/dev & stable channels
```

## Phase 4 — Migrate Confluence Playbooks

Convert the existing engineering playbooks into:

```text
SKILL.md
references/*
codeflex.yaml
```

Confluence can remain a generated human-readable representation if needed.

## Phase 5 — Repository Integration

Add Engineering Skills through automated migration PRs.

Add:

```bash
codeflex-playbooks check
```

to CI.

## Phase 6 — Native Harness Optimisation

Generate native scoped instructions where they provide measurable improvement.

## Phase 7 — Organisation-Wide Rollout

Automated update PRs manage Engineering Skills versions centrally.

Normal developers simply clone projects and use their preferred supported coding agent.

---

# Decision

CodeFlex should adopt **Agent Skills as the canonical agent-facing representation of engineering playbooks**, rather than designing a custom playbook document format.

CodeFlex should add a thin organisation-specific control layer around the open Skill format rather than extending `SKILL.md` beyond its intended purpose. CodeFlex Engineering Skills provide the default baseline, while client-mandated and existing repository standards are first-class inputs that can supersede normal CodeFlex defaults according to an explicit precedence model.

The architecture is therefore:

> *Each engineering standard becomes an Agent Skill containing *`SKILL.md` and progressively loaded references. A small `codeflex.yaml` sidecar contains deterministic installation, version compatibility, ownership, applicability and override metadata. A centrally managed `codeflex-playbooks` CLI analyses repositories, loads configured client/repository standards, applies the precedence model against CodeFlex's baseline, and vendors only the resulting effective Skills into a harness-independent canonical store under `.codeflex/skills`, recording the exact standards sources, overrides and resolution in `.codeflex/engineering.lock`. The CLI then uses versioned harness adapters to generate the minimum set of Skill projections required by the repository's supported coding agents, such as `.agents/skills`, `.claude/skills`, `.opencode/skills` or `.kilo/skills`. The CLI maintains exactly one managed `CodeFlex Engineering Standards` section in `AGENTS.md`, keeping its bootstrap text current while preserving other project-specific instructions; that section establishes the mandatory cross-agent requirement to use the resolved Engineering Skills and provides a fallback to read canonical `SKILL.md` files directly where native Skill discovery is unavailable. Harness-native scoped instructions are generated where useful. Skills provide progressive disclosure, while CI enforces every standard that can be verified mechanically.

## Architecture in one sentence

*Git governs CodeFlex's baseline and versioned client standards sources, Agent Skills package the engineering knowledge, *`.codeflex/skills` contains the harness-independent **effective** standards resolved for that project, `codeflex.yaml` describes deterministic applicability and overrides, the CLI resolves client/repository precedence before projecting the right Skills into each supported harness, the CLI keeps exactly one up-to-date `CodeFlex Engineering Standards` block in `AGENTS.md` to supply the mandatory portable bootstrap and fallback, native scoped rules strengthen activation, and CI provides the enforcement that agent instructions alone cannot guarantee.
