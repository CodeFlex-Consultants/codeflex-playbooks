# API Doc Comments and Inline Documentation

## Public API documentation

Every publicly exported type, method, property, and module in a NuGet
package, npm package, or other externally consumed surface must carry
documentation describing **what** it does and **why** it exists — not
**how** it is implemented internally. This is the contract consumers
rely on; implementation details belong in comments inside the method
body, not in the public doc comment.

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

Enable XML documentation file generation so the comments travel with
the compiled artifact and drive IntelliSense for consumers:

```xml
<!-- .csproj -->
<PropertyGroup>
  <GenerateDocumentationFile>true</GenerateDocumentationFile>
  <NoWarn>$(NoWarn);CS1591</NoWarn> <!-- only suppress for internal-only assemblies -->
</PropertyGroup>
```

For NuGet packages, do not suppress CS1591 (missing XML comment)
warnings on public members — treat them as a documentation debt
signal.

### TypeScript / JSDoc / TSDoc

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

Enable declaration output so editors and downstream consumers get
IntelliSense from the shipped package, and generate reference docs
with TypeDoc (or similar) from the same JSDoc/TSDoc comments:

```json
// tsconfig.json
{
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true
  }
}
```

### What to document on every public member

1. **The contract, not the implementation.** What is guaranteed, not
   how it is achieved.
2. **Preconditions.** What must be true before calling.
3. **Postconditions.** What is guaranteed after the call.
4. **Exceptions.** What can go wrong and when.
5. **Side effects.** What external state changes (I/O, mutation of
   shared state, events raised).
6. **Currency.** Update the doc comment in the same PR that changes
   the member's behaviour — a stale doc comment is worse than none,
   because it actively misleads consumers and IntelliSense users.

## Inline comments: why, not what

Inline comments exist to capture intent and non-obvious rationale.
Self-documenting code — clear names, small functions, explicit types —
is preferred over prose that narrates what the next line already
shows.

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
// inside a loop — O(1) vs O(n) per check.
var allowedIds = items.Select(i => i.Id).ToHashSet();
```

### When to comment

- **Why, not what.** The code shows what; the comment explains why.
- **Non-obvious business rules.** "Orders over $10,000 require manual
  approval per compliance policy FIN-2024-037."
- **Workarounds.** "This timeout is 30s instead of the documented 10s
  because the vendor's API occasionally takes 25s under load."
- **Algorithm intent.** "Binary search because the input array is
  guaranteed sorted by timestamp."
- **TODOs with context and an owner.** "TODO(jsmith): Replace with
  batch API when vendor releases v3. Ticket: INT-1234."
- **Non-obvious decisions best captured locally rather than in a full
  ADR** — reserve ADRs (see `references/adrs-and-decision-records.md`)
  for decisions with cross-module or long-lived architectural impact.

### When NOT to comment

- A better name for the variable or method would make the comment
  unnecessary.
- The code is already self-explanatory.
- The comment merely restates the code in prose.
- The comment describes what the code *used to* do rather than what it
  does now — delete it; version control preserves history.

## Documentation as code

Treat documentation with the same rigor as source code:

- **Review it.** Documentation changes go through the same PR review
  as code (`common.code-review`).
- **Test it where possible.** Code samples in documentation should
  compile or run in CI to prevent silent drift.
- **Version it.** Documentation lives in the same repository as the
  code it describes.
- **Generate it where possible.** Prefer generating API reference docs
  from XML/JSDoc comments and OpenAPI specs over hand-maintained
  duplicates — generated docs cannot drift independently of the code
  that produces them.
