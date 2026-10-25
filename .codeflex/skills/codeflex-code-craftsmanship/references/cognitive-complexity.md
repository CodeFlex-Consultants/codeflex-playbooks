# Cognitive Complexity

Guidance on measuring and reducing cognitive complexity (`CRAFT-004`).
Cognitive complexity measures how hard code is for a *human* to understand.
It differs from cyclomatic complexity, which measures test paths.

## Cognitive vs Cyclomatic Complexity

| Aspect | Cyclomatic | Cognitive |
|--------|-----------|-----------|
| Measures | Number of test paths | How hard code is to read |
| Counts | Every branch equally | Penalises nesting and non-obvious flow |
| Ignores | Readability | Test coverage gaps |
| Target | < 10 per method | < 15 per method |

Cyclomatic complexity treats a flat `switch` with 10 branches the same
as 10 nested `if` statements. Cognitive complexity correctly recognises
that nesting makes code harder to understand.

## Scoring Rules

Cognitive complexity increments for:

| Construct | Increment |
|-----------|-----------|
| `if`, `else if`, `else` | +1 |
| `switch` | +1 |
| `for`, `foreach`, `while`, `do-while` | +1 |
| `catch` | +1 |
| `goto`, `continue` with label | +1 |
| Ternary `?:` | +1 |
| `&&`, `||`, `??` (logical operators) | +1 each |
| **Nesting increment** | +1 per nesting level for control flow |
| **Recursive calls** | +1 |

Logical operator sequences (`a && b && c`) count as +1 for the group,
not +1 per operator. Mixed operators (`a && b || c`) count as +1 per
operator change.

## Targets

| Level | Score | Action |
|-------|-------|--------|
| Ideal | < 15 | Maintainable, reviewable |
| Acceptable | 15–30 | Consider refactoring |
| Maximum | 30 | Must refactor before merge |
| Critical | > 30 | Blocking — cannot merge |

## Examples

### Low cognitive complexity (score: 3)

```csharp
public decimal CalculateDiscount(Customer customer)
{
    if (customer.Tier == CustomerTier.Gold) return 0.15m;
    if (customer.Tier == CustomerTier.Silver) return 0.10m;
    if (customer.Tier == CustomerTier.Bronze) return 0.05m;
    return 0m;
}
```

Three `if` statements, no nesting. Easy to scan.

### High cognitive complexity (score: 15+)

```csharp
public bool ValidateOrder(Order order)
{
    if (order != null)                                    // +1
    {
        if (order.Items.Any())                            // +2 (nesting)
        {
            foreach (var item in order.Items)             // +3 (nesting)
            {
                if (item.Quantity > 0)                    // +4 (nesting)
                {
                    if (item.Price > 0 &&                 // +5 (nesting) + 1 (&&)
                        item.Product != null)             // +1 (&&)
                    {
                        if (!item.Product.IsDiscontinued) // +6 (nesting)
                        {
                            continue;                     // valid
                        }
                    }
                }
            }
        }
    }
    return false;
}
```

### Refactored (score: 5)

```csharp
public bool ValidateOrder(Order order)
{
    if (order is null || !order.Items.Any()) return false;
    return order.Items.All(IsValidItem);
}

private static bool IsValidItem(OrderItem item)
    => item.Quantity > 0
    && item.Price > 0
    && item.Product is { IsDiscontinued: false };
```

## Reduction Strategies

### 1. Extract methods

Replace nested blocks with well-named method calls. Each method should
do one thing at one level of abstraction.

```csharp
// Before: nested logic
public void ProcessOrder(Order order)
{
    if (order.IsValid)
    {
        foreach (var item in order.Items)
        {
            if (item.IsInStock)
            {
                if (item.Price > _minThreshold)
                {
                    // ... complex logic
                }
            }
        }
    }
}

// After: extracted methods
public void ProcessOrder(Order order)
{
    if (!order.IsValid) return;
    foreach (var item in order.Items.Where(IsProcessable))
    {
        ProcessItem(item);
    }
}

private bool IsProcessable(OrderItem item)
    => item.IsInStock && item.Price > _minThreshold;
```

### 2. Early returns (guard clauses)

Replace nested `if` with early returns to flatten control flow.

```csharp
// Before: nested
public Result Process(Order order)
{
    if (order != null)
    {
        if (order.Items.Any())
        {
            if (order.Total > 0)
            {
                // actual work
            }
        }
    }
    return Result.Failure();
}

// After: guard clauses
public Result Process(Order order)
{
    if (order is null) return Result.Failure("Order is null");
    if (!order.Items.Any()) return Result.Failure("Order has no items");
    if (order.Total <= 0) return Result.Failure("Order total must be positive");

    // actual work
    return Result.Success();
}
```

### 3. Replace conditionals with polymorphism

When you have a `switch` or `if/else` chain on a type code, replace it
with polymorphic dispatch.

```csharp
// Before: conditional chain
public decimal CalculateFee(Transaction tx)
{
    if (tx.Type == "Transfer") return tx.Amount * 0.01m;
    if (tx.Type == "Withdrawal") return 2.50m;
    if (tx.Type == "Deposit") return 0m;
    throw new InvalidOperationException($"Unknown type: {tx.Type}");
}

// After: polymorphism
public interface IFeeCalculator { decimal Calculate(Transaction tx); }

public sealed class TransferFeeCalculator : IFeeCalculator
{
    public decimal Calculate(Transaction tx) => tx.Amount * 0.01m;
}

public sealed class WithdrawalFeeCalculator : IFeeCalculator
{
    public decimal Calculate(Transaction tx) => 2.50m;
}

public sealed class DepositFeeCalculator : IFeeCalculator
{
    public decimal Calculate(Transaction tx) => 0m;
}
```

### 4. Simplify boolean expressions

Extract complex boolean conditions into well-named methods or variables.

```csharp
// Before: hard to parse
if (user.IsActive && user.Age >= 18 && (user.Role == "Admin" || user.Role == "Moderator") && !user.IsBanned)

// After: self-documenting
var canAccessDashboard = user.IsActive
    && user.IsAdult
    && user.HasElevatedRole
    && !user.IsBanned;

if (canAccessDashboard) { ... }
```

### 5. Use LINQ / functional operations

Replace loops with conditionals with declarative operations.

```csharp
// Before: loop with nested conditionals
var activeHighValueCustomers = new List<Customer>();
foreach (var customer in customers)
{
    if (customer.IsActive)
    {
        if (customer.TotalSpent > 10000)
        {
            activeHighValueCustomers.Add(customer);
        }
    }
}

// After: declarative
var activeHighValueCustomers = customers
    .Where(c => c.IsActive && c.TotalSpent > 10000)
    .ToList();
```

## Tooling

### .NET

- **SonarQube / SonarLint**: Reports cognitive complexity per method.
- **NDepend**: Code Rules with CQLinq can enforce cognitive complexity limits.
- **ReSharper**: Shows cognitive complexity in the gutter.

### TypeScript / JavaScript

- **SonarQube / SonarJS**: Reports cognitive complexity.
- **ESLint plugin `eslint-plugin-complexity`**: Configurable thresholds.
- **CodeClimate**: Tracks cognitive complexity in PR reviews.

### CI enforcement

```yaml
# Example: SonarQube quality gate
quality_gates:
  cognitive_complexity_per_method: 15
  max_cognitive_complexity_per_method: 30
```
