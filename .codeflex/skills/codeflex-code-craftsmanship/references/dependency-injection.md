# Dependency Injection Patterns

Guidance on constructor injection, service lifetimes, and composition
roots (`CRAFT-008`). DI is the primary mechanism for achieving loose
coupling (`CRAFT-003`) and testability.

## Injection Styles

### Constructor Injection (default)

Use constructor injection for **required** dependencies. The dependency
is guaranteed to be available for the object's entire lifetime.

```csharp
public sealed class OrderService(
    IOrderRepository repository,
    IEventPublisher events,
    ILogger<OrderService> logger)
{
    public async Task<OrderDto> PlaceOrderAsync(PlaceOrderCommand cmd, CancellationToken ct)
    {
        logger.LogInformation("Placing order for customer {CustomerId}", cmd.CustomerId);
        var order = Order.Create(cmd.Items, cmd.CustomerId);
        await repository.AddAsync(order, ct);
        await events.PublishAsync(new OrderPlacedEvent(order.Id), ct);
        return order.ToDto();
    }
}
```

**TypeScript equivalent:**
```typescript
export class OrderService {
  constructor(
    private repository: OrderRepository,
    private events: EventPublisher,
    private logger: Logger,
  ) {}

  async placeOrder(cmd: PlaceOrderCommand): Promise<OrderDto> {
    this.logger.info(`Placing order for customer ${cmd.customerId}`);
    const order = Order.create(cmd.items, cmd.customerId);
    await this.repository.save(order);
    await this.events.publish(new OrderPlacedEvent(order.id));
    return OrderDto.from(order);
  }
}
```

### Property / Method Injection (optional)

Use property or method injection for **optional** dependencies — cases
where a default exists but can be overridden.

```csharp
public sealed class ReportGenerator
{
    public IReportFormatter Formatter { get; set; } = new PdfReportFormatter();

    public byte[] Generate(ReportData data)
        => Formatter.Format(data);
}

// Usage: override the default
var generator = new ReportGenerator { Formatter = new CsvReportFormatter() };
```

### When to use each

| Style | Use for | Example |
|-------|---------|---------|
| Constructor | Required dependencies | Repository, event bus, logger |
| Property | Optional with sensible default | Formatter, strategy |
| Method | Per-call variation | Strategy passed to a method |

## Service Lifetimes

Understanding lifetimes is critical. A misconfigured lifetime causes
either stale state (singleton holding scoped data) or resource exhaustion
(transient creating too many connections).

### Transient

A new instance is created every time it is requested. Use for
lightweight, stateless services.

```csharp
services.AddTransient<IOrderValidator, OrderValidator>();
// Each injection point gets a new instance
```

### Scoped

One instance per scope (typically per HTTP request in web apps). Use
for services that hold per-request state or database connections.

```csharp
services.AddScoped<IOrderRepository, SqlOrderRepository>();
services.AddScoped<IUnitOfWork, UnitOfWork>();
// Same instance within a request, new instance per request
```

### Singleton

One instance for the application's lifetime. Use for thread-safe,
stateless services or cached data.

```csharp
services.AddSingleton<ICache, InMemoryCache>();
services.AddSingleton<IClock, SystemClock>();
// Same instance everywhere, forever
```

### Lifetime rules

1. **A singleton cannot depend on a scoped or transient service.** The
   singleton outlives the scope, capturing a disposed instance.

```csharp
// Bad: singleton depends on scoped DbContext
services.AddSingleton<IOrderService, OrderService>();
services.AddScoped<DbContext, AppDbContext>();

// OrderService (singleton) captures DbContext (scoped) — the DbContext
// is disposed at the end of the first request, but OrderService still
// holds a reference to it.
```

2. **A scoped service can depend on transient or scoped services.**
3. **A transient service can depend on anything.**

### Diagnosing lifetime issues

```csharp
// Symptom: ObjectDisposedException on second request
// Cause: Singleton captured a scoped service

// Symptom: Stale data across requests
// Cause: Singleton holds mutable state that should be scoped

// Symptom: High memory usage
// Cause: Transient services creating unmanaged resources
```

## Composition Root

The composition root is the single place where all dependencies are
wired. In a .NET application, this is `Program.cs`. In a Node.js app,
it is the entry point where the DI container is configured.

```csharp
// Program.cs — the composition root
var builder = WebApplication.CreateBuilder(args);

// Infrastructure
builder.Services.AddScoped<DbContext, AppDbContext>();
builder.Services.AddScoped<IOrderRepository, SqlOrderRepository>();
builder.Services.AddScoped<ICustomerRepository, SqlCustomerRepository>();

// Application
builder.Services.AddScoped<IOrderService, OrderService>();
builder.Services.AddScoped<ICustomerService, CustomerService>();

// Cross-cutting
builder.Services.AddSingleton<IClock, SystemClock>();
builder.Services.AddSingleton<ICache, DistributedCache>();
builder.Services.AddTransient(typeof(ILogger<>), typeof(Logger<>));

var app = builder.Build();
app.Run();
```

### Composition root rules

1. **Only the composition root knows about concrete types.** All other
   code depends on abstractions.
2. **Register by capability, not by class.** Group related services.
3. **Validate the container on startup.** Detect missing registrations
   before the first request.

```csharp
// Validate container at startup (development only)
if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    var validator = scope.ServiceProvider.GetRequiredService<IServiceScopeValidator>();
    validator.ValidateAll();
}
```

## Extension Methods for Registration

Group related registrations into extension methods for clarity and reuse.

```csharp
public static class OrderProcessingServiceExtensions
{
    public static IServiceCollection AddOrderProcessing(this IServiceCollection services)
    {
        services.AddScoped<IOrderRepository, SqlOrderRepository>();
        services.AddScoped<IOrderService, OrderService>();
        services.AddScoped<IOrderValidator, OrderValidator>();
        services.AddTransient<IOrderMapper, OrderMapper>();
        return services;
    }
}

// Usage in Program.cs
services.AddOrderProcessing();
services.AddCustomerManagement();
services.AddInfrastructure();
```

## Avoiding the Service Locator

The service locator pattern hides dependencies and makes code harder to
test and reason about.

```csharp
// Bad: service locator
public class OrderService
{
    private readonly IServiceProvider _provider;

    public OrderService(IServiceProvider provider)
    {
        _provider = provider;
    }

    public async Task ProcessAsync(Order order)
    {
        var repo = _provider.GetRequiredService<IOrderRepository>(); // Hidden dependency
        var events = _provider.GetRequiredService<IEventPublisher>(); // Hidden dependency
        // ...
    }
}

// Good: explicit constructor injection
public sealed class OrderService(IOrderRepository repo, IEventPublisher events)
{
    public async Task ProcessAsync(Order order)
    {
        // Dependencies are explicit and testable
    }
}
```

### Why service locator is harmful

- **Hidden dependencies** — cannot see what a class needs from its
  signature.
- **Harder to test** — must configure the container instead of passing
  mocks.
- **Runtime failures** — missing dependencies surface at runtime, not
  compile time.
- **Violates DIP** — depends on the container, not on abstractions.

## DI in TypeScript

TypeScript DI frameworks (InversifyJS, TSyringe, NestJS providers)
follow the same principles.

```typescript
// NestJS example
@Injectable()
export class OrderService {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly repository: OrderRepository,
    @Inject(EVENT_PUBLISHER)
    private readonly events: EventPublisher,
  ) {}

  async placeOrder(cmd: PlaceOrderCommand): Promise<OrderDto> {
    const order = Order.create(cmd.items, cmd.customerId);
    await this.repository.save(order);
    await this.events.publish(new OrderPlacedEvent(order.id));
    return OrderDto.from(order);
  }
}

// Module registration
@Module({
  providers: [
    OrderService,
    { provide: ORDER_REPOSITORY, useClass: SqlOrderRepository },
    { provide: EVENT_PUBLISHER, useClass: InMemoryEventPublisher },
  ],
})
export class OrderModule {}
```

### Lifetime equivalents in TypeScript

| .NET | NestJS | InversifyJS |
|------|--------|-------------|
| Transient | Default (per injection) | `toDynamicValue` |
| Scoped | `REQUEST` scope | `inRequestScope` |
| Singleton | `DEFAULT` | `inSingletonScope` |
