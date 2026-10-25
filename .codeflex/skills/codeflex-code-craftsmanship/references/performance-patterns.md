# Performance Patterns

Guidance on algorithmic complexity, data structure selection, and
profiling (`CRAFT-007`). Performance awareness is not about premature
optimisation — it is about avoiding known pitfalls and making informed
choices.

## Algorithmic Complexity Awareness

Understand the Big O of operations you write and the data structures
you use. Most application code operates on small collections, so
constant factors matter more than asymptotic complexity. But when
collections grow, the difference between O(n) and O(n²) is the
difference between milliseconds and minutes.

### Common complexities

| Complexity | Name | Example |
|-----------|------|---------|
| O(1) | Constant | Dictionary lookup, array index |
| O(log n) | Logarithmic | Binary search, balanced tree lookup |
| O(n) | Linear | Single pass through a collection |
| O(n log n) | Linearithmic | Sorting, merge operations |
| O(n²) | Quadratic | Nested loops over the same collection |
| O(2^n) | Exponential | Naive recursive solutions |

### Recognising O(n²) in application code

```csharp
// Bad: O(n²) — for each order, scan all customers
var orders = await orderRepository.GetAllAsync(ct);
foreach (var order in orders)
{
    var customer = customers.FirstOrDefault(c => c.Id == order.CustomerId); // O(n) per iteration
    order.CustomerName = customer?.Name;
}

// Good: O(n) — build a lookup, then single pass
var customerMap = customers.ToDictionary(c => c.Id);
foreach (var order in orders)
{
    if (customerMap.TryGetValue(order.CustomerId, out var customer))
        order.CustomerName = customer.Name;
}
```

```typescript
// Bad: O(n²) — nested includes in template rendering
const orders = await db.orders.findMany();
const enriched = orders.map(order => ({
  ...order,
  customer: customers.find(c => c.id === order.customerId), // O(n) per iteration
}));

// Good: O(n) — index first
const customerMap = new Map(customers.map(c => [c.id, c]));
const enriched = orders.map(order => ({
  ...order,
  customer: customerMap.get(order.customerId),
}));
```

## Data Structure Selection

Choose data structures that match the access pattern. The right data
structure turns an O(n) operation into O(1).

| Access Pattern | .NET | TypeScript |
|---------------|------|------------|
| Key-value lookup | `Dictionary<K,V>`, `ConcurrentDictionary` | `Map<K,V>` |
| Ordered key-value | `SortedDictionary<K,V>` | `Map` (insertion order) |
| Unique set membership | `HashSet<T>` | `Set<T>` |
| FIFO queue | `Queue<T>` | Array with push/shift |
| LIFO stack | `Stack<T>` | Array with push/pop |
| Priority queue | `PriorityQueue<T>` (NET 6+) | Custom heap |
| Fixed-size buffer | `ArrayPool<T>`, `Span<T>` | `TypedArray` |

### Common mistakes

```csharp
// Bad: List.Contains() is O(n) — called in a loop, this is O(n²)
var allowedIds = new List<int> { 1, 2, 3, ... };
foreach (var item in items)
{
    if (allowedIds.Contains(item.Id)) // O(n) per call
        Process(item);
}

// Good: HashSet.Contains() is O(1)
var allowedIds = new HashSet<int> { 1, 2, 3, ... };
foreach (var item in items)
{
    if (allowedIds.Contains(item.Id)) // O(1) per call
        Process(item);
}
```

## Avoiding Unnecessary Allocations

### String concatenation in loops

```csharp
// Bad: creates a new string per iteration — O(n²) total
var result = "";
foreach (var item in items)
    result += item.Name + ", ";

// Good: StringBuilder for repeated concatenation
var sb = new StringBuilder();
foreach (var item in items)
    sb.Append(item.Name).Append(", ");
var result = sb.ToString();

// Better: string.Join
var result = string.Join(", ", items.Select(i => i.Name));
```

### Boxing and unboxing

```csharp
// Bad: value type boxed to object
var dict = new Hashtable();
dict.Add("count", 42); // boxes int to object
var count = (int)dict["count"]; // unboxes

// Good: generic collection avoids boxing
var dict = new Dictionary<string, int>();
dict.Add("count", 42); // no boxing
```

### Span<T> for zero-allocation slicing

```csharp
// Bad: allocates a new array
var bytes = File.ReadAllBytes("data.bin");
var header = bytes.Take(16).ToArray(); // allocation

// Good: Span<T> slices without allocation
var bytes = File.ReadAllBytes("data.bin");
var header = bytes.AsSpan(0, 16); // no allocation
```

## N+1 Query Prevention

The N+1 query problem is the most common performance issue in
data-access code. It occurs when you fetch a parent collection and
then issue one query per item to load a related entity.

```csharp
// Bad: N+1 — one query for orders, then one query per order for customer
var orders = await dbContext.Orders.ToListAsync();
foreach (var order in orders)
{
    order.Customer = await dbContext.Customers.FindAsync(order.CustomerId); // N queries!
}

// Good: single query with join or batch fetch
var orders = await dbContext.Orders
    .Include(o => o.Customer)
    .ToListAsync();

// Alternative: explicit batch fetch
var orders = await dbContext.Orders.ToListAsync();
var customerIds = orders.Select(o => o.CustomerId).Distinct().ToList();
var customers = await dbContext.Customers
    .Where(c => customerIds.Contains(c.Id))
    .ToDictionaryAsync(c => c.Id);
foreach (var order in orders)
    order.Customer = customers.GetValueOrDefault(order.CustomerId);
```

## Resource Management

### Dispose deterministic resources

Anything that holds unmanaged resources (file handles, network
connections, database connections) must be disposed.

```csharp
// Bad: stream not disposed on exception
var stream = File.OpenRead("data.csv");
var reader = new StreamReader(stream);
var content = reader.ReadToEnd(); // If this throws, stream leaks

// Good: using statement ensures disposal
using var stream = File.OpenRead("data.csv");
using var reader = new StreamReader(stream);
var content = reader.ReadToEnd();
```

### Async disposal

```csharp
// .NET 8+ supports IAsyncDisposable
await using var client = new HttpClient();
var response = await client.GetAsync(url);
```

### Connection pooling

Database connections are expensive to create. Always use connection
pooling (enabled by default in most providers). Never hold connections
longer than necessary.

```csharp
// Bad: holding a connection for the lifetime of a long-running operation
public class ReportService
{
    private readonly DbContext _context; // Holds connection open

    public async Task GenerateReportAsync()
    {
        // ... 30 seconds of computation while connection is held
    }
}

// Good: open connection only when needed
public class ReportService(IDbContextFactory<AppDbContext> factory)
{
    public async Task GenerateReportAsync()
    {
        var data = await ComputeDataAsync(); // No connection needed
        await using var context = await factory.CreateDbContextAsync();
        await context.Reports.AddAsync(new Report(data));
        await context.SaveChangesAsync();
    }
}
```

## Profiling Before Optimising

**Never guess at bottlenecks.** Profile first, then optimise the
measured bottleneck.

### .NET profiling tools

- **dotnet-trace**: Collect CPU, memory, and GC traces.
- **dotnet-counters**: Monitor GC, thread pool, and runtime counters.
- **BenchmarkDotNet**: Micro-benchmark specific methods.
- **Visual Studio Profiler**: CPU, memory, and database profiling.
- **JetBrains dotTrace / dotMemory**: CPU and memory profiling.

### TypeScript profiling tools

- **Chrome DevTools Performance tab**: CPU profiling, flame charts.
- **Node.js `--inspect`**: Chrome DevTools for Node processes.
- **clinic.js**: Automated performance diagnostics for Node.js.
- **Lighthouse**: Frontend performance auditing.

### Profiling workflow

1. **Identify the symptom.** Slow response time, high memory, CPU spike.
2. **Measure the baseline.** Record current metrics.
3. **Profile under load.** Use realistic data volumes.
4. **Identify the hotspot.** Find the top 1-3 methods consuming resources.
5. **Optimise the hotspot.** Apply targeted changes.
6. **Measure again.** Verify the improvement. If no improvement, revert.

## Performance Anti-Patterns

### Premature optimisation

Do not optimise code that is not slow. Write clear code first, profile,
then optimise the measured bottleneck.

### Cache invalidation blindness

Caching is powerful but introduces staleness risk. Every cache needs a
clear invalidation strategy.

```csharp
// Bad: cache with no invalidation
public class UserService
{
    private readonly Dictionary<string, User> _cache = new(); // Never invalidated

    public async Task<User?> GetUserAsync(string id)
    {
        if (_cache.TryGetValue(id, out var cached)) return cached;
        var user = await _repository.FindByIdAsync(id);
        _cache[id] = user;
        return user;
    }
}

// Good: cache with explicit invalidation
public class UserService(ICache cache)
{
    private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(5);

    public async Task<User?> GetUserAsync(string id, CancellationToken ct)
    {
        var cacheKey = $"user:{id}";
        return await cache.GetOrCreateAsync(cacheKey, async entry =>
        {
            entry.SlidingExpiration = CacheDuration;
            return await _repository.FindByIdAsync(id, ct);
        });
    }

    public async Task UpdateUserAsync(User user, CancellationToken ct)
    {
        await _repository.UpdateAsync(user, ct);
        await cache.RemoveAsync($"user:{user.Id}"); // Explicit invalidation
    }
}
```
