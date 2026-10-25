---
name: codeflex-documentation
version: 1.0.0
last_reviewed: 2026-09-22
description: >
  CodeFlex engineering standards for project documentation: README files,
  Architecture Decision Records (ADRs), runbooks, inline code comments,
  and public API documentation. Use when writing or reviewing README
  files, ADRs, operational runbooks, code comments, or checking that
  public API surfaces have adequate documentation.
---
# Documentation Standards

These rules are mandatory whenever this Skill applies. They express
CodeFlex's baseline expectations for keeping repositories understandable
to humans and coding agents alike, and for preventing documentation
from silently drifting away from the system it describes. Where a
configured client or repository standard explicitly supersedes one of
these rules, the resolved override takes precedence; rules marked
non-overridable must not be bypassed automatically.

## DOC-001 — ADRs required for significant architectural decisions

Record an Architecture Decision Record (ADR) whenever a change involves:
technology or framework selection, adoption or rejection of an
architectural pattern, a breaking change to a public contract, or any
decision that is costly to reverse or that future contributors are
likely to question. Use a consistent template capturing at minimum
**status**, **context**, **decision**, and **consequences**; the
Nygard template is CodeFlex's default for its low ceremony, with MADR
(structured decision drivers, considered options, pros/cons) permitted
where reviewers need to compare multiple options. Store ADRs as
sequentially numbered Markdown files under `docs/adr/` (or
`docs/decisions/`) in the same repository as the code they describe,
and update an ADR's status (`proposed` → `accepted` → `deprecated` /
`superseded`) rather than deleting or silently rewriting history.
See `references/adrs-and-decision-records.md`.

## DOC-002 — README minimum viable sections kept current

Every repository, service, and publishable library must have a README
containing, at minimum: **purpose** (what it is and why it exists),
**setup and run instructions** (prerequisites, local development,
configuration), **how to test** (test commands and any coverage
expectations), and **how to deploy** (or a link to the pipeline that
does). A README describing setup steps, commands, or behaviour that no
longer matches the repository is a defect equivalent to a failing
build; treat outdated README content as a bug to be fixed in the same
PR that caused the drift, not deferred. See
`references/readme-and-runbook-standards.md`.

## DOC-003 — Comments explain why, not what

Inline code comments exist to capture intent, non-obvious business
rules, workarounds, and rationale that cannot be expressed in code —
never to restate what the next line already says. Prefer
self-documenting code (clear names, small functions, explicit types)
over prose that narrates control flow. A comment that could be deleted
by renaming a variable or extracting a method should be. See
`references/adrs-and-decision-records.md` and
`references/api-doc-comments.md`.

## DOC-004 — Runbooks are version-controlled with the code

Operational procedures — deployment steps, rollback procedures,
incident response playbooks, on-call escalation paths — must be
written down and stored in the same repository as the code and
infrastructure they operate on, not in a wiki, chat history, or an
individual's memory. Runbooks must be reviewed through the same PR
process as code changes and updated whenever the underlying deployment
topology, rollback mechanism, or escalation path changes. See
`references/readme-and-runbook-standards.md`.

## DOC-005 — No documentation drift across a change boundary

Any PR that changes a command, configuration key, version constraint,
environment variable, endpoint, or behaviour referenced by a README,
runbook, ADR, or doc comment must update that documentation in the
**same PR**, not a follow-up. Reviewers must treat unresolved
documentation drift as a blocking review comment, consistent with
`common.code-review` (`REVIEW-001`–`REVIEW-004`). Prefer generating
reference material (API docs, CLI help, OpenAPI specs) from source
where tooling allows, since generated docs cannot drift independently
of the code.

## DOC-006 — Public API surfaces require doc comments

Every publicly exported type, method, property, and module in a NuGet
package, npm package, or other externally consumed surface must carry
XML doc comments (.NET) or JSDoc/TSDoc (TypeScript/JavaScript)
describing the contract — what it does, preconditions, postconditions,
exceptions, and side effects — not its implementation. Enable
`GenerateDocumentationFile` (.NET) or `declaration`/`declarationMap`
(TypeScript) so IntelliSense and generated reference documentation stay
attached to the shipped artifact. See `references/api-doc-comments.md`.

## Additional guidance

For ADR templates (Nygard vs. MADR), lifecycle, and storage
conventions, read:
`references/adrs-and-decision-records.md`

For README skeletons, anti-patterns, and runbook structure, read:
`references/readme-and-runbook-standards.md`

For .NET XML doc comments, TypeScript/TSDoc conventions, and
documentation generation tooling, read:
`references/api-doc-comments.md`

## Canonical numbers and sources of truth

- **ADR default template** — Nygard (status, context, decision,
  consequences); upgrade to MADR when decisions need structured option
  comparison (`DOC-001`).
- **README minimum sections** — purpose, setup/run, test, deploy
  (`DOC-002`).
- **Documentation drift** — fixed in the same PR as the underlying
  change, never deferred (`DOC-005`).
