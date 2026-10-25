# Architecture Decision Records (ADRs)

ADRs capture significant design choices so future contributors — human
or agent — understand **why** the system is the way it is, not just
what it currently looks like.

## When to write an ADR

Write an ADR when:
- Choosing between two or more meaningful technology or pattern options.
- Adopting or rejecting an architectural pattern (e.g. event-driven
  messaging, CQRS, a new persistence technology).
- The decision affects multiple modules, services, or teams.
- The decision introduces a breaking change to a public contract.
- The decision is expensive or slow to reverse.
- Future developers will plausibly ask "why did they do it this way?"

Do not write an ADR for routine implementation details, naming
choices, or anything easily reversed in a single PR.

## Choosing a template: Nygard vs. MADR

Two formats dominate current practice. Neither is universally
"better" — the right choice depends on how much comparison structure
the decision needs.

- **Nygard (default)** — five sections: Title, Status, Context,
  Decision, Consequences. Minimal ceremony, fast to write, easiest to
  adopt. Use this as CodeFlex's default template.
- **MADR (Markdown Architectural Decision Records)** — adds YAML
  front-matter (`status`, `date`, `decision-makers`, `consulted`,
  `informed`), explicit decision drivers, considered options with
  per-option pros/cons, and a decision outcome. Use MADR when the
  decision involves multiple non-obvious options that reviewers need
  to compare, or when tooling (dashboards, ADR linters, `log4brains`)
  needs to parse the record.

Both are acceptable; pick one per repository and stay consistent.
Mixing formats within the same `docs/adr/` directory makes tooling and
onboarding harder.

### Nygard template

```markdown
# ADR-0042: Use PostgreSQL instead of MongoDB for Order Storage

## Status
Accepted (2026-09-15)

## Context
The order management system requires:
- Complex queries across orders, items, and customers (joins)
- Transactional consistency for order placement
- Full-text search on order notes
- Reporting with aggregations across large datasets

We evaluated PostgreSQL 18 and MongoDB 8.

## Decision
Use PostgreSQL 18 as the primary store for order data.

## Consequences
- **Positive:** Simpler queries, strong consistency, familiar tooling.
- **Negative:** Schema migrations required for order structure changes
  (mitigated by EF Core migrations).
- **Risk:** If order schema becomes highly polymorphic, revisit. 
  Mitigation: use JSONB columns for extensible fields.

## Alternatives Considered
- **MongoDB:** Rejected — schema flexibility not needed; relational
  joins and multi-document transaction maturity favor PostgreSQL.
- **DynamoDB:** Rejected — reporting/aggregation queries are a poor fit
  for a key-value/document access pattern.
```

Two extensions are commonly and usefully added to the base Nygard
format: **Alternatives Considered** (what was rejected and why) and
**Stakeholders / Deciders** (who made the call, who was consulted).
Avoid scope creep beyond these — an ADR is not an implementation plan
or a success-metrics document.

### MADR template (structured variant)

```markdown
---
status: "accepted"
date: 2026-09-15
decision-makers: ["@alice", "@bob"]
consulted: ["@security-lead"]
informed: ["#eng-platform"]
---

# Use PostgreSQL over MongoDB for Order Storage

## Context and Problem Statement
Transactional workloads, strict consistency, and full-text search
requirements for the order subsystem.

## Decision Drivers
- Team operational experience
- Transactional consistency requirement
- Reporting/aggregation performance

## Considered Options
- PostgreSQL 18
- MongoDB 8
- DynamoDB

## Decision Outcome
Chosen option: PostgreSQL 18, because it scores highest across all
decision drivers above.

### Consequences
- Good, because relational joins and strong schemas fit the domain.
- Bad, because polymorphic order shapes require JSONB workarounds.
```

## ADR lifecycle

1. **Proposed** — draft under review (optional stage; many teams skip
   straight to Accepted for small teams).
2. **Accepted** — decision made, implementation proceeds.
3. **Deprecated** — no longer recommended but not yet replaced.
4. **Superseded by ADR-NNNN** — replaced entirely; link both ways
   (`Superseded by` on the old record, `Supersedes` on the new one) so
   `git log` and readers can follow the chain.

Never delete or silently rewrite an accepted ADR to reflect a changed
decision — supersede it instead. The historical record of *why* a
decision changed is as valuable as the original rationale.

## Storage convention

Store ADRs in the repository, one file per decision, numbered
sequentially:

```
docs/
  adr/
    0001-use-clean-architecture.md
    0002-choose-event-driven-messaging.md
    0042-use-postgresql-for-orders.md
    template.md
```

`docs/decisions/` is an equally common convention; pick one per
repository and be consistent. Tools such as `adr-tools`, `adrs`
(Rust CLI), and `log4brains` can scaffold and index ADRs automatically
but are optional — a plain numbered directory works just as well for
most teams.

## Doc comments vs. ADRs

Doc comments (see `references/api-doc-comments.md`) document the
contract of a single API member. ADRs document a decision that shaped
the system's structure. A doc comment says what a method guarantees;
an ADR says why the system uses that pattern at all. Use inline "why"
comments (`DOC-003`) for small, local rationale that doesn't warrant a
whole ADR — reserve ADRs for decisions with cross-module or
long-lived impact.
