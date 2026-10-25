---
name: codeflex-entity-framework-6
version: 1.0.0
last_reviewed: 2026-09-17
description: >
  CodeFlex engineering standards for Entity Framework 6.
  Use when working with EF6 legacy applications, including code-first,
  database-first, migrations, and migration strategies to EF Core.
---
# Entity Framework 6

These rules are mandatory whenever this Skill applies. They express
CodeFlex's baseline expectations for EF6 code. Where a configured client
or repository standard explicitly supersedes one of these rules, the
resolved override takes precedence; rules marked non-overridable must
not be bypassed automatically.

## EF6-001 — Plan migration to EF Core

EF6 is in maintenance mode. Plan migration to EF Core for new projects
and long-term maintenance. EF Core offers better performance, cross-platform
support, and active development. Use this skill for legacy EF6 applications
only.

## EF6-002 — Code-first with explicit migrations

Use code-first approach with explicit migrations. Enable migrations with
`Enable-Migrations` and maintain migration history. Use `Add-Migration`
for schema changes and `Update-Database` to apply. Never use automatic
migrations in production.

## EF6-003 — DbContext per request

Register `DbContext` with per-request lifetime (e.g., `InstancePerRequest`
in Autofac, `InRequestScope` in Ninject). Do not use static or singleton
DbContext instances. Dispose DbContext properly at end of request.

## EF6-004 — Eager loading with Include

Use `.Include()` for eager loading related entities. Avoid lazy loading
(`virtual` navigation properties) in production due to N+1 query problems.
Use `.AsNoTracking()` for read-only queries.

## EF6-005 — Transaction scope for multi-step operations

Wrap multi-step write operations in explicit transactions using
`TransactionScope` or `DbContext.Database.BeginTransaction()`. Ensure
atomicity for operations that span multiple `SaveChanges()` calls.

## EF6-006 — Connection resilience

Implement connection resilience with `IDbConnectionFactory` and
`IDbExecutionStrategy`. Use `SqlAzureExecutionStrategy` for Azure SQL or
custom retry strategy for transient faults. Configure retry count and
delay.

## EF6-007 — Query optimization

Use compiled queries for frequently executed queries. Avoid LINQ queries
that cannot be translated to SQL (client evaluation). Use `.AsNoTracking()`
for read-only scenarios. Profile queries with SQL Server Profiler or
EF logging.

## EF6-008 — Database-first with EDMX (legacy)

For database-first projects, maintain EDMX model carefully. Use model
update from database after schema changes. Keep EDMX in source control.
Prefer code-first for new development even on existing databases.

## Additional guidance

For EF6 vs EF Core differences and migration planning, read:
`references/ef6-vs-efcore.md`

For code-first patterns, conventions, and Fluent API, read:
`references/code-first-patterns.md`

For migration strategies, team workflows, and production deployments,
read: `references/migration-strategies.md`

## Canonical numbers and sources of truth

- **Migration path** — Plan migration to EF Core (`EF6-001`).
- **DbContext lifetime** — Per-request scope (`EF6-003`).
- **Loading strategy** — Eager loading with Include (`EF6-004`).
- **Transactions** — Explicit for multi-step operations (`EF6-005`).
- **Resilience** — Retry strategy for transient faults (`EF6-006`).
