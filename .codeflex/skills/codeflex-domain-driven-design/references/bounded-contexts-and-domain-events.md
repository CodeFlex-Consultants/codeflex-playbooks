# Bounded Contexts and Domain Events

## Bounded contexts are explicit boundaries

A bounded context is a boundary within which a particular domain model
is defined and applicable. The same real-world concept (e.g.
"Customer") can and should be modeled differently in different bounded
contexts — the `Billing` context's `Customer` cares about payment
terms; the `Support` context's `Customer` cares about ticket history.
Do not force a single shared "Customer" entity across contexts.

Rules:

- Each bounded context owns its own domain model, in its own project or
  namespace boundary. Do not reference another context's domain entities
  or aggregates directly.
- Cross-context communication happens through published integration
  events, public APIs, or explicitly shared read models — never by
  sharing a mutable domain assembly.
- As a general sizing principle: a microservice (or logically separate
  module) should be no smaller than an aggregate and no larger than a
  bounded context.

```csharp
// WRONG — Shipping context directly references and mutates Billing's aggregate
public void CompleteDelivery(Billing.Invoice invoice)
{
    invoice.MarkPaid(); // Shipping has no business modifying Billing's model
}

// RIGHT — Shipping raises a domain event; Billing reacts independently
public sealed record DeliveryCompletedDomainEvent(DeliveryId DeliveryId, OrderId OrderId) : IDomainEvent;
```

## Domain events for cross-aggregate and cross-context side effects

A domain event is a record of something meaningful that already
happened in the domain — not a command. Aggregates raise domain events
after changing their own state; other aggregates or bounded contexts
react to the event asynchronously instead of being called directly
within the same transaction.

```csharp
public sealed record OrderConfirmedDomainEvent(
    OrderId OrderId,
    CustomerId CustomerId,
    Money TotalAmount) : IDomainEvent;

public sealed class Order : AggregateRoot<OrderId>
{
    public void Confirm()
    {
        if (Status != OrderStatus.Pending)
            throw new DomainException($"Cannot confirm order in {Status} status.");

        Status = OrderStatus.Confirmed;

        // Records a fact; does NOT call into Inventory or Billing directly.
        RaiseDomainEvent(new OrderConfirmedDomainEvent(Id, CustomerId, TotalAmount));
    }
}
```

Dispatch collected domain events after the originating aggregate's
changes are successfully persisted (e.g. in `SaveChangesAsync`, or via
an interceptor), so a handler failure cannot roll back the aggregate's
own valid state change:

```csharp
public override async Task<int> SaveChangesAsync(CancellationToken ct = default)
{
    var events = ChangeTracker.Entries<AggregateRoot>()
        .SelectMany(e => e.Entity.DomainEvents)
        .ToList();

    var result = await base.SaveChangesAsync(ct);

    foreach (var domainEvent in events)
        await _dispatcher.DispatchAsync(domainEvent, ct);

    return result;
}
```

## Domain events vs integration events

- **Domain events** — dispatched within the same bounded context,
  typically in the same process/transaction boundary as the aggregate
  change. Used to coordinate side effects between aggregates that live
  in the same context (e.g. `OrderConfirmed` triggers inventory
  reservation within the same service).
- **Integration events** — published across bounded context or service
  boundaries, usually via a message bus, and consumed asynchronously by
  other services. Use integration events when the reacting logic lives
  in a different bounded context (e.g. `Billing` reacting to
  `OrderConfirmed` from the `Ordering` context).

Do not conflate the two: translate a domain event into an integration
event at the bounded context's edge rather than publishing internal
domain events directly onto a shared message bus.

## Ubiquitous language

Name aggregates, entities, value objects, domain events, and domain
services using the vocabulary domain experts actually use — the
*ubiquitous language* for that bounded context — not generic CRUD or
technical terms.

```csharp
// WRONG — technical/CRUD naming hides business intent
order.Update();
order.SetStatus(3);
public class OrderService { public void Process(Order o) { ... } }

// RIGHT — ubiquitous language, intent-revealing
order.Confirm();
order.Cancel(reason: "Customer requested cancellation");
public sealed record OrderConfirmedDomainEvent(OrderId OrderId);
```

Keep this vocabulary consistent across code, tests, commit messages, and
conversations with domain experts within a given bounded context — the
same term can mean something different in another context, and that is
expected, not a bug.

## Interplay with vertical slice architecture

DDD's tactical patterns (aggregates, value objects, domain events) are
complementary to, not in conflict with, vertical slice architecture.
Organizing code by feature/use case (a vertical slice per command or
query) works well alongside a rich domain model: each slice's handler
loads an aggregate through its repository, invokes root methods to
change state, and lets the aggregate raise domain events — the slice
supplies the orchestration, the aggregate supplies the domain logic and
invariants. Avoid pushing business rules into the slice/handler itself;
that produces the same anemic-model problem DDD-003 warns against, just
organized by feature instead of by traditional layer.

