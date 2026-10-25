# Documentation Standards

Guidance on API documentation, Architecture Decision Records (ADRs),
and inline documentation (`CRAFT-009`). Documentation is an engineering
deliverable, not an afterthought.

## Public API Documentation

Every public type, method, and property in a library or service API must
have documentation that describes **what** it does and **why** it exists —
not how it is implemented.

### .NET XML documentation

```csharp
/// <summary>
/// Calculates the total price for an order, including applicable
/// discounts based on customer tier and order volume.
/// </summary>
/// <param name="items">The order line items. Must not be empty.</param>
/// <param name="customer">The customer whose tier determines the discount rate.</param>
/// <returns>The calculated totals including subtotal, discount, tax, and grand total.</returns>
/// <exception cref="ArgumentException">Thrown when <paramref name="items"/> is empty.</exception>
/// <exception cref="ArgumentNullException">Thrown when <paramref name="customer"/> is null.</exception>
public OrderTotals CalculateTotals(IReadOnlyList<OrderItem> items, Customer customer)
{
    // ...
}
```

### TypeScript JSDoc

```typescript
/**
 * Calculates the total price for an order, including applicable
 * discounts based on customer tier and order volume.
 *
 * @param items - The order line items. Must not be empty.
 * @param customer - The customer whose tier determines the discount rate.
 * @returns The calculated totals including subtotal, discount, tax, and grand total.
 * @throws {Error} When items is empty or customer is null.
 */
function calculateTotals(items: readonly OrderItem[], customer: Customer): OrderTotals {
  // ...
}
```

### Documentation rules

1. **Document the contract, not the implementation.** The reader needs
   to know what the method guarantees, not how it achieves it.
2. **Document preconditions.** What must be true before calling.
3. **Document postconditions.** What is guaranteed after the call.
4. **Document exceptions.** What can go wrong and when.
5. **Document side effects.** What external state changes.
6. **Keep it current.** Update documentation when the code changes.
   Stale documentation is worse than no documentation.

## Inline Documentation

Inline comments explain **why**, not **what**. The code should be
self-documenting for *what* it does. Comments are for intent, context,
and non-obvious decisions.

```csharp
// Bad: restating the code
// Increment the counter by one
counter++;

// Good: explaining why
// Offset by 1 because the reporting API uses 1-based month indices
var monthIndex = date.Month + 1;

// Bad: commented-out code (delete it, git remembers)
// var oldCalculation = CalculateV1(items);
var calculation = CalculateV2(items);

// Good: explaining a non-obvious decision
// Using a HashSet instead of List here because Contains() is called
// inside a loop — O(1) vs O(n) per check. See CRAFT-007.
var allowedIds = items.Select(i => i.Id).ToHashSet();
```

### When to comment

- **Why, not what.** The code shows what; comments explain why.
- **Non-obvious business rules.** "Orders over $10,000 require manual
  approval per compliance policy FIN-2024-037."
- **Workarounds.** "This timeout is 30s instead of the documented 10s
  because the vendor's API occasionally takes 25s under load."
- **Algorithm intent.** "Binary search because the input array is
  guaranteed sorted by timestamp."
- **TODO with context.** "TODO(john): Replace with batch API when
  vendor releases v3 (expected Q2 2027). Ticket: INT-1234."

### When NOT to comment

- Naming the variable or method better would suffice.
- The code is self-explanatory.
- The comment restates the code.
- The comment describes what the code *used* to do.

## Architecture Decision Records (ADRs)

ADRs capture significant design choices so future developers understand
**why** the system is the way it is.

### When to write an ADR

Write an ADR when:
- Choosing between two or more meaningful approaches.
- The decision affects multiple modules or teams.
- The decision is hard to reverse.
- Future developers will ask "why did they do it this way?"

### ADR template

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

## Rationale
- **Relational fit:** Orders have strong relationships (order → items → products).
  Joins are natural in SQL, expensive in MongoDB.
- **Transactional consistency:** Order placement requires atomic multi-table
  updates. PostgreSQL transactions are mature; MongoDB multi-document transactions
  are newer and have performance caveats.
- **Full-text search:** PostgreSQL's `tsvector` with GIN indexes covers our
  search needs without a separate search service.
- **Reporting:** SQL aggregations are simpler and more performant for our
  reporting queries than MongoDB's aggregation pipeline.
- **Team familiarity:** The team has deeper PostgreSQL experience.

MongoDB was considered for its schema flexibility, but our order schema is
well-defined and stable. The flexibility benefit does not outweigh the
relational advantages.

## Consequences
- **Positive:** Simpler queries, strong consistency, familiar tooling.
- **Negative:** Schema migrations required for order structure changes
  (mitigated by EF Core migrations).
- **Risk:** If order schema becomes highly polymorphic, we may need to
  revisit. Mitigation: use JSONB columns for extensible fields.
```

### ADR lifecycle

1. **Proposed** — Draft under review.
2. **Accepted** — Decision made, implementation proceeds.
3. **Deprecated** — Superseded by a newer ADR. Reference the replacement.
4. **Superseded** — Replaced entirely. Link to the new ADR.

### ADR storage

Store ADRs in the repository:

```
docs/
  adr/
    0001-use-clean-architecture.md
    0002-choose-event-driven-messaging.md
    0042-use-postgresql-for-orders.md
    template.md
```

## README Standards

Every module, service, and library needs a README that answers:

1. **What is this?** One-paragraph purpose statement.
2. **How do I build it?** Prerequisites and build commands.
3. **How do I run it?** Local development setup.
4. **How do I test it?** Test commands and coverage expectations.
5. **How do I deploy it?** Deployment process and environment requirements.
6. **Who owns it?** Team contact and escalation path.

### README anti-patterns

- **Outdated setup instructions.** Worse than no README.
- **Assumes knowledge.** "Just run the thing" without specifying what
  "the thing" is.
- **No local development guide.** New developers cannot get started.

## Documentation as Code

Treat documentation with the same rigour as code:

- **Review it.** Documentation changes go through PR review.
- **Test it.** Code samples in documentation should compile.
- **Version it.** Documentation lives in the same repository as the code.
- **Automate it.** Generate API docs from code comments where possible.

### .NET documentation generation

```xml
<!-- .csproj: generate XML documentation -->
<PropertyGroup>
  <GenerateDocumentationFile>true</GenerateDocumentationFile>
</PropertyGroup>
```

### TypeScript documentation generation

```json
// tsconfig.json
{
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true
  }
}
```

Use TypeDoc or similar to generate HTML documentation from JSDoc comments.
