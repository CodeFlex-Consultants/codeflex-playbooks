# codeflex-playbooks

CLI for detecting project technologies, resolving engineering standards, and distributing Agent Skills to application repositories.

## Purpose

`codeflex-playbooks` is the control plane for CodeFlex's Engineering Skills platform. It analyses application repositories, resolves applicable engineering standards (including client-specific overrides), and distributes only the relevant Agent Skills into each repository.

Part of the CodeFlex Engineering Skills platform:

```
engineering-skills (central standards repository)
        ↓
Release Pipeline (validation, trusted releases)
        ↓
codeflex-playbooks CLI ← you are here
        ↓
Application Repository (.codeflex/skills/, harness projections, AGENTS.md)
        ↓
Coding Agent Harness (progressive skill loading)
```

## Getting Started in a New Project

This is the fast path for a developer applying `codeflex-playbooks` to an application repository for the first time.

**Prerequisites**
- Node.js >= 22

**Steps**

1. Install the CLI globally:
   ```bash
   npm install -g @codeflex-consultants/codeflex-playbooks
   ```
2. From the root of the application repository you want to onboard, run:
   ```bash
   codeflex-playbooks enter
   ```
   This detects the project, resolves the applicable engineering standards, and creates `.codeflex/engineering.yaml`, `.codeflex/engineering.lock`, `.codeflex/skills/`, and the harness projections (e.g. `AGENTS.md`) for you. On a repo that's already been onboarded, `enter` restores the locked state instead (equivalent to `sync`).
3. Verify the result:
   ```bash
   codeflex-playbooks status   # CLI version, locked skills release, update availability
   codeflex-playbooks check    # confirms the repo matches its committed configuration
   ```
4. Commit the generated `.codeflex/` files and any updated harness bootstrap files (e.g. `AGENTS.md`) to the repository so the rest of the team gets the same resolved standards.

## Installation

Install from npm:

```bash
npm install -g @codeflex-consultants/codeflex-playbooks
```

Or install globally from a local checkout:

```bash
git clone <repository-url>
cd codeflex-playbooks/cli
npm install
npm run build
npm install -g .
```

Requires Node.js >= 22.

## Commands

```bash
codeflex-playbooks init      # Detect project, resolve initial standards
codeflex-playbooks sync      # Restore locked standards (no upgrades)
codeflex-playbooks enter     # Init or sync depending on project state
codeflex-playbooks update    # Resolve newer approved revisions
codeflex-playbooks diff      # Show what would change before updating
codeflex-playbooks check     # Verify repository matches configuration
codeflex-playbooks detect    # Show detected technologies
codeflex-playbooks explain   # Explain why a skill was installed
codeflex-playbooks status    # Show CLI and skills version status
codeflex-playbooks doctor    # Diagnose and fix configuration issues
codeflex-playbooks migrate   # Migrate between harness configurations
codeflex-playbooks clean     # Remove projected skill directories and scoped rule files
```

### Global AGENTS.md Support

The CLI supports a global `~/.agents/AGENTS.md` file that applies to all projects. Use the `--global` flag with `init` or `sync` to manage the global file:

```bash
codeflex-playbooks init --global    # Create/update ~/.agents/AGENTS.md
codeflex-playbooks sync --global    # Sync global AGENTS.md from lockfile
```

Global AGENTS.md is loaded first, then project-level AGENTS.md (which can override/extend global settings).

### `init`

Detect the project, load configured client/repository standards, resolve precedence against the CodeFlex baseline, and establish the initial effective Skill configuration. Creates `.codeflex/engineering.yaml`, `.codeflex/engineering.lock`, populates `.codeflex/skills/`, and generates harness projections.

Checks for deprecated configurations by default (suppress with `--suppress-deprecations`). Pass `--remove-legacy` to back up and remove legacy harness bootstrap files (e.g. `.cursorrules`) once their replacement has been generated.

### `sync`

Restore exactly what is specified by `engineering.lock`. Never silently upgrades engineering policy. Use after cloning a repository or when the working tree has drifted from the committed state. Also accepts `--remove-legacy` to back up and remove legacy harness bootstrap files. Does not check for deprecated configurations — use `init`, `check --check-deprecations`, or `doctor` for that.

### `enter`

Convenience command that runs `init` if `.codeflex/` does not exist, or `sync` if it does. Use when entering or switching to an CodeFlex project to ensure AGENTS.md and harness projections are up to date.

### `update`

Resolve newer approved standards-source revisions (CodeFlex and, where configured, client standards), recalculate the effective standards set, and update the lockfile. Client/repository standards are never silently replaced by CodeFlex defaults during an update.

### `diff`

Show what would change before running `update`. Displays which skills would be added or removed, and which harness projection files would be modified. Useful for previewing changes before committing to an update.

### `check`

Verify that the repository matches its committed configuration. Suitable for CI. Normally works offline. Pass `--strict` to treat warnings as errors, and `--check-deprecations` to additionally check for deprecated configurations (off by default for this command).

### `detect`

Show what technologies the CLI detects in the repository. Useful for understanding which Skills will be selected.

### `explain [skill-or-rule]`

Explain why a particular Skill was installed or how a specific rule was resolved, including the precedence chain and any overrides applied.

### `status`

Show CLI version, locked Engineering Skills release, and whether updates are available.

### `doctor`

Diagnose and fix common configuration issues. Runs a series of checks on your codeflex-playbooks setup:

```bash
codeflex-playbooks doctor           # Run diagnostics
codeflex-playbooks doctor --fix     # Auto-fix issues where possible
codeflex-playbooks doctor --json    # Output as JSON for scripting
```

Checks include:
- Verify `.codeflex/` directory and lockfile validity
- Verify `.codeflex/skills/` contains expected skills
- Verify AGENTS.md managed section is up-to-date
- Check for orphaned or missing skills
- Verify harness projections
- Check global `~/.agents/AGENTS.md` if applicable
- Detect deprecated configurations

Exit code: 0 if no errors, 1 if errors found.

### `migrate`

Migrate your project between harness configurations or update to new conventions:

```bash
codeflex-playbooks migrate --check                          # Check if migration needed
codeflex-playbooks migrate --from claude-code --to kilo     # Migrate between harnesses
codeflex-playbooks migrate --apply                          # Apply migration (dry-run by default)
```

Migration scenarios:
- **Harness-to-harness**: Migrate from one coding agent to another (e.g., Claude Code → Kilo)
- **Convention updates**: Update to new bootstrap formats
- **Global adoption**: Add global `~/.agents/AGENTS.md` if missing

Safety features:
- Dry-run mode by default (shows what would change)
- `--apply` flag required to make changes
- Automatic backups before modification (`.migrate-backup` suffix)

### `clean`

Remove all projected skill directories and scoped rule files (e.g. `.claude/skills/`, `.cursor/rules/`, generated `codeflex-scoped-*.md` files) without touching `.codeflex/skills/`, the lockfile, or `AGENTS.md`. Use this to reset harness projections before regenerating them with `sync`.

```bash
codeflex-playbooks clean             # Prompts for confirmation before deleting
codeflex-playbooks clean --dry-run   # Show what would be removed without deleting
codeflex-playbooks clean --yes       # Skip the confirmation prompt
```

## Deprecation Warnings

The CLI tracks deprecated features and configurations, such as:
- Legacy harness bootstrap files (e.g., `.cursorrules` instead of `.cursor/rules/`)
- Deprecated directory structures (e.g., `.kilocode/` instead of `.kilo/`)
- Legacy state directories
- Legacy backend skills directory structure (`.codeflex/skills/backend/` containing caching, nosql, or postgres) — these skills have moved to `architecture/`

Deprecation checks run by default during `init` (suppress with `--suppress-deprecations`) and during `doctor`. They are **opt-in** for `check` via `--check-deprecations`, and `sync` does not check for deprecations at all.

## Troubleshooting

### Git Authentication Failures

The CLI clones the CodeFlex engineering-skills repository using **SSH by default**. If you see an authentication error such as `Permission denied (publickey)` or `Host key verification failed`, you need to configure SSH access to GitHub.

**Prerequisites for SSH:**
1. Generate an SSH key if you don't have one: `ssh-keygen -t ed25519 -C "your_email@example.com"`
2. Add your SSH key to the ssh-agent: `eval "$(ssh-agent -s)"` then `ssh-add ~/.ssh/id_ed25519`
3. Add your SSH public key to your GitHub account at https://github.com/settings/keys
4. Test the connection: `ssh -T git@github.com`

**Alternative: Use HTTPS instead**

If you prefer HTTPS or cannot use SSH, set the `CODEFLEX_SKILLS_GIT_URL` environment variable to use HTTPS:

```bash
export CODEFLEX_SKILLS_GIT_URL="https://github.com/CodeFlex-Consultants/engineering-skills.git"
codeflex-playbooks init
```

Note that GitHub no longer accepts account passwords for Git operations (since August 2021). For HTTPS, you must use one of these authentication methods:

**1. Personal Access Token (PAT)**
- Create a token at https://github.com/settings/tokens with `repo` scope
- Use the token as your password when prompted for credentials
- Cache it: `git config --global credential.helper osxkeychain`

**2. Git Credential Manager (recommended for ongoing use)**
```bash
git config --global credential.helper osxkeychain   # macOS
git config --global credential.helper manager        # Windows
git config --global credential.helper store          # Linux
# Then re-run codeflex-playbooks init and enter your PAT when prompted
```

The `CODEFLEX_SKILLS_GIT_URL` environment variable can also be set to point at a mirror or fork of the engineering-skills repository.

## Architecture

### Responsibilities

```
codeflex-playbooks is responsible for:
  - Project detection (deterministic, not LLM-based)
  - Standards-source discovery and configuration
  - Client/repository standards resolution
  - Rule precedence and override resolution
  - Skill and dependency resolution
  - Version compatibility checks
  - Integrity verification (trusted releases)
  - Installation into .codeflex/skills/
  - AGENTS.md managed-section normalisation (project + global)
  - Harness capability registry
  - Projection topology resolution
  - Harness adapters and projections
  - Deprecation tracking and migration guidance
  - Configuration diagnostics and auto-fix
  - Verification and diagnostics
```

### What this CLI does NOT contain

The CLI does not contain engineering standards themselves. Standards live in the `engineering-skills` central repository and are distributed as immutable, versioned releases.

### Standards Resolution Precedence

```
Legal/regulatory/contractual requirements
        +
CodeFlex rules marked non-overridable
        ↓
Client-mandated engineering standards
        ↓
Existing repository architecture/ADRs/conventions
        ↓
CodeFlex engineering baseline
        ↓
Approved exceptions (with expiry)
```

### Canonical Store vs Harness Projections

```
.codeflex/skills/              # Canonical resolved skills (source of truth)
~/.agents/AGENTS.md          # Global AGENTS.md (community convention, projected to harness-native paths)
~/.agents/skills/            # Global skills directory (community convention)
.agents/skills/              # Codex (native), OpenCode/Kilo/Copilot/JetBrains (compatibility)
.claude/skills/              # Claude Code (native)
.opencode/skills/            # OpenCode (native)
.kilo/skills/                # Kilo (native)
.github/instructions/        # GitHub Copilot (native)
.cursor/rules/               # Cursor (native)
.cursor/rules/codeflex-bootstrap.md  # Cursor bootstrap
.roo/rules/                  # ZooCode/Roo (native)
.cline/                      # Cline (native)
.clinerules/codeflex-bootstrap.md  # Cline bootstrap
.junie/                      # JetBrains Junie (native)
.aider.conf.yml              # Aider configuration (wired with `read: AGENTS.md`)
```

The CLI calculates the minimum compatible projection topology to avoid duplicate skill discovery and unnecessary repository noise. Each harness has a bootstrap file (e.g. `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/codeflex-bootstrap.mdc`) and native/compatibility skill paths as defined in the harness registry. Devin and Aider have no dedicated bootstrap-file convention: Devin reads `AGENTS.md` from the project root natively, and Aider only loads it once `.aider.conf.yml` lists it under `read:` (which the CLI wires automatically).

#### Supported Harnesses

| Harness            | Detection Method                                      | Bootstrap File                          |
| ------------------ | ----------------------------------------------------- | --------------------------------------- |
| Codex              | `AGENTS.md`, `.codex/` directory                      | `AGENTS.md`                             |
| OpenCode           | `AGENTS.md`, `~/.config/opencode/`                    | `AGENTS.md`                             |
| Kilo               | `~/.config/kilo/`, `.kilocode/`, VS Code extension    | `AGENTS.md`                             |
| Claude Code        | `~/.claude/`, app bundle, CLI                         | `CLAUDE.md`                             |
| GitHub Copilot     | VS Code extension, `.github/` directory                | `AGENTS.md`                             |
| Cursor             | `~/.cursor/`, app bundle                               | `.cursor/rules/codeflex-bootstrap.mdc`    |
| ZooCode            | VS Code extension, `~/.roo/`                          | `.roo/rules/codeflex-bootstrap.md`        |
| Devin              | App bundle, `~/.config/devin/`                        | `AGENTS.md` (read natively)             |
| Cline              | VS Code extension, `~/.cline/`                        | `.clinerules/codeflex-bootstrap.md`       |
| JetBrains Junie   | JetBrains plugin, `.junie/` directory                  | `.junie/AGENTS.md`                      |
| Aider              | `aider` CLI, `~/.aider.conf.yml`, `.aider.conf.yml`   | `AGENTS.md` (via `.aider.conf.yml` `read:`) |

**Note:** Cline's bootstrap file lives at `.clinerules/codeflex-bootstrap.md` (inside the `.clinerules/` directory) rather than at `.clinerules` itself. This avoids a file/directory collision with projected skills, since `.clinerules/` is also Cline's native skill projection target.

### AGENTS.md Management

The CLI owns and maintains only the `CodeFlex Engineering Standards` section of `AGENTS.md`, delimited by explicit markers. All other project-specific content is preserved.

## Development

All CLI development commands are run from the `cli/` directory:

```bash
cd cli
npm install
npm run build          # Compile TypeScript
npm run dev            # Run CLI via tsx
npm run typecheck      # Type-check without emitting
npm run lint           # Lint source and tests
npm test               # Run tests
npm run test:coverage  # Run tests with coverage
```

## Automated Releases

This repository uses GitVersion for automated versioning with a dev→main branching model.

### Branching Model

```
main ← stable releases (x.y.z)
 ↑
dev ← pre-releases (x.y.z-dev.N)
 ↑
feature/* ← feature branches
```

- **`main`** — Stable releases. Every merge triggers a release.
- **`dev`** — Pre-releases. Every commit triggers a dev release.
- **`feature/*`** — Feature branches. No automatic releases.

### Dev Releases (Pre-release)

When you merge to `dev`:

```
PR merged to dev
  → GitVersion computes version (e.g., 0.2.0-dev.1)
  → Workflow builds and publishes to npm with @dev tag
  → GitHub pre-release created (tag: v0.2.0-dev.1)
```

Install dev releases:
```bash
npm install @codeflex-consultants/codeflex-playbooks@dev
```

Dev versions are ephemeral — computed at CI time from git tags. The committed `package.json` on `dev` stays at the base version.

### Stable Releases

When you merge `dev` into `main`:

```
PR merged to main
  → GitVersion computes stable version (e.g., 0.2.0)
  → Workflow builds and publishes to npm with @latest tag
  → GitHub Release created (tag: v0.2.0)
  → package.json committed back with [skip ci]
```

Install stable releases:
```bash
npm install @codeflex-consultants/codeflex-playbooks@latest
```

### Version Bump Control

By default, merges to `main` trigger a **patch** bump (0.1.1 → 0.1.2). To control the version bump, add a `+semver:` marker to the merge commit message:

| Marker | Effect | Example |
|--------|--------|---------|
| _(none)_ | Patch bump | 0.1.1 → 0.1.2 |
| `+semver: minor` or `+semver: feature` | Minor bump | 0.1.1 → 0.2.0 |
| `+semver: breaking` or `+semver: major` | Major bump | 0.1.1 → 1.0.0 |
| `+semver: patch` or `+semver: fix` | Patch bump | 0.1.1 → 0.1.2 |

**Example merge commit:**
```bash
git checkout main
git merge --no-ff dev -m "Merge dev: add new detection features +semver: minor"
git push origin main
```

### Workflow Details

- **GitVersion** computes versions from git tags and commit history
- **GitHub App token** allows pushing to protected branches (for commit-back)
- **`[skip ci]`** prevents the version-bump commit from triggering another workflow
- **Concurrent runs** are blocked by workflow concurrency groups

### Configuration

Version configuration lives in `GitVersion.yml` at the repository root. Key settings:

- `workflow: GitHubFlow/v1` — GitVersion 6.x workflow format
- `main` branch — Patch increment, no pre-release label
- `dev` branch — Minor increment, `dev` pre-release label
- `feature/*` branches — Inherit increment, branch name as label

## Repository Structure

```
codeflex-playbooks/
├── cli/                        # CLI application
│   ├── src/
│   │   ├── bin.ts                  # CLI entry point (shebang, argv parsing)
│   │   ├── index.ts                # Package re-export (dist/index.js)
│   │   ├── lib.ts                  # Public library API surface
│   │   ├── cli/                    # Command definitions (init, sync, doctor, migrate, etc.)
│   │   ├── detection/              # Deterministic project technology detection
│   │   │   ├── detectors/              # Technology detectors (Vue, Svelte, Python, Go, Rust, etc.)
│   │   │   └── harness/                # Harness detectors (Cursor, Kilo, Claude, Aider, etc.)
│   │   ├── resolution/             # Standards resolution and precedence model
│   │   ├── skills/                 # Skill loading and installation
│   │   ├── projection/             # Harness adapters and projection topology
│   │   ├── agents-md/              # Bootstrap generators (project + global AGENTS.md)
│   │   ├── deprecation/            # Deprecation warnings and migration guidance
│   │   ├── config/                 # engineering.yaml and engineering.lock handling
│   │   ├── integrity/              # Trusted release verification
│   │   ├── utils/                  # Shared utilities (errors, fs, hash, output)
│   │   └── types/                  # Shared type definitions
│   ├── tests/
│   │   ├── cli/                    # CLI command tests
│   │   ├── unit/                   # Unit tests
│   │   ├── integration/            # Integration tests
│   │   └── fixtures/               # Fixture repositories for detection/resolution tests
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   └── eslint.config.js
```

## Related

- [`engineering-skills`](https://github.com/CodeFlex-Consultants/engineering-skills) — Central repository for CodeFlex's baseline engineering standards
