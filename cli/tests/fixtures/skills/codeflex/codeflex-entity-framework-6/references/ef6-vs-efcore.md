# EF6 vs EF Core

## Key differences

| Feature | EF6 | EF Core |
|---------|-----|---------|
| Platform | .NET Framework | .NET Core / .NET 5+ |
| Performance | Good | Better (compiled queries, batching) |
| Migrations | Package Manager Console | dotnet CLI |
| Cross-platform | No | Yes |
| LINQ translation | Client evaluation possible | Server-side only |
| Bulk operations | Third-party libraries | Built-in (EF Core 7+) |
| Spatial data | DbGeography/DbGeometry | NetTopologySuite |
| Temporal tables | No | Yes |

## Migration planning

### Assess current EF6 usage

1. **Count entities and relationships** — Large models take longer to migrate
2. **Identify stored procedures** — EF Core has limited stored procedure support
3. **Check for EDMX** — Database-first models need conversion to code-first
4. **Review custom conventions** — Some conventions don't exist in EF Core
5. **Test third-party integrations** — Ensure libraries support EF Core

### Migration strategy

```csharp
// Option 1: Side-by-side (recommended for large apps)
// Install both EF6 and EF Core in different projects
// Gradually migrate features

// Option 2: Big bang (small apps only)
// Migrate all at once
// Higher risk, faster completion

// Option 3: Strangler fig pattern
// New features use EF Core
// Old features remain on EF6
// Gradually replace EF6 code
```

### Code migration examples

```csharp
// EF6
public class BlogContext : DbContext
{
    public DbSet<Blog> Blogs { get; set; }

    protected override void OnModelCreating(DbModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Blog>()
            .Property(b => b.Url)
            .IsRequired()
            .HasMaxLength(500);
    }
}

// EF Core
public class BlogContext : DbContext
{
    public DbSet<Blog> Blogs { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Blog>()
            .Property(b => b.Url)
            .IsRequired()
            .HasMaxLength(500);
    }
}
```

## Package references

```xml
<!-- EF6 -->
<PackageReference Include="EntityFramework" Version="6.4.4" />

<!-- EF Core -->
<PackageReference Include="Microsoft.EntityFrameworkCore" Version="8.0.0" />
<PackageReference Include="Microsoft.EntityFrameworkCore.SqlServer" Version="8.0.0" />
```

## NuGet commands

```powershell
# EF6
Enable-Migrations
Add-Migration InitialCreate
Update-Database

# EF Core
dotnet ef migrations add InitialCreate
dotnet ef database update
```
