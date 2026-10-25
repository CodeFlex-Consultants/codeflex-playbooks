# SOLID Principles

Detailed guidance on applying all five SOLID principles as a coherent
set (`CRAFT-001`). SOLID is not a checklist of independent items — the
principles reinforce each other. Violating one often leads to violating
others.

## S — Single Responsibility Principle

A class or module should have one, and only one, reason to change.
"Reason to change" means a stakeholder or concern that drives modification.

### Identifying responsibilities

Ask: *who cares about this behaviour changing?* If multiple actors
(product owner, DBA, security team, ops) would request changes to the
same class for different reasons, it has too many responsibilities.

**Bad — .NET:**
```csharp
public class OrderService
{
    public async Task<OrderDto> PlaceOrderAsync(CreateOrderRequest request)
    {
        // Validation (business concern)
        if (request.Items.Count == 0)
            throw new ArgumentException("Order must have items");

        // Pricing (pricing team concern)
        var total = request.Items.Sum(i => i.Price * i.Quantity);
        var tax = total * 0.0825m;

        // Persistence (infrastructure concern)
        var order = new Order { Items = request.Items, Total = total + tax };
        await _dbContext.Orders.AddAsync(order);
        await _dbContext.SaveChangesAsync();

        // Email (communications concern)
        await _emailClient.SendAsync(order.CustomerEmail, "Order confirmed");

        return order.ToDto();
    }
}
```

**Good — separated responsibilities:**
```csharp
public sealed class PlaceOrderCommandHandler(
    IOrderValidator validator,
    IPricingEngine pricingEngine,
    IOrderRepository repository,
    INotificationService notifications) : ICommandHandler<PlaceOrderCommand, OrderDto>
{
    public async Task<OrderDto> HandleAsync(PlaceOrderCommand command, CancellationToken ct)
    {
        validator.ValidateOrThrow(command);
        var totals = pricingEngine.Calculate(command.Items);
        var order = Order.Create(command.Items, totals);
        await repository.AddAsync(order, ct);
        await notifications.OrderPlacedAsync(order, ct);
        return order.ToDto();
    }
}
```

**Bad — TypeScript:**
```typescript
class UserService {
  async createUser(data: CreateUserDto) {
    if (!data.email.includes('@')) throw new Error('Invalid email');
    const hash = await bcrypt.hash(data.password, 10);
    const user = await this.prisma.user.create({ data: { ...data, password: hash } });
    await this.ses.sendEmail(user.email, 'Welcome!', templateFor(user));
    return user;
  }
}
```

**Good — TypeScript:**
```typescript
class CreateUserHandler {
  constructor(
    private validator: CreateUserValidator,
    private repo: UserRepository,
    private notifier: NotificationService,
  ) {}

  async execute(command: CreateUserCommand): Promise<UserDto> {
    this.validator.validateOrThrow(command);
    const user = User.create(command);
    await this.repo.save(user);
    await this.notifier.welcome(user);
    return UserDto.from(user);
  }
}
```

### SRP heuristics

- The class description requires "and" → multiple responsibilities.
- Changes from different teams touch the same file frequently.
- The class has multiple `using`/`import` groups pointing to unrelated
  concerns (persistence, email, logging, pricing).

## O — Open/Closed Principle

Software entities should be open for extension but closed for
modification. Add new behaviour by introducing new types, not by editing
existing ones.

### Achieving O/C with polymorphism

**Bad — modification required for each new type:**
```csharp
public decimal CalculateDiscount(Order order)
{
    if (order.Customer.Type == "Gold") return 0.15m;
    if (order.Customer.Type == "Silver") return 0.10m;
    if (order.Customer.Type == "Bronze") return 0.05m;
    return 0m;
}
```

**Good — extension without modification:**
```csharp
public interface IDiscountStrategy
{
    decimal Calculate(Order order);
}

public sealed class GoldDiscountStrategy : IDiscountStrategy
{
    public decimal Calculate(Order order) => order.Subtotal * 0.15m;
}

public sealed class PricingEngine
{
    private readonly IReadOnlyDictionary<CustomerTier, IDiscountStrategy> _strategies;

    public PricingEngine(IEnumerable<IDiscountStrategy> strategies)
    {
        _strategies = strategies.ToDictionary(s => s.Tier);
    }

    public decimal CalculateDiscount(Order order)
        => _strategies.TryGetValue(order.Customer.Tier, out var strategy)
            ? strategy.Calculate(order)
            : 0m;
}
```

### O/C heuristics

- Adding a new `if`/`switch` branch for each new variant → violates O/C.
- A `switch` on a type code or enum that grows over time → extract Strategy.
- New feature requires editing a stable, tested class → the class is not closed.

## L — Liskov Substitution Principle

Subtypes must be substitutable for their base types without altering
correctness. If code depends on type `Base`, it must work correctly with
any `Derived`.

### LSP violations

**Bad — subtype changes behaviour unexpectedly:**
```csharp
public class Rectangle
{
    public virtual double Width { get; set; }
    public virtual double Height { get; set; }
    public double Area => Width * Height;
}

public class Square : Rectangle
{
    public override double Width
    {
        set { base.Width = value; base.Height = value; }
    }
    public override double Height
    {
        set { base.Width = value; base.Height = value; }
    }
}

// Caller code that works for Rectangle but breaks for Square:
void MakeWider(Rectangle r) { r.Width += 1; }
// Square: both Width and Height change — Area is wrong
```

**Good — model the relationship correctly:**
```csharp
public interface IShape
{
    double Area { get; }
}

public sealed class Rectangle(double width, double height) : IShape
{
    public double Width { get; } = width;
    public double Height { get; } = height;
    public double Area => Width * Height;
}

public sealed class Square(double side) : IShape
{
    public double Side { get; } = side;
    public double Area => Side * Side;
}
```

### LSP heuristics

- Override throws `NotSupportedException` → LSP violation.
- Subtype adds preconditions the base does not require → LSP violation.
- Subtype weakens postconditions the base guarantees → LSP violation.
- `if (obj is SpecificSubtype)` checks in client code → the hierarchy is broken.

## I — Interface Segregation Principle

Many client-specific interfaces beat one general-purpose interface.
Consumers should not depend on methods they do not use.

**Bad — fat interface:**
```csharp
public interface IWorker
{
    Task WorkAsync();
    Task EatAsync();
    Task SleepAsync();
}

public class Robot : IWorker
{
    public Task WorkAsync() => ...;
    public Task EatAsync() => throw new NotSupportedException();
    public Task SleepAsync() => throw new NotSupportedException();
}
```

**Good — segregated interfaces:**
```csharp
public interface IWorkable { Task WorkAsync(); }
public interface IFeedable { Task EatAsync(); }
public interface ISleepable { Task SleepAsync(); }

public class Human : IWorkable, IFeedable, ISleepable { ... }
public class Robot : IWorkable { ... }
```

### ISP heuristics

- Interface has methods that some implementations throw on → segregate.
- A consumer only uses 2 of 8 methods → the consumer depends on too much.
- Mocking a dependency requires stubbing many irrelevant methods → interface is fat.

## D — Dependency Inversion Principle

High-level modules must not depend on low-level modules. Both should
depend on abstractions. Abstractions should not depend on details;
details should depend on abstractions.

**Bad — high-level depends on low-level concretions:**
```csharp
public class OrderProcessor
{
    private readonly SqlOrderRepository _repository;
    private readonly SmtpEmailSender _emailSender;

    public OrderProcessor()
    {
        _repository = new SqlOrderRepository("connection string here");
        _emailSender = new SmtpEmailSender("smtp.host.com");
    }
}
```

**Good — both depend on abstractions:**
```csharp
public sealed class OrderProcessor(
    IOrderRepository repository,
    IEmailSender emailSender)
{
    public async Task ProcessAsync(Order order, CancellationToken ct)
    {
        await repository.SaveAsync(order, ct);
        await emailSender.SendConfirmationAsync(order, ct);
    }
}
```

### DIP heuristics

- A class `new`s up its dependencies → DIP violation.
- A class references a concrete database type, file system, or HTTP client
  directly → DIP violation.
- Testing a class requires a running database or external service → DIP violation.

## Applying SOLID together

The principles reinforce each other:

1. **SRP** identifies the boundaries → one reason to change per class.
2. **O/C** ensures those boundaries are extensible → add types, not branches.
3. **LSP** ensures substitutability across those boundaries → subtypes honour contracts.
4. **ISP** ensures interfaces at boundaries are minimal → consumers depend on what they use.
5. **DIP** ensures the direction of dependencies is correct → depend on abstractions.

When reviewing code, check all five together. Fixing SRP without DIP
leaves you with well-separated classes that still depend on concretions.
Fixing DIP without ISP gives you abstract dependencies that are too fat.
