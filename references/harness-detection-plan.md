# Harness Detection — Plan

## The task

`codeflex-playbooks` needs to know which coding-agent harnesses are relevant on a developer's machine so it can decide which harness projections to generate under `.codeflex`-adjacent directories (`.agents/skills/`, `.claude/skills/`, `.opencode/skills/`, `.kilo/skills/`, etc.) and which native adapters (Copilot instructions, Cursor rules) to maintain.

The architecture already defines *what* happens once the harness list is known — resolution, projection topology, stale-file cleanup (§15, §18, §33 of the architecture doc). This plan covers the missing piece: *how the CLI knows which harnesses to target in the first place*, and how that fits with the `agentHarnesses` config field the architecture already sketches out.

Scope is deliberately limited to the six harnesses the architecture's compatibility matrix names: **Codex, Claude Code, OpenCode, Kilo, GitHub Copilot, Cursor.** The same pattern extends to others later if the team decides to support them.

> **Update:** the registry has since been extended to also cover **Roo, Windsurf, Cline, and JetBrains (Junie)**, following the same detection-signal-registry pattern described below. These four are now implemented, not just theoretically extensible — see `cli/src/detection/harness/signal-registry.ts` for the current full list.

## Design decision: detection suggests, config decides (with auto-update)

The architecture is built around explicit, auditable, non-silent state (`engineering.lock`, `sync` never changing policy, `check` working offline). Harness detection follows the same rule with one important exception: **when `autoDetect: true`, the CLI will automatically update `agentHarnesses` on `sync` and `update` commands.**

- **`codeflex-playbooks detect`** — read-only. Reports what it found per harness, with a confidence level and the evidence behind it. Changes nothing.
- **`codeflex-playbooks init`** (no `.codeflex` yet) — runs detection and pre-fills `agentHarnesses` in the generated `engineering.yaml`, but that file is a normal reviewable artifact — a human confirms it (in the init commit/PR), not the CLI silently.
- **`autoDetect: true`** (already in the architecture's `engineering.yaml` example) — governs whether harness detection runs on `init`, `sync`, and `update`. When enabled, `sync` and `update` will re-run detection and automatically update `agentHarnesses` if the detected set has changed. All changes are logged transparently.
- **`autoDetect: false`** — disables automatic detection updates. `sync` and `update` will not modify `agentHarnesses`. Manual edits to `engineering.yaml` are required.
- **`codeflex-playbooks check`** — may compare live detection against the configured `agentHarnesses` and **warn** ("Cursor appears to be installed but isn't in `agentHarnesses`" / "OpenCode is configured but wasn't detected"), the same way it already checks other drift. It should not add or remove harnesses on its own.
- **Stale projection removal stays tied to the CLI-managed markers already specced**, not to live detection. If detection stops finding a tool, that's not proof it was uninstalled (config directories are notoriously sticky) — removal only happens when a harness is explicitly dropped from `agentHarnesses` (either manually or via auto-detection).

This keeps detection as a convenience that removes typing for the common case, while still providing automatic updates when `autoDetect: true` is set. All changes are logged so users can see what changed and when.

## Detection signal types, ranked by trust

| Signal | Applies to | Reliability | Notes |
|---|---|---|---|
| Binary resolves on `PATH` and responds to `--version` | Codex, Claude Code, OpenCode, Kilo (CLI) | High | Cheapest strong signal for CLI-first tools |
| Editor extension present in the extensions folder | Kilo (VS Code/JetBrains), Copilot | High | Don't shell out to `code --list-extensions` if avoidable — scanning `~/.vscode/extensions/` directly is faster and works even if `code` isn't on PATH |
| App bundle / OS install record | Cursor | High | macOS `/Applications/Cursor.app`, Windows uninstall registry key, Linux `.desktop`/AppImage — Cursor has no CLI presence to rely on |
| Home-directory config file exists | All six (`~/.codex/`, `~/.claude/`, `~/.config/opencode/`, `~/.kilocode/cli/`, `~/.cursor/`) | Medium | Proves the tool ran once, not that it's currently installed — use as a *secondary* signal only |
| Project already contains that harness's native files | All six | Low as an install signal, but useful as an "in-use" signal | A `.cursor/rules/` folder in the repo tells you the team already targets Cursor, independent of what's on this particular machine |

**Rule of thumb: require two agreeing signals before reporting "high confidence."** A lone stale config directory should surface as "possible," not "detected."

## Per-harness detection matrix

| Harness | Surface(s) | Strongest signal | Secondary signal | Confidence notes |
|---|---|---|---|---|
| **Codex** | CLI | `codex` on `PATH`, `codex --version` succeeds | `~/.codex/config.toml` exists | Installed via `npm i -g @openai/codex`, `brew install codex`, or similar — binary check is reliable |
| **Claude Code** | CLI | `claude` on `PATH` | `~/.claude/` exists (or `$CLAUDE_CONFIG_DIR` if set — check that env var first) | Straightforward; Windows path is `%USERPROFILE%\.claude` |
| **OpenCode** | CLI | `opencode` on `PATH` | `~/.config/opencode/opencode.json` or `.jsonc` exists (also check `$XDG_CONFIG_HOME/opencode/` and, on Windows, `%APPDATA%\opencode\`) | Config file search order is non-trivial (opencode checks several fallback locations) — treat any hit as sufficient, don't require the primary path specifically |
| **Kilo** | VS Code/JetBrains extension **or** standalone CLI | Extension: `kilocode.kilo-code` present under the VS Code (or VS Code-server, for remote/WSL) extensions folder. CLI: `kilo` on `PATH` (`@kilocode/cli`) | `~/.kilocode/cli/` exists (CLI), or the extension's `globalStorage/kilocode.kilo-code/` folder exists (editor) | Two independent surfaces — report which one(s) were found rather than collapsing to a single yes/no, since a repo may need `.kilo/skills/` either way but debugging "why didn't Kilo pick this up" needs the distinction |
| **GitHub Copilot** | VS Code/JetBrains extension | Extension `GitHub.copilot` and/or `GitHub.copilot-chat` present under the extensions folder | JetBrains: plugin present under the IDE's `plugins/` directory | No reliable standalone CLI signal worth checking for the Skills use case — this is an editor-extension detection problem, not a binary one |
| **Cursor** | Native editor (Electron, VS Code fork) | App bundle/registry entry for "Cursor" | `~/.cursor/` exists | Cursor's own Skill/rules support is still evolving fastest of the six — treat this detector's output format as something you'll need to revisit more often than the others |

> **Update:** four additional harnesses — **Roo, Windsurf, Cline, and JetBrains (Junie)** — were added post-plan using the same detection-signal-registry pattern (each with its own detector under `cli/src/detection/harness/detectors/` and bootstrap support in `cli/src/agents-md/bootstrap-registry.ts`). The table above reflects the original six only; treat `cli/src/detection/harness/signal-registry.ts` as the source of truth for the current full harness list.

## Where this lives in `codeflex-playbooks`

- A small **registry**, one entry per harness (JSON or YAML, not inline code), holding the check definitions from the table above — mirrors the harness compatibility registry the architecture already calls for in §33, so this can be the same file rather than a second source of truth.
- One **detector function per harness** that reads its registry entry and returns `{ harness, surfaces: [...], confidence, evidence }`. Detectors run independently and cheaply (file stats and a `--version` spawn) — no need for a shared "scan everything" pass beyond listing the extensions folder once and reusing it across the Kilo/Copilot checks.
- **All detection is local**, consistent with §30 of the architecture (no uploading anything to identify what's installed) — this is just file-system and subprocess checks.
- Extension IDs and CLI package names are the most likely thing to drift (Kilo's own extension ID has already appeared in more than one casing across its history). Keeping the registry as data — bundled with the CLI release, updatable independently of core logic — means a rename doesn't require touching detector code.

## Practical gotchas worth building tests for

- **Remote/WSL VS Code sessions** install extensions under `~/.vscode-server/extensions/` (or the equivalent `-insiders` path) rather than the local `~/.vscode/extensions/`. If `codeflex-playbooks` ever runs *inside* a WSL/remote shell, check the server-side path; if it runs on the Windows host, check the local one. Don't assume one or the other.
- **VS Code forks each keep their own extensions folder.** Cursor is itself a VS Code fork with its own extensions directory — worth deciding early whether "Copilot extension found under Cursor's folder" should count as anything (probably not, since Copilot isn't a supported combination there), so the Copilot detector should only look at genuine VS Code / VS Code Insiders / VSCodium paths.
- **A stale config directory is not an uninstall signal in either direction.** Don't downgrade confidence just because a directory that used to exist is now gone in a single run — only use it as one input among several.

## Explicitly out of scope for this plan

- **Project technology detection** (`.csproj`, `angular.json`, EF Core version ranges, etc.) — that's a separate, already-specified part of the architecture (§10–11) and shares nothing with harness detection beyond both feeding into `.codeflex/engineering.yaml`.
- **Harnesses outside the current compatibility matrix** (Aider, Continue, etc.) — the registry pattern above extends to them without any architectural change, but they're not needed for the initial six. **Update:** Roo, Windsurf, Cline, and JetBrains (Junie) have since been added using this same pattern (see `cli/src/detection/harness/signal-registry.ts`); Aider, Continue, and similar tools remain out of scope for now.

## Open questions to settle before building

1. ~~Should `agentHarnesses` ever be updated automatically (e.g. on `codeflex-playbooks update`), or does it always require a human to edit `engineering.yaml` and commit the change?~~ **RESOLVED**: Yes, when `autoDetect: true` is set in `engineering.yaml`, the CLI will automatically update `agentHarnesses` on `sync` and `update` commands. All changes are logged transparently.
