# Code Smells and Refactoring

Catalogue of common code smells and systematic refactoring techniques
(`CRAFT-005`). Code smells are surface indicators of deeper problems.
They do not mean the code is broken — they mean it is at risk of
becoming broken.

## Code Smell Catalogue

### Long Method

**Symptom:** A method exceeds 30 lines, or requires scrolling to read.

**Why it matters:** Long methods are hard to understand, test, and
modify. They often hide multiple responsibilities.

**Fix:** Extract well-named sub-methods. Each method should do one thing
at one level of abstraction.

```csharp
// Before
public async Task<OrderDto> PlaceOrderAsync(CreateOrderRequest request)
{
    // 50 lines of validation, pricing, persistence, notification...
}

// After
public async Task<OrderDto> PlaceOrderAsync(CreateOrderRequest request)
{
    var validated = ValidateRequest(request);
    var totals = CalculatePricing(validated.Items);
    var order = CreateOrder(validated, totals);
    await PersistOrderAsync(order);
    await SendConfirmationAsync(order);
    return order.ToDto();
}
```

### Large Class

**Symptom:** A class has many fields, methods, or lines. It is described
with "and" ("the class handles orders *and* email *and* logging").

**Why it matters:** Large classes change for multiple reasons, making
them fragile and hard to test.

**Fix:** Extract classes by responsibility. Apply SRP.

### Feature Envy

**Symptom:** A method uses another object's data more than its own.

```csharp
// Before: OrderService reaches into Customer's data
public class OrderService
{
    public decimal CalculateDiscount(Order order)
    {
        if (order.Customer.MembershipYears > 5 && order.Customer.TotalSpent > 10000)
            return 0.20m;
        // ...
    }
}

// After: move the logic to Customer
public class Customer
{
    public decimal DiscountRate
        => MembershipYears > 5 && TotalSpent > 10000 ? 0.20m : 0m;
}
```

### Data Clumps

**Symptom:** The same group of data items appears together in multiple
places — method parameters, class fields, constructor arguments.

```csharp
// Before: data clump appears in multiple method signatures
public void CreateOrder(string street, string city, string state, string zip, string country) { ... }
public void CreateInvoice(string street, string city, string state, string zip, string country) { ... }

// After: extract a value object
public readonly record struct Address(string Street, string City, string State, string Zip, string Country);

public void CreateOrder(Address shippingAddress) { ... }
public void CreateInvoice(Address billingAddress) { ... }
```

### Speculative Generality

**Symptom:** Abstractions exist "just in case" — interfaces with one
implementation, parameters never used, classes never instantiated.

**Fix:** Delete the unused abstraction. YAGNI. Add it back when the
second use case arrives.

### Shotgun Surgery

**Symptom:** A single change requires editing many classes in small ways.

```csharp
// Adding a new field to Order requires changes in:
// Order.cs, OrderDto.cs, OrderMapper.cs, CreateOrderHandler.cs,
// OrderRepository.cs, OrderValidator.cs, OrderController.cs
```

**Fix:** Consolidate related behaviour. If a concept scatters across
many files, it belongs together.

### Primitive Obsession

**Symptom:** Using strings, ints, or dicts for domain concepts that
deserve their own types.

```csharp
// Before
public void ProcessOrder(string orderId, string customerId, string status) { ... }

// After
public void ProcessOrder(OrderId orderId, CustomerId customerId, OrderStatus status) { ... }
```

### Inappropriate Intimacy

**Symptom:** Classes are overly familiar with each other's internals.
They access each other's private fields, call each other's private
methods via reflection, or share mutable state.

**Fix:** Reduce access, introduce interfaces, or merge the classes if
they are truly inseparable.

### Dead Code

**Symptom:** Code that is never executed — commented-out blocks,
unreachable branches, unused methods.

**Fix:** Delete it. Version control preserves the history. Dead code
is not "just in case" — it is noise.

## Refactoring Discipline

### The Boy Scout Rule

Leave the code cleaner than you found it. You do not need to refactor
the entire codebase — just improve the file you are editing.

- Add a missing test when you fix a bug.
- Extract a method when you struggle to name what a block does.
- Rename a variable when its name is misleading.
- Remove dead code when you encounter it.

### Refactor in Small Steps

Every refactoring should preserve behaviour. Make one small change,
run tests, commit. Never combine refactoring with feature work in the
same commit.

**The refactoring loop:**

1. **Identify the smell.** Name it.
2. **Ensure tests exist.** If not, add characterization tests first.
3. **Make a small change.** One step toward the target structure.
4. **Run tests.** Verify behaviour is preserved.
5. **Repeat** until the smell is resolved.
6. **Commit.** Separate commit for refactoring.

### Refactoring Safety Net

Refactoring without tests is reckless. Before refactoring untested code:

1. Write characterization tests that capture current behaviour.
2. Refactor against those tests.
3. Once the code is clean, replace characterization tests with proper
   unit tests that express intent.

### When NOT to Refactor

- **The code is about to be deleted.** Do not polish a tombstone.
- **You do not understand the code.** Write tests first, or seek the
   original author's input.
- **The change is not safe.** No tests, no safety net, no confidence.
- **The deadline is in 10 minutes.** Ship first, refactor after.

## Refactoring Techniques Reference

| Smell | Technique | Description |
|-------|-----------|-------------|
| Long Method | Extract Method | Pull a code block into a named method |
| Long Method | Replace Temp with Query | Replace local variable with a method call |
| Long Method | Introduce Parameter Object | Group parameters into a record |
| Large Class | Extract Class | Move related fields/methods to a new class |
| Feature Envy | Move Method | Move the method to the object it envies |
| Data Clumps | Extract Value Object | Group related primitives into a type |
| Shotgun Surgery | Inline Class / Move Method | Consolidate scattered behaviour |
| Primitive Obsession | Replace Primitive with Type | Create a strongly-typed wrapper |
| Speculative Generality | Collapse Hierarchy | Remove unused abstractions |
| Dead Code | Remove | Delete unused code |

## Anti-Patterns in Refactoring

### Big Bang Refactoring

Rewriting the entire module in one commit. This is unreviewable,
untestable, and high-risk. Break it into small, safe steps.

### Refactoring and Feature in One Commit

Mixing structural changes with behavioural changes makes it impossible
to review or revert either independently. Keep them separate.

### Refactoring Without Tests

Changing code structure without verifying behaviour is gambling. Always
have a safety net.

### Endless Refactoring

Refactoring is a means, not an end. Stop when the code is clean enough —
not when it is perfect. Perfect is the enemy of shipped.
