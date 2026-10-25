# Choosing the Right Abstraction

Not all magic values should be replaced the same way. This guide helps
you choose between enums, constants, configuration, and strongly-typed
wrappers based on the nature of the value and its usage context.

## Decision Matrix

| Value Type | Abstraction | Example |
|------------|-------------|---------|
| Finite domain concept | Enum | `OrderStatus.Pending` |
| Environment-specific | Configuration | `IOptions<ApiSettings>` |
| Repeated literal | Constant | `CacheKeys.UserPrefix` |
| Entity identifier | Strongly-typed ID | `OrderId(Guid)` |
| Mathematical constant | Inline literal | `count * 2` |
| Protocol-level | Inline or framework constant | `StatusCodes.Status200OK` |

## Enums: When to Use

Use enums when:
- The value is one of a **finite, known set** at compile time
- The set represents a **domain concept** (status, type, category)
- You want **compile-time validation** of valid values
- The values are **mutually exclusive**

```csharp
// Good: Finite domain concept
public enum SubscriptionTier
{
    Free,
    Basic,
    Premium,
    Enterprise
}

// Good: Mutually exclusive states
public enum ConnectionState
{
    Disconnected,
    Connecting,
    Connected,
    Reconnecting
}
```

### Enum anti-patterns

Don't use enums when:
- The set is **open-ended** or user-extensible (use strings or interfaces)
- Values need **runtime discovery** (use a registry or database)
- You need **associated data** per value (use a class hierarchy or records)

```csharp
// Bad: Open-ended set (new payment providers added frequently)
public enum PaymentProvider
{
    Stripe,
    PayPal,
    Square,
    // ... constantly growing
}

// Good: Open-ended set
public interface IPaymentProvider
{
    string Id { get; }
    Task<PaymentResult> ProcessAsync(PaymentRequest request);
}
```

## Constants: When to Use

Use constants when:
- The value is a **literal** that appears in multiple places
- The value is **universal** (not environment-specific)
- The value is **known at compile time**
- You want to give a **meaningful name** to a magic number or string

```csharp
// Good: Repeated literal
public static class CacheKeys
{
    public const string UserPrefix = "user:";
    public const string SessionPrefix = "session:";
}

// Good: Magic number with context
public static class Limits
{
    public const int MaxRetryAttempts = 3;
    public const int MaxPageSize = 100;
}
```

### Constants anti-patterns

Don't use constants when:
- The value is **environment-specific** (use configuration)
- The value is a **domain concept** with finite options (use enum)
- The value is **self-documenting** (0, 1, -1 in obvious contexts)

```csharp
// Bad: Environment-specific value
public static class ApiConfig
{
    public const string BaseUrl = "https://api.example.com"; // Wrong environment!
}

// Good: Use configuration
public class ApiSettings
{
    public string BaseUrl { get; set; } = string.Empty;
}
```

## Configuration: When to Use

Use configuration (IOptions, environment variables) when:
- The value **varies by environment** (dev, staging, production)
- The value is **sensitive** (connection strings, API keys)
- The value might change **without redeployment** (feature flags)
- The value is **external** (third-party endpoints, rate limits)

```csharp
// Good: Environment-specific
public class DatabaseSettings
{
    public const string SectionName = "Database";
    public string ConnectionString { get; set; } = string.Empty;
    public int CommandTimeoutMs { get; set; } = 30000;
    public int MaxRetryCount { get; set; } = 3;
}

// Registration
services.Configure<DatabaseSettings>(
    configuration.GetSection(DatabaseSettings.SectionName));
```

### Configuration anti-patterns

Don't use configuration when:
- The value is **universal** across all environments (use constant)
- The value is a **domain concept** (use enum)
- The value is **known at compile time** and never changes

```csharp
// Bad: Universal value in configuration
public class MathSettings
{
    public double Pi { get; set; } = 3.14159; // Should be Math.PI
}

// Good: Universal value as constant or use framework
public static class MathConstants
{
    public const double GoldenRatio = 1.618033988749;
}
```

## Strongly-Typed IDs: When to Use

Use strongly-typed IDs when:
- You have **multiple entity types** with IDs
- You want to **prevent type confusion** (passing CustomerId where OrderId is expected)
- The ID is a **core domain concept** used throughout the codebase
- You want **compile-time safety** for ID operations

```csharp
// Good: Prevents ID type confusion
public readonly record struct OrderId(Guid Value)
{
    public static OrderId New() => new(Guid.CreateVersion7());
}

public readonly record struct CustomerId(Guid Value)
{
    public static CustomerId New() => new(Guid.CreateVersion7());
}

public class OrderService
{
    // Type-safe: cannot accidentally swap IDs
    public Order GetById(OrderId id) { ... }
    public Customer GetCustomer(CustomerId id) { ... }
}
```

### Strongly-typed ID anti-patterns

Don't use strongly-typed IDs when:
- The application is **small** with few entity types
- IDs are **only used internally** and never cross boundaries
- The overhead of **wrapper types** is not justified

```csharp
// Overkill for small apps
public readonly record struct UserId(Guid Value);
public readonly record struct ProductId(Guid Value);
public readonly record struct CategoryId(Guid Value);
// ... many more for a simple CRUD app

// Acceptable: Use primitives for simple cases
public class User
{
    public Guid Id { get; set; }
}
```

## Combining Abstractions

Often you'll combine multiple patterns:

```csharp
// Enum for domain concept
public enum OrderStatus
{
    Pending,
    Processing,
    Shipped,
    Delivered,
    Cancelled
}

// Strongly-typed ID
public readonly record struct OrderId(Guid Value);

// Configuration for environment-specific
public class OrderProcessingSettings
{
    public int MaxRetries { get; set; } = 3;
    public int TimeoutMs { get; set; } = 5000;
}

// Constants for repeated literals
public static class OrderCacheKeys
{
    public const string Prefix = "order:";
    public const string StatusSuffix = ":status";
}

// Usage
public class OrderService
{
    public OrderService(
        IOptions<OrderProcessingSettings> options,
        ICache cache)
    {
        var settings = options.Value;
        var cacheKey = OrderCacheKeys.Prefix + orderId.Value + OrderCacheKeys.StatusSuffix;
    }
}
```

## Migration Strategy

### Phase 1: Identify high-risk magic values

Start with:
- Conditionals checking string literals (`if (status == "Active")`)
- Numeric literals in business logic (`if (count > 100)`)
- Connection strings or URLs in code

### Phase 2: Extract to constants

Quick wins:
- Extract repeated literals to constants
- Group related constants into static classes
- Use IDE refactoring to update all call sites

### Phase 3: Introduce enums

For domain concepts:
- Identify finite sets of values
- Create enums with clear, descriptive names
- Update method signatures to use enums instead of strings

### Phase 4: Move to configuration

For environment-specific values:
- Identify values that vary by environment
- Create configuration classes
- Inject via IOptions or environment variables

### Phase 5: Add strongly-typed IDs

For critical entity types:
- Identify core domain entities
- Create ID wrapper types
- Update repository and service signatures

## Testing Considerations

When refactoring magic values:

1. **Preserve behavior**: Ensure tests still pass after extraction
2. **Test enum parsing**: If converting strings to enums, test invalid values
3. **Test configuration**: Verify configuration binding works correctly
4. **Test ID types**: Ensure ID wrapper types serialize/deserialize properly

```csharp
// Test enum parsing
[Fact]
public void ParseOrderStatus_ValidString_ReturnsEnum()
{
    var result = Enum.Parse<OrderStatus>("Pending");
    result.Should().Be(OrderStatus.Pending);
}

[Fact]
public void ParseOrderStatus_InvalidString_ThrowsException()
{
    var act = () => Enum.Parse<OrderStatus>("INVALID");
    act.Should().Throw<ArgumentException>();
}
```
