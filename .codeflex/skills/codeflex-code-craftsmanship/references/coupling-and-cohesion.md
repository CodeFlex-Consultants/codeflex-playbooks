# Coupling and Cohesion

Guidance on measuring and improving coupling between modules and cohesion
within modules (`CRAFT-003`). These are the two most important structural
properties of a codebase. Low coupling and high cohesion make systems
testable, deployable, and evolvable.

## Definitions

**Coupling** measures how much one module depends on other modules.
- **Afferent Coupling (Ca):** Number of external modules that depend on
  this module. High Ca means the module is heavily used (a "hub").
- **Efferent Coupling (Ce):** Number of external modules this module
  depends on. High Ce means the module reaches out to many others (a
  "fan-out" risk).

**Cohesion** measures how related the responsibilities within a module
are. High cohesion means all classes in a module work together toward a
single purpose.

**Instability** = Ce / (Ca + Ce). A value near 0 means stable (hard to
change); near 1 means unstable (easy to change but fragile).

## Targets

| Metric | Target | Action threshold |
|--------|--------|------------------|
| Efferent Coupling (Ce) | < 8 | > 12 indicates a god module |
| Afferent Coupling (Ca) | Context-dependent | Ca=0 with Ce>5 is a "useless" module |
| Instability | 0.3–0.7 | > 0.8 is too fragile; < 0.2 is too rigid |
| Cohesion | > 0.6 | < 0.4 indicates a module should be split |

## Reducing Coupling

### 1. Dependency Inversion

Depend on abstractions (interfaces) rather than concretions. The module
should not know *which* implementation it uses, only *what contract* it
expects.

**Bad — coupled to a concrete type:**
```csharp
public class OrderProcessor
{
    private readonly SqlOrderRepository _repository;

    public OrderProcessor()
    {
        _repository = new SqlOrderRepository(_configuration.GetConnectionString("Orders"));
    }
}
```

**Good — depends on abstraction:**
```csharp
public sealed class OrderProcessor(IOrderRepository repository)
{
    public async Task ProcessAsync(Order order, CancellationToken ct)
    {
        await repository.SaveAsync(order, ct);
    }
}
```

### 2. Event-Driven Decoupling

Replace direct calls with domain events. The publisher does not know who
subscribes.

```csharp
// Bad: Direct coupling between order and inventory
public class OrderService(IInventoryService inventory)
{
    public async Task PlaceOrderAsync(Order order, CancellationToken ct)
    {
        await _repository.SaveAsync(order, ct);
        await inventory.ReserveAsync(order.Items, ct); // Direct dependency
        await _emailSender.SendConfirmationAsync(order, ct); // Direct dependency
    }
}

// Good: Publish events, let subscribers react
public class OrderService(IMessageBus bus)
{
    public async Task PlaceOrderAsync(Order order, CancellationToken ct)
    {
        await _repository.SaveAsync(order, ct);
        await bus.PublishAsync(new OrderPlacedEvent(order.Id, order.Items), ct);
    }
}
// InventoryReservationHandler and ConfirmationEmailHandler subscribe independently
```

### 3. Anti-Corruption Layers

When integrating with external systems, isolate their model from your
domain model with an anti-corruption layer (ACL).

```csharp
public interface IExternalPaymentGateway
{
    Task<PaymentResult> ChargeAsync(PaymentRequest request, CancellationToken ct);
}

public sealed class PaymentGatewayAdapter(IExternalPaymentGateway gateway) : IPaymentProcessor
{
    public async Task<Result<PaymentReceipt>> ProcessAsync(PaymentCommand cmd, CancellationToken ct)
    {
        var externalRequest = PaymentMapper.ToExternal(cmd);
        var externalResult = await gateway.ChargeAsync(externalRequest, ct);
        return PaymentMapper.ToDomain(externalResult);
    }
}
```

### 4. Avoid Circular Dependencies

Circular dependencies between modules make independent deployment and
testing impossible. If module A depends on B and B depends on A, they
are one module — merge them or extract a shared abstraction.

```
Bad:  OrderModule → CustomerModule → OrderModule (cycle!)

Fix:  Extract ICustomerLookup interface into a shared kernel.
      OrderModule depends on ICustomerLookup.
      CustomerModule implements ICustomerLookup.
```

## Increasing Cohesion

### 1. Group by domain concept, not technical layer

**Bad — technical grouping (low cohesion):**
```
Services/
  UserService.cs       — CRUD + business rules + email + logging
  OrderService.cs      — CRUD + pricing + inventory + email + logging
```

**Good — domain grouping (high cohesion):**
```
Features/
  UserManagement/
    CreateUserHandler.cs
    UpdateUserHandler.cs
    UserValidator.cs
  OrderProcessing/
    PlaceOrderHandler.cs
    PricingEngine.cs
    InventoryReservationHandler.cs
```

### 2. Single-concept modules

Every class in a module should contribute to the module's single purpose.
If a module contains both validation logic and persistence logic, it has
low cohesion.

### 3. The Common Closure Principle

Classes that change together should be packaged together. If two classes
are always modified for the same reason, they belong in the same module.

### 4. The Common Reuse Principle

Classes that are used together should be in the same module. If every
consumer of class A also uses class B, they belong together.

## Measuring in Practice

### .NET with NDepend or SonarQube

```
// SonarQube reports:
// - Coupling between objects (CBO) per class
// - afferent/efferent coupling per namespace
// - Lack of Cohesion in Methods (LCOM) per class
```

### TypeScript with madge or dependency-cruiser

```bash
# Generate dependency graph
npx madge --image deps.svg src/

# Find circular dependencies
npx madge --circular src/

# Detailed analysis
npx dependency-cruiser --validate --output-type err src/
```

### Manual heuristics

- **The "describe" test:** Can you describe the module's purpose in one
  sentence without using "and"? If not, it has low cohesion.
- **The "import" test:** Does a consumer need to import many things from
  this module to do one task? Low cohesion.
- **The "change" test:** Do changes regularly touch unrelated parts of
  the module? Low cohesion.

## Refactoring Patterns

### Extract Module

When a class has multiple unrelated responsibilities:

```csharp
// Before: one class, multiple concerns
public class OrderService
{
    public void Validate(Order order) { ... }
    public void CalculatePricing(Order order) { ... }
    public void Persist(Order order) { ... }
    public void SendNotification(Order order) { ... }
}

// After: cohesive modules
public sealed class OrderValidator { public void ValidateOrThrow(Order order) { ... } }
public sealed class PricingEngine { public OrderTotals Calculate(IReadOnlyList<OrderItem> items) { ... } }
public sealed class OrderRepository(IUnitOfWork uow) { ... }
public sealed class OrderNotificationService(IEmailSender email) { ... }
```

### Introduce Interface at Boundary

When two modules are coupled through concrete types:

```csharp
// Before: OrderModule directly uses CustomerModule's concrete class
public class OrderProcessor(CustomerService customerService) { ... }

// After: depend on abstraction
public interface ICustomerLookup
{
    Task<Customer?> FindByIdAsync(CustomerId id, CancellationToken ct);
}

public class OrderProcessor(ICustomerLookup customers) { ... }
```

### Break Circular Dependency

```csharp
// Before: A → B → A
// After: extract shared interface into a kernel module
// Kernel: ISharedContract
// A depends on Kernel
// B depends on Kernel and implements ISharedContract
// A no longer depends on B directly
```
