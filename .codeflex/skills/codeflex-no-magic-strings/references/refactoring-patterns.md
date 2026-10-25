# Refactoring Patterns for Magic Strings

This guide provides language-specific patterns for extracting magic
strings and numbers into named, maintainable abstractions.

## C# / .NET Patterns

### Static classes for constants

Group related constants into static classes. Follow .NET naming
conventions: `PascalCase` for constant field names.

```csharp
public static class CacheKeys
{
    public const string UserPrefix = "user:";
    public const string SessionPrefix = "session:";
    public const string ProductPrefix = "product:";
}

public static class Timeouts
{
    public const int HttpRequestMs = 5000;
    public const int DatabaseCommandMs = 30000;
}
```

### Enums for domain concepts

Use enums for finite sets of domain values. Follow the .NET Framework
Design Guidelines: `PascalCase` for both the enum type and its members
(no `ALL_UPPERCASE` or underscore-separated names).

```csharp
public enum OrderStatus
{
    Pending,
    Processing,
    Shipped,
    Delivered,
    Cancelled
}

public enum PaymentMethod
{
    CreditCard,
    PayPal,
    BankTransfer,
    Crypto
}
```

### Strongly-typed IDs

Use record structs for entity identifiers to prevent type confusion.

```csharp
public readonly record struct OrderId(Guid Value)
{
    public static OrderId New() => new(Guid.CreateVersion7());
}

public readonly record struct CustomerId(Guid Value)
{
    public static CustomerId New() => new(Guid.CreateVersion7());
}
```

### Configuration with IOptions

Inject configuration values rather than hardcoding them.

```csharp
public class ExternalApiSettings
{
    public const string SectionName = "ExternalApi";
    public string BaseUrl { get; set; } = string.Empty;
    public int TimeoutMs { get; set; } = 5000;
    public int MaxRetries { get; set; } = 3;
}

// Registration
services.Configure<ExternalApiSettings>(
    configuration.GetSection(ExternalApiSettings.SectionName));
```

## TypeScript / JavaScript Patterns

### Const objects for namespacing

Use frozen objects to group related constants.

```typescript
export const CacheKeys = {
    UserPrefix: "user:",
    SessionPrefix: "session:",
    ProductPrefix: "product:",
} as const;

export const Timeouts = {
    HttpRequestMs: 5000,
    DatabaseCommandMs: 30000,
} as const;
```

### Enums and union types

Use TypeScript enums or string literal unions for finite sets.

```typescript
// Enum approach
export enum OrderStatus {
    PENDING = "PENDING",
    PROCESSING = "PROCESSING",
    SHIPPED = "SHIPPED",
    DELIVERED = "DELIVERED",
    CANCELLED = "CANCELLED",
}

// Union type approach (preferred for string enums)
export type OrderStatus =
    | "PENDING"
    | "PROCESSING"
    | "SHIPPED"
    | "DELIVERED"
    | "CANCELLED";
```

### Branded types for IDs

Use branded types to prevent ID type confusion.

```typescript
type Brand<T, B> = T & { __brand: B };

type OrderId = Brand<string, "OrderId">;
type CustomerId = Brand<string, "CustomerId">;

function createOrderId(id: string): OrderId {
    return id as OrderId;
}

function processOrder(orderId: OrderId, customerId: CustomerId): void {
    // Type-safe: cannot accidentally swap IDs
}
```

### Environment configuration

Use environment variables and typed configuration objects.

```typescript
export interface AppConfig {
    apiUrl: string;
    timeoutMs: number;
    maxRetries: number;
}

export function loadConfig(): AppConfig {
    return {
        apiUrl: process.env.API_URL ?? "",
        timeoutMs: Number(process.env.TIMEOUT_MS ?? 5000),
        maxRetries: Number(process.env.MAX_RETRIES ?? 3),
    };
}
```

## Common Refactoring Steps

### 1. Identify magic values

Search for:
- String literals in conditionals (`if (status == "Active")`)
- Numeric literals in logic (`if (count > 100)`)
- Repeated literals across files
- URLs, connection strings, or endpoints in code

### 2. Choose the right abstraction

- **Finite domain concept** → Enum
- **Configuration value** → IOptions / environment variable
- **Repeated literal** → Constant in a static class
- **Entity identifier** → Strongly-typed ID wrapper

### 3. Extract and rename

- Move the literal to an appropriately named constant or enum member
- Use a name that describes the *meaning*, not the value
- Group related constants into logical containers

### 4. Update call sites

- Replace all occurrences of the magic value with the new constant
- Use IDE refactoring tools to ensure completeness
- Verify tests still pass

## Anti-patterns to Avoid

### Over-extraction

Don't extract values that are self-documenting:
```csharp
// Bad: This is worse than the literal
const int Zero = 0;
if (count == Zero) { ... }

// Good: Zero is universally understood
if (count == 0) { ... }
```

### Misplaced constants

Don't put constants in unrelated classes:
```csharp
// Bad: Why is this in UserService?
public class UserService
{
    public const int MaxOrderItems = 100;
}

// Good: Place in a domain-appropriate location
public static class OrderLimits
{
    public const int MaxItems = 100;
}
```

### Stringly-typed code

Don't use strings where enums or types would work:
```csharp
// Bad: Stringly-typed
public void ProcessPayment(string method) // "CreditCard", "PayPal"
{
    if (method == "CreditCard") { ... }
}

// Good: Strongly-typed
public void ProcessPayment(PaymentMethod method)
{
    if (method == PaymentMethod.CreditCard) { ... }
}
```
