# Aggregates and Invariants

## What an aggregate is

An aggregate is a cluster of one or more entities and value objects,
treated as a single unit for the purpose of data changes. Exactly one
entity is the **aggregate root**. External code holds references only
to the root; it reaches child entities exclusively by navigating through
the root's methods. The aggregate boundary is a **consistency boundary**
— everything inside it must be valid after any operation, and it maps
to a single transaction.

Design small aggregates. Include only the data that must remain
consistent within one transaction. Aggregates with independent
lifecycles (e.g. `Order`, `Customer`, `Product`) should be separate
aggregates, referencing each other by identity (`CustomerId`), not by
direct object reference.

## Enforcing invariants at the root

```csharp
public sealed class Order : AggregateRoot<OrderId>
{
    private readonly List<OrderItem> _items = new();

    public CustomerId CustomerId { get; private set; } = null!;
    public OrderStatus Status { get; private set; }
    public Money TotalAmount { get; private set; } = Money.Zero;

    public IReadOnlyCollection<OrderItem> Items => _items.AsReadOnly();

    private Order() { } // EF Core materialization only

    public static Order Create(CustomerId customerId)
    {
        var order = new Order
        {
            Id = OrderId.New(),
            CustomerId = customerId,
            Status = OrderStatus.Pending,
        };

        order.RaiseDomainEvent(new OrderCreatedDomainEvent(order.Id, customerId));
        return order;
    }

    // The ONLY way to add an item — invariants enforced here, not by callers.
    public void AddItem(ProductId productId, Money unitPrice, int quantity)
    {
        EnsureCanModify();

        if (quantity <= 0)
            throw new DomainException("Quantity must be greater than zero.");

        var existing = _items.FirstOrDefault(i => i.ProductId == productId);
        if (existing is not null)
        {
            existing.IncreaseQuantity(quantity);
        }
        else
        {
            _items.Add(OrderItem.Create(productId, unitPrice, quantity));
        }

        RecalculateTotal();
    }

    public void Confirm()
    {
        if (Status != OrderStatus.Pending)
            throw new DomainException($"Cannot confirm order in {Status} status.");
        if (_items.Count == 0)
            throw new DomainException("Cannot confirm an empty order.");

        Status = OrderStatus.Confirmed;
        RaiseDomainEvent(new OrderConfirmedDomainEvent(Id, CustomerId, TotalAmount));
    }

    private void EnsureCanModify()
    {
        if (Status != OrderStatus.Pending)
            throw new DomainException($"Cannot modify order in {Status} status.");
    }

    private void RecalculateTotal() =>
        TotalAmount = _items.Aggregate(Money.Zero, (total, item) => total + item.SubTotal);
}
```

Key points:

- `Items` is exposed as `IReadOnlyCollection<OrderItem>` — callers cannot
  call `order.Items.Add(...)` to bypass invariant checks.
- Every state transition goes through an intent-revealing method
  (`AddItem`, `Confirm`), never a public setter.
- `OrderItem` (the child entity) should have an `internal` or
  aggregate-only constructor so it can only be created by `Order`.
- A parameterless private constructor is required for EF Core
  materialization; do not remove it when adding factory methods.

## Anti-pattern: bypassing the root

```csharp
// WRONG — mutates a child entity directly, bypassing Order's invariants
order.Items.Add(new OrderItem(productId, unitPrice, quantity));

// WRONG — anemic style setter that skips business rules entirely
order.Status = OrderStatus.Confirmed;
```

Both examples allow an aggregate to enter an invalid state (e.g. a
confirmed order with zero items, or an item added after confirmation)
because the invariant checks living in `AddItem`/`Confirm` are skipped.

## Repositories operate at the aggregate root only

```csharp
public interface IOrderRepository
{
    Task<Order?> GetByIdAsync(OrderId id, CancellationToken ct);
    Task AddAsync(Order order, CancellationToken ct);
}
```

- One repository per aggregate root (`IOrderRepository`, not
  `IOrderItemRepository`).
- `GetByIdAsync` returns the fully-loaded aggregate with all invariants
  intact — never an `IQueryable<OrderItem>` that lets callers query or
  mutate child entities independently of the root.
- Persist the whole aggregate in one `SaveChangesAsync` call so the
  transactional boundary matches the consistency boundary.

## Cross-aggregate work belongs in domain services

When a business operation needs to coordinate behaviour across
aggregates that do not belong to each other (e.g. calculating shipping
cost using both `Order` and `ShippingPolicy`), extract a domain service.
Domain services should be stateless and operate purely on domain types;
they must not become a dumping ground for logic that actually belongs
on a single aggregate.

```csharp
public sealed class ShippingCostCalculator
{
    public Money Calculate(Order order, ShippingPolicy policy) =>
        policy.CalculateFor(order.TotalAmount, order.Items.Count);
}
```

Before extracting a domain service, check whether the behaviour
actually belongs on one of the aggregates involved — most "shared"
logic can live on a single aggregate root instead.

