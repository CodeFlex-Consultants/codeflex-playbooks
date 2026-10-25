---
name: codeflex-domain-driven-design
version: 1.0.0
last_reviewed: 2026-09-22
description: >
  CodeFlex engineering standards for tactical and strategic Domain-Driven Design
  (DDD) patterns. Use when modeling domain logic, aggregates, entities, value
  objects, bounded contexts, domain events, or evaluating rich domain models
  versus anemic domain models. This skill covers domain modeling patterns
  distinct from general code craftsmanship — pair with `common.code-craftsmanship`
  for SOLID principles and design pattern usage.
---
# Domain-Driven Design

These rules are mandatory whenever this Skill applies. They express
CodeFlex's baseline expectations for tactical DDD patterns in .NET domain
layers. Where a configured client or repository standard explicitly
supersedes one of these rules, the resolved override takes precedence;
rules marked non-overridable must not be bypassed automatically.

## DDD-001 — Aggregates enforce their own invariants

An aggregate is a cluster of entities and value objects treated as a
single consistency boundary. All invariants within an aggregate must be
enforced by the aggregate root itself, never by external code. Child
entities must not be mutated directly from outside the aggregate —
mutation happens only through aggregate root methods (e.g.
`order.AddItem(...)`, not `order.Items.Add(...)`). Expose child
collections as `IReadOnlyCollection<T>`, never as mutable lists.
See `references/aggregates-and-invariants.md`.

## DDD-002 — Value objects for attribute-defined concepts

Model concepts that are defined entirely by their attributes — not by
identity — as value objects (e.g. `Money`, `Address`, `EmailAddress`).
Two value objects with identical attribute values are interchangeable.
Value objects must be immutable and implement structural equality; use
C# `record` or `readonly record struct` types to get this behaviour for
free. Validate invariants in a factory method or constructor so invalid
instances cannot exist. Never expose value objects with public setters.
See `references/value-objects-and-records.md`.

## DDD-003 — Avoid anemic domain models

Domain entities must encapsulate behaviour, not only carry data. Public
setters on every property with all business logic pushed into external
"service" classes is an anti-pattern (the anemic domain model). Business
rules, state transitions, and validation belong on the entity or
aggregate that owns the data. Use private setters and expose intent-
revealing methods (`Confirm()`, `Cancel(reason)`, `Ship(trackingNumber)`)
instead of generic property setters.
See `references/aggregates-and-invariants.md`.

## DDD-004 — Explicit bounded context boundaries

Bounded context boundaries must be explicit and enforced in code. Do not
share mutable domain models, entities, or aggregates across bounded
contexts. Each bounded context owns its own model of a concept; the same
real-world entity (e.g. "Customer") may be modeled differently in
different contexts. Cross-context communication happens through
integration events, published contracts, or well-defined APIs — never
through shared domain assemblies exposing mutable state.
See `references/bounded-contexts-and-domain-events.md`.

## DDD-005 — Domain events for cross-aggregate side effects

When a business process must trigger side effects that cross aggregate
boundaries, raise a domain event rather than calling directly into
another aggregate from within the same transaction. Aggregates
reference other aggregates by identity only (e.g. store a `CustomerId`,
not a `Customer` reference). Domain events represent facts that already
happened (`OrderConfirmedDomainEvent`), are immutable, and are dispatched
after the originating aggregate's changes are persisted. Use eventual
consistency across aggregates instead of expanding a single transaction
to cover multiple aggregates.
See `references/bounded-contexts-and-domain-events.md`.

## DDD-006 — Repositories operate at the aggregate root level

Define exactly one repository per aggregate root. Repositories load and
persist the aggregate as a whole, including all of its child entities
and value objects, in a single operation. Never create a repository for
a child entity — child entities are reachable only through their
aggregate root's repository. Repository methods return fully-loaded
aggregates with invariants intact, not `IQueryable<T>` that would let
callers bypass the aggregate boundary.
See `references/aggregates-and-invariants.md`.

## DDD-007 — Ubiquitous language in code

Domain types, method names, and event names must use the business's own
terminology (the ubiquitous language established with domain experts),
not generic technical or CRUD terminology. Prefer `order.Confirm()` over
`order.SetStatus(Status.Confirmed)` or `order.Update()`. Name value
objects, entities, domain events, and domain services after the concepts
they represent in the business, and keep that vocabulary consistent
across code, tests, and documentation within a bounded context.
See `references/bounded-contexts-and-domain-events.md`.

## Additional guidance

For aggregate design, invariant enforcement, and repository boundaries, read:
`references/aggregates-and-invariants.md`

For value object implementation using C# records and structural equality, read:
`references/value-objects-and-records.md`

For bounded context boundaries and domain event patterns, read:
`references/bounded-contexts-and-domain-events.md`

For SOLID principles, design pattern usage, and general code quality that
complements domain modeling, use the `common.code-craftsmanship` skill.
This skill covers domain-specific tactical patterns; craftsmanship rules
apply to all code including the domain layer.

