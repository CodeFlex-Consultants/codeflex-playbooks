# Design Patterns: Intentional Use

Guidance on applying design patterns to solve known, recurring problems
(`CRAFT-002`). Patterns are tools, not goals. The objective is clean,
maintainable code — not a pattern catalogue.

## The Rule of Three

Do not extract an abstraction until the same concept appears in at least
three concrete places. Premature abstraction creates indirection without
proven benefit.

### The three-strike threshold

| Occurrences | Action |
|-------------|--------|
| 1 | Write it concretely. No abstraction. |
| 2 | Tolerate the duplication. Watch for a third. |
| 3 | Extract the pattern. The repetition is real. |
| 4+ | The abstraction is validated. Refine it. |

**Bad — premature abstraction:**
```csharp
// First use case — extracted to a generic handler immediately
public interface IEntityHandler<T> where T : IEntity
{
    Task<Result<T>> HandleAsync(T entity);
}

public abstract class EntityHandlerBase<T> : IEntityHandler<T> where T : IEntity
{
    public abstract Task<Result<T>> HandleAsync(T entity);
    protected abstract bool Validate(T entity);
    protected abstract Task SaveAsync(T entity);
}
```

**Good — wait for repetition:**
```csharp
// First use case — simple, concrete
public sealed class CreateOrderHandler(
    IOrderRepository repository,
    IOrderValidator validator)
{
    public async Task<Result<OrderDto>> HandleAsync(CreateOrderCommand cmd, CancellationToken ct)
    {
        validator.ValidateOrThrow(cmd);
        var order = Order.Create(cmd.Items, cmd.CustomerId);
        await repository.AddAsync(order, ct);
        return Result.Success(order.ToDto());
    }
}

// Second use case — similar but different enough to keep separate
public sealed class CreateCustomerHandler(
    ICustomerRepository repository,
    ICustomerValidator validator)
{
    public async Task<Result<CustomerDto>> HandleAsync(CreateCustomerCommand cmd, CancellationToken ct)
    {
        validator.ValidateOrThrow(cmd);
        var customer = Customer.Create(cmd.Name, cmd.Email);
        await repository.AddAsync(customer, ct);
        return Result.Success(customer.ToDto());
    }
}

// Third use case — now the pattern is clear, extract
```

## Composition over Inheritance

Prefer composing objects from smaller, focused behaviours over building
deep inheritance hierarchies. Inheritance couples subclasses to
implementation details of their parents.

**Bad — deep inheritance:**
```csharp
public class Animal { public virtual void Move() { } }
public class Bird : Animal { public override void Move() { Fly(); } public void Fly() { } }
public class Penguin : Bird { public override void Move() { Walk(); } /* can't fly! */ }
```

**Good — composition with interfaces:**
```csharp
public interface IMovement { void Move(); }

public sealed class WalkingMovement : IMovement
{
    public void Move() => Console.WriteLine("Walking");
}

public sealed class FlyingMovement : IMovement
{
    public void Move() => Console.WriteLine("Flying");
}

public sealed class Bird(IMovement movement)
{
    public void Move() => movement.Move();
}

// Usage
var sparrow = new Bird(new FlyingMovement());
var penguin = new Bird(new WalkingMovement());
```

**TypeScript equivalent:**
```typescript
interface Movement { move(): void; }

class WalkingMovement implements Movement {
  move() { console.log('Walking'); }
}

class FlyingMovement implements Movement {
  move() { console.log('Flying'); }
}

class Bird {
  constructor(private movement: Movement) {}
  move() { this.movement.move(); }
}

const sparrow = new Bird(new FlyingMovement());
const penguin = new Bird(new WalkingMovement());
```

## Common Patterns and When to Use Them

### Strategy

**Use when:** You have multiple algorithms for a specific task and need
to switch between them at runtime.

```csharp
public interface IPricingStrategy
{
    decimal CalculatePrice(Order order);
}

public sealed class StandardPricingStrategy : IPricingStrategy
{
    public decimal CalculatePrice(Order order) => order.Subtotal;
}

public sealed class BulkDiscountPricingStrategy : IPricingStrategy
{
    public decimal CalculatePrice(Order order)
        => order.ItemCount >= 100 ? order.Subtotal * 0.9m : order.Subtotal;
}
```

### Factory

**Use when:** Object creation logic is complex, varies by type, or needs
to be centralised. Do not use a factory when `new` suffices.

```csharp
public static class NotificationFactory
{
    public static INotification Create(NotificationType type, string recipient, string body)
        => type switch
        {
            NotificationType.Email => new EmailNotification(recipient, body),
            NotificationType.Sms => new SmsNotification(recipient, body),
            NotificationType.Push => new PushNotification(recipient, body),
            _ => throw new ArgumentOutOfRangeException(nameof(type))
        };
}
```

### Observer / Event-Driven

**Use when:** Multiple components need to react to the same event without
tight coupling. Use domain events or a message bus.

```csharp
public sealed record OrderPlacedEvent(OrderId OrderId, CustomerId CustomerId, decimal Total);

public interface IDomainEventHandler<T>
{
    Task HandleAsync(T @event, CancellationToken ct);
}

public sealed class SendOrderConfirmationHandler(IEmailSender email)
    : IDomainEventHandler<OrderPlacedEvent>
{
    public async Task HandleAsync(OrderPlacedEvent @event, CancellationToken ct)
        => await email.SendConfirmationAsync(@event.OrderId, ct);
}

public sealed class UpdateInventoryHandler(IInventoryService inventory)
    : IDomainEventHandler<OrderPlacedEvent>
{
    public async Task HandleAsync(OrderPlacedEvent @event, CancellationToken ct)
        => await inventory.ReserveForOrderAsync(@event.OrderId, ct);
}
```

### Decorator

**Use when:** You need to add behaviour to an object dynamically without
altering its structure. Common for cross-cutting concerns.

```csharp
public sealed class LoggingRepositoryDecorator<T>(
    IRepository<T> inner,
    ILogger<LoggingRepositoryDecorator<T>> logger) : IRepository<T>
{
    public async Task<T?> GetByIdAsync(Id id, CancellationToken ct)
    {
        logger.LogDebug("Getting {Type} by {Id}", typeof(T).Name, id);
        var result = await inner.GetByIdAsync(id, ct);
        logger.LogDebug("Found: {Found}", result is not null);
        return result;
    }
}
```

### Builder

**Use when:** Constructing complex objects step by step, especially when
there are many optional parameters. Prefer records with `with` expressions
in C# or object spread in TypeScript when possible.

## Patterns to Avoid (Anti-Patterns)

### Speculative Generality

Adding abstractions "just in case" without current need.

```csharp
// Bad: Abstracting before there's a second implementation
public abstract class BaseService<T> where T : IEntity { ... }
public interface IRepository<T> where T : class, IEntity { ... }
// ... when there is only one entity type and one repository
```

### Golden Hammer

Using the same pattern or tool for every problem.

```csharp
// Bad: Everything is a microservice
// Even a simple CRUD app split into 12 services with inter-service communication
```

### Cargo Cult Pattern

Implementing a pattern because it is popular, without understanding the
problem it solves.

```csharp
// Bad: Adding a full mediator pattern for a 3-endpoint API
// The overhead exceeds the complexity it manages
```

## Decision Checklist

Before applying a pattern, answer:

1. **What problem does this pattern solve?** If you cannot name the
   specific problem, you do not need the pattern.
2. **Has the problem occurred three times?** If not, tolerate duplication.
3. **Is there a simpler solution?** A well-named function or a record
   type may suffice.
4. **Will the pattern make the code easier or harder to understand?**
   Patterns add indirection. The benefit must exceed the cost.
5. **Can I explain the pattern choice in one sentence?** If not, the
   pattern is not the right fit.
