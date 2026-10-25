# Value Objects and C# Records

## What makes a value object

A value object is defined entirely by the values of its attributes — it
has no identity. Two value objects with the same attribute values are
interchangeable: `new Money(100, "USD") == new Money(100, "USD")` must
be `true`. Common examples: `Money`, `Address`, `EmailAddress`,
`DateRange`, strongly-typed IDs.

Rules for every value object:

- **Immutable** — no setters, no in-place mutation. Changes produce a
  new instance.
- **Structural equality** — equality compares attribute values, not
  reference identity.
- **Self-validating** — invalid data cannot exist; validate in a
  constructor or factory method.
- **Behaviour-rich** — encapsulate operations relevant to the concept
  (`Money.Add`, `DateRange.Overlaps`), not just raw data.

## C# records are the default choice

C# `record` types (introduced in C# 9, still the current recommended
approach) provide value-based equality, `init`-only properties, and a
concise `with` expression for non-destructive updates — all the
mechanics a value object needs, built into the language.

```csharp
public sealed record Money
{
    public decimal Amount { get; }
    public string Currency { get; }

    private Money(decimal amount, string currency)
    {
        Amount = amount;
        Currency = currency;
    }

    public static Result<Money> Create(decimal amount, string currency)
    {
        if (amount < 0)
            return Result.Failure<Money>(new Error("Money.Negative", "Amount cannot be negative."));

        if (string.IsNullOrWhiteSpace(currency) || currency.Length != 3)
            return Result.Failure<Money>(new Error("Money.InvalidCurrency", "Currency must be a 3-letter ISO code."));

        return Result.Success(new Money(Math.Round(amount, 2), currency.ToUpperInvariant()));
    }

    public static Money Zero => new(0m, "USD");

    public Result<Money> Add(Money other)
    {
        if (Currency != other.Currency)
            return Result.Failure<Money>(new Error("Money.CurrencyMismatch",
                $"Cannot add {Currency} and {other.Currency}."));

        return Money.Create(Amount + other.Amount, Currency);
    }

    public override string ToString() => $"{Amount:F2} {Currency}";
}
```

```csharp
public sealed record EmailAddress
{
    public string Value { get; }

    private EmailAddress(string value) => Value = value;

    public static Result<EmailAddress> Create(string value)
    {
        if (string.IsNullOrWhiteSpace(value) || !value.Contains('@'))
            return Result.Failure<EmailAddress>(new Error("Email.Invalid", "A valid email address is required."));

        return Result.Success(new EmailAddress(value.Trim().ToLowerInvariant()));
    }

    public override string ToString() => Value;
}
```

Prefer returning a `Result<T>` (or throwing a domain exception, per team
convention) from the factory method rather than throwing directly from
a public constructor — this keeps validation explicit at the call site
and avoids exceptions for expected validation failures.

## `readonly record struct` for high-frequency simple wrappers

For simple, frequently-allocated value objects on hot paths (e.g.
strongly-typed IDs created millions of times), a `readonly record
struct` avoids heap allocation while keeping value semantics:

```csharp
public readonly record struct OrderId(Guid Value)
{
    public static OrderId New() => new(Guid.NewGuid());
    public override string ToString() => Value.ToString();
}
```

Trade-off: `readonly record struct` cannot share a common base class, so
use it for simple standalone wrappers; use `record` classes for value
objects with richer behaviour or that need to be shared via a common
`ValueObject` base type.

## Never expose mutable value objects

```csharp
// WRONG — mutable value object breaks equality guarantees and immutability
public class Address
{
    public string Street { get; set; }
    public string City { get; set; }
}

// RIGHT — immutable, structurally equal, self-validating
public sealed record Address
{
    public string Street { get; }
    public string City { get; }
    public string Country { get; }

    private Address(string street, string city, string country)
    {
        Street = street;
        City = city;
        Country = country;
    }

    public static Result<Address> Create(string street, string city, string country)
    {
        if (string.IsNullOrWhiteSpace(street) || string.IsNullOrWhiteSpace(city))
            return Result.Failure<Address>(new Error("Address.Invalid", "Street and city are required."));

        return Result.Success(new Address(street, city, country));
    }
}
```

## Persisting value objects with EF Core

- Single-value wrappers (e.g. `EmailAddress`, `OrderId`): use a value
  converter so no schema change is required.
- Multi-value objects (e.g. `Money`, `Address`): use `OwnsOne` (owned
  entity types) or EF Core 8+ Complex Types (`ComplexProperty`) to map
  to columns on the owner's table — no separate table, no foreign keys.

```csharp
builder.Property(o => o.CustomerEmail)
    .HasConversion(email => email.Value, value => EmailAddress.Create(value).Value)
    .HasMaxLength(256);

builder.OwnsOne(o => o.ShippingAddress, address =>
{
    address.Property(a => a.Street).HasMaxLength(200).IsRequired();
    address.Property(a => a.City).HasMaxLength(100).IsRequired();
    address.Property(a => a.Country).HasMaxLength(2).IsRequired();
});
```

Value objects must never leak outside the domain layer. Public API
contracts (request/response DTOs) should use primitives (`string`,
`decimal`); map to and from value objects at the application boundary.

