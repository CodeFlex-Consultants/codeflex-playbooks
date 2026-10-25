# Code-First Patterns

## DbContext setup

```csharp
public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext() : base("DefaultConnection")
    {
    }

    public DbSet<Blog> Blogs { get; set; }
    public DbSet<Post> Posts { get; set; }

    protected override void OnModelCreating(DbModelBuilder modelBuilder)
    {
        // Fluent API configuration
        modelBuilder.Entity<Blog>()
            .ToTable("Blogs")
            .HasKey(b => b.Id);

        modelBuilder.Entity<Post>()
            .ToTable("Posts")
            .HasKey(p => p.Id)
            .HasRequired(p => p.Blog)
            .WithMany(b => b.Posts)
            .HasForeignKey(p => p.BlogId);

        base.OnModelCreating(modelBuilder);
    }
}
```

## Entity configuration with Fluent API

```csharp
public class BlogConfiguration : EntityTypeConfiguration<Blog>
{
    public BlogConfiguration()
    {
        ToTable("Blogs");

        HasKey(b => b.Id);

        Property(b => b.Url)
            .IsRequired()
            .HasMaxLength(500)
            .IsUnicode(false);

        Property(b => b.Title)
            .IsRequired()
            .HasMaxLength(200);

        Property(b => b.CreatedAt)
            .HasDatabaseGeneratedOption(DatabaseGeneratedOption.Computed);

        HasMany(b => b.Posts)
            .WithRequired(p => p.Blog)
            .HasForeignKey(p => p.BlogId)
            .WillCascadeOnDelete(false);
    }
}

// Register in DbContext
protected override void OnModelCreating(DbModelBuilder modelBuilder)
{
    modelBuilder.Configurations.Add(new BlogConfiguration());
    // Or load all from assembly
    modelBuilder.Configurations.AddFromAssembly(typeof(ApplicationDbContext).Assembly);
}
```

## Conventions

```csharp
// Custom convention
public class DateTimeConvention : Convention
{
    public DateTimeConvention()
    {
        this.Properties<DateTime>()
            .Configure(c => c.HasColumnType("datetime2"));
    }
}

// Register convention
protected override void OnModelCreating(DbModelBuilder modelBuilder)
{
    modelBuilder.Conventions.Add(new DateTimeConvention());
}
```

## Seeding data

```csharp
public class BlogInitializer : DropCreateDatabaseIfModelChanges<ApplicationDbContext>
{
    protected override void Seed(ApplicationDbContext context)
    {
        context.Blogs.Add(new Blog
        {
            Url = "http://sample.com",
            Title = "Sample Blog"
        });

        context.SaveChanges();
    }
}

// Register initializer
Database.SetInitializer(new BlogInitializer());
```

## Connection string

```xml
<!-- Web.config / App.config -->
<connectionStrings>
  <add name="DefaultConnection"
       connectionString="Server=.;Database=MyApp;Integrated Security=True;MultipleActiveResultSets=True"
       providerName="System.Data.SqlClient" />
</connectionStrings>
```

## Repository pattern

```csharp
public interface IRepository<T> where T : class
{
    IQueryable<T> GetAll();
    T GetById(int id);
    void Add(T entity);
    void Update(T entity);
    void Delete(T entity);
}

public class Repository<T> : IRepository<T> where T : class
{
    protected readonly ApplicationDbContext Context;
    protected readonly DbSet<T> DbSet;

    public Repository(ApplicationDbContext context)
    {
        Context = context;
        DbSet = context.Set<T>();
    }

    public IQueryable<T> GetAll() => DbSet;

    public T GetById(int id) => DbSet.Find(id);

    public void Add(T entity) => DbSet.Add(entity);

    public void Update(T entity)
    {
        Context.Entry(entity).State = EntityState.Modified;
    }

    public void Delete(T entity) => DbSet.Remove(entity);
}
```
