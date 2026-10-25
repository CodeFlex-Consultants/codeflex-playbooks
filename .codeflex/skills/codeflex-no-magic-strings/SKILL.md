---
name: codeflex-no-magic-strings
version: 1.0.1
last_reviewed: 2026-09-21
description: >
  Eliminate magic strings and magic numbers from codebases by replacing
  them with named constants, enums, or strongly-typed alternatives.
  Use when writing, reviewing, or refactoring any code that contains
  hardcoded literal values whose meaning is not obvious at the call site.
---
# No Magic Strings or Numbers

These rules are mandatory whenever this Skill applies. Magic strings and
numbers obscure intent, resist refactoring, and invite typos. Named
constants, enums, and strongly-typed values make code self-documenting
and compiler-verifiable.

## MAGIC-001 — No hardcoded string literals in business logic

Never embed string literals directly in business logic, conditional
checks, or data transformations when the value represents a domain
concept, status, type, or configuration. Extract the value to a named
constant, enum member, or configuration key.

**Bad:**
```csharp
if (order.Status == "Pending") { ... }
var cacheKey = "user:" + userId;
```

**Good:**
```csharp
if (order.Status == OrderStatus.Pending) { ... }
var cacheKey = CacheKeys.UserPrefix + userId;
```

## MAGIC-002 — No hardcoded numeric literals without context

Never use numeric literals (other than 0, 1, or -1 where the meaning is
universally understood) without assigning them to a named constant.
Timeouts, limits, thresholds, and multipliers must be named.

**Bad:**
```csharp
await Task.Delay(5000);
if (retryCount > 3) { ... }
var tax = subtotal * 0.0825;
```

**Good:**
```csharp
await Task.Delay(TimeSpan.FromMilliseconds(Timeouts.HttpRequestMs));
if (retryCount > Limits.MaxRetryAttempts) { ... }
var tax = subtotal * TaxRates.StandardRate;
```

## MAGIC-003 — Use enums for finite, known sets of values

When a value can only be one of a fixed set of options, define an enum
rather than using strings. Enums provide compile-time safety,
autocomplete support, and make invalid states unrepresentable.

**Bad:**
```csharp
public string PaymentMethod { get; set; } // "CreditCard", "PayPal", "BankTransfer"
```

**Good:**
```csharp
public enum PaymentMethod
{
    CreditCard,
    PayPal,
    BankTransfer
}
```

## MAGIC-004 — Centralize configuration values

Environment-specific values (connection strings, API endpoints, feature
flags, rate limits) must come from configuration, not hardcoded literals.
Use the platform's configuration system (IOptions in .NET, environment
variables, config files) and inject them where needed.

**Bad:**
```csharp
var client = new HttpClient { BaseAddress = new Uri("https://api.example.com") };
```

**Good:**
```csharp
public class ExternalApiClient
{
    public ExternalApiClient(IOptions<ExternalApiSettings> options) { ... }
}
```

## MAGIC-005 — Use constants for repeated literal values

When the same literal value appears in multiple places, extract it to a
constant. This prevents drift and makes updates atomic. Group related
constants into static classes or records.

**Bad:**
```csharp
// In UserService.cs
const int maxUsers = 1000;

// In ReportService.cs
if (userCount > 1000) { ... }
```

**Good:**
```csharp
public static class SystemLimits
{
    public const int MaxUsersPerQuery = 1000;
}
```

## MAGIC-006 — Prefer strongly-typed IDs over strings

For entity identifiers, use strongly-typed ID wrappers or GUIDs rather
than raw strings. This prevents accidentally passing a customer ID where
an order ID is expected.

**Bad:**
```csharp
public void ProcessOrder(string orderId, string customerId) { ... }
```

**Good:**
```csharp
public readonly record struct OrderId(Guid Value);
public readonly record struct CustomerId(Guid Value);

public void ProcessOrder(OrderId orderId, CustomerId customerId) { ... }
```

## MAGIC-007 — Exception: Universal constants and test data

The following are acceptable without extraction:
- Mathematical constants (0, 1, -1, 2 for doubling)
- Test data and fixture values (clearly marked as test-only)
- Protocol-level constants where the literal is the specification
  (HTTP status codes in middleware, JSON property names in serialization)
- UI display strings that are localized via resource files

## Additional guidance

For language-specific patterns and refactoring techniques, read:
`references/refactoring-patterns.md`

For when to use enums vs constants vs configuration, read:
`references/choosing-the-right-abstraction.md`

## Canonical numbers and sources of truth

- **Zero-tolerance scope** — Business logic, conditionals, data
  transformations (MAGIC-001, MAGIC-002).
- **Enum threshold** — Any finite set with 2+ members that represents a
  domain concept (MAGIC-003).
- **Configuration boundary** — Environment-specific values, third-party
  endpoints, feature flags (MAGIC-004).
