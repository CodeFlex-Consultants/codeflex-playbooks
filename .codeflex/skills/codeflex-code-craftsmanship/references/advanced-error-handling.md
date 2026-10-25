# Advanced Error Handling

Guidance on exception hierarchies, Result types, and error propagation
(`CRAFT-006`). The key distinction: **expected failures** use Result
types; **exceptional cases** use exceptions.

## The Two Categories of Failure

| Category | Mechanism | Example |
|----------|-----------|---------|
| Expected failure | Result / Either type | "Customer not found", "Insufficient funds" |
| Exceptional case | Exception | Database connection lost, out of memory |

**Expected failures** are part of normal business flow. The caller should
handle them explicitly. They are not exceptional — they are foreseeable.

**Exceptional cases** represent situations the code cannot recover from
locally. They propagate up the call stack to a handler that can respond.

## Result Types for Expected Failures

### .NET Result type

```csharp
public readonly record struct Result<T>
{
    private readonly T? _value;
    private readonly Error? _error;

    private Result(T value) { _value = value; _error = null; IsSuccess = true; }
    private Result(Error error) { _value = default; _error = error; IsSuccess = false; }

    public bool IsSuccess { get; }
    public T Value => IsSuccess ? _value! : throw new InvalidOperationException("Cannot access Value on a failed Result");
    public Error Error => !IsSuccess ? _error! : throw new InvalidOperationException("Cannot access Error on a successful Result");

    public static Result<T> Success(T value) => new(value);
    public static Result<T> Failure(Error error) => new(error);

    public static implicit operator Result<T>(T value) => Success(value);
    public static implicit operator Result<T>(Error error) => Failure(error);
}

public readonly record struct Error(string Code, string Message)
{
    public static Error NotFound(string message) => new("NOT_FOUND", message);
    public static Error Validation(string message) => new("VALIDATION", message);
    public static Error Conflict(string message) => new("CONFLICT", message);
}
```

### TypeScript Either type

```typescript
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

// Usage
async function findUser(id: UserId): Promise<Result<User, NotFoundError>> {
  const user = await db.users.findById(id);
  if (!user) return err(new NotFoundError(`User ${id} not found`));
  return ok(user);
}
```

### Using Result types

```csharp
public async Task<Result<OrderDto>> PlaceOrderAsync(PlaceOrderCommand cmd, CancellationToken ct)
{
    var customer = await customers.FindByIdAsync(cmd.CustomerId, ct);
    if (customer is null)
        return Error.NotFound($"Customer {cmd.CustomerId} not found");

    if (!cmd.Items.Any())
        return Error.Validation("Order must contain at least one item");

    var order = Order.Create(cmd.Items, customer);
    await repository.AddAsync(order, ct);

    return order.ToDto();
}

// Caller handles both outcomes explicitly
var result = await orderService.PlaceOrderAsync(cmd, ct);
if (!result.IsSuccess)
{
    return result.Error.Code switch
    {
        "NOT_FOUND" => Results.NotFound(ProblemDetails.For(result.Error)),
        "VALIDATION" => Results.BadRequest(ProblemDetails.For(result.Error)),
        _ => Results.Problem(result.Error.Message)
    };
}
return Results.Ok(result.Value);
```

## Exception Hierarchies for Exceptional Cases

Design domain-specific exception hierarchies. Catch specific exceptions,
not `Exception`.

```csharp
// Base domain exception
public abstract class DomainException(string message) : Exception(message)
{
    public abstract string ErrorCode { get; }
}

// Specific exceptions
public sealed class EntityNotFoundException(string entityName, string entityId)
    : DomainException($"{entityName} with id '{entityId}' was not found")
{
    public override string ErrorCode => "ENTITY_NOT_FOUND";
    public string EntityName { get; } = entityName;
    public string EntityId { get; } = entityId;
}

public sealed class InsufficientFundsException(decimal required, decimal available)
    : DomainException($"Insufficient funds: required {required}, available {available}")
{
    public override string ErrorCode => "INSUFFICIENT_FUNDS";
}

public sealed class ConcurrencyConflictException(string entityName, string entityId)
    : DomainException($"Concurrency conflict on {entityName} '{entityId}'")
{
    public override string ErrorCode => "CONCURRENCY_CONFLICT";
}
```

### Exception hierarchy rules

1. **Never throw `Exception` directly.** Always use a specific type.
2. **Never catch `Exception` at low levels.** Catch at the application boundary.
3. **Include context in the exception.** Entity name, ID, required vs actual values.
4. **Make exceptions immutable.** Pass context through the constructor.

## Error Propagation

### Wrap, do not swallow

When an exception crosses a boundary, wrap it with context. Never catch
and rethrow without adding information.

```csharp
// Bad: swallowing the exception
try
{
    await externalApi.CallAsync(request);
}
catch (HttpRequestException ex)
{
    _logger.LogWarning("API call failed"); // Lost the exception details
    return null; // Silent failure
}

// Bad: losing context
try
{
    await externalApi.CallAsync(request);
}
catch (HttpRequestException)
{
    throw; // No added context
}

// Good: wrapping with context
try
{
    await externalApi.CallAsync(request);
}
catch (HttpRequestException ex)
{
    throw new ExternalServiceException("PaymentGateway", request.Id, ex);
}
```

### Fail fast

Validate inputs at the boundary. Throw immediately on invalid state
rather than letting it propagate as a confusing null reference or
index-out-of-range later.

```csharp
// Bad: fails deep in the call stack with a confusing error
public async Task ProcessOrder(Order order)
{
    var customer = await GetCustomer(order.CustomerId);
    var total = order.Items.Sum(i => i.Price * i.Quantity); // NullRef if Items is null
    // ...
}

// Good: fails fast with a clear message
public async Task ProcessOrder(Order order)
{
    ArgumentNullException.ThrowIfNull(order);
    if (order.Items is null || order.Items.Count == 0)
        throw new ArgumentException("Order must have at least one item", nameof(order));
    // ...
}
```

## Never Use Exceptions for Control Flow

Exceptions are for exceptional cases. Using them for expected flow
creates performance overhead and obscures intent.

```csharp
// Bad: exception for control flow
public User? FindUser(string email)
{
    try
    {
        return _dbContext.Users.Single(u => u.Email == email);
    }
    catch (InvalidOperationException)
    {
        return null; // Expected case handled via exception
    }
}

// Good: explicit check
public User? FindUser(string email)
{
    return _dbContext.Users.SingleOrDefault(u => u.Email == email);
}
```

## Error Handling at Boundaries

### API boundary

Convert domain exceptions and Result failures into RFC 9457 ProblemDetails:

```csharp
public sealed class GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken ct)
    {
        var (statusCode, problemDetails) = exception switch
        {
            EntityNotFoundException e => (StatusCodes.Status404NotFound,
                ProblemDetailsFactory.Create(e.ErrorCode, e.Message)),
            ValidationException e => (StatusCodes.Status400BadRequest,
                ProblemDetailsFactory.Create("VALIDATION", e.Message, e.Errors)),
            ConcurrencyConflictException e => (StatusCodes.Status409Conflict,
                ProblemDetailsFactory.Create(e.ErrorCode, e.Message)),
            _ => (StatusCodes.Status500InternalServerError,
                ProblemDetailsFactory.Create("INTERNAL", "An unexpected error occurred"))
        };

        logger.LogError(exception, "Handled exception: {ErrorCode}", problemDetails.Type);
        httpContext.Response.StatusCode = statusCode;
        await httpContext.Response.WriteAsJsonAsync(problemDetails, ct);
        return true;
    }
}
```

### Service boundary

Convert infrastructure exceptions into domain exceptions:

```csharp
public sealed class SqlOrderRepository(DbContext context) : IOrderRepository
{
    public async Task SaveAsync(Order order, CancellationToken ct)
    {
        try
        {
            await context.Orders.AddAsync(order, ct);
            await context.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException ex)
        {
            throw new ConcurrencyConflictException(nameof(Order), order.Id.ToString(), ex);
        }
        catch (DbUpdateException ex)
        {
            throw new PersistenceException("Failed to save order", ex);
        }
    }
}
```
