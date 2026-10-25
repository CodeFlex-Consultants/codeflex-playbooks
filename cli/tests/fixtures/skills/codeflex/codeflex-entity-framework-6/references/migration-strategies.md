# Migration Strategies

## Enabling migrations

```powershell
# Enable Code First Migrations
Enable-Migrations

# Creates Migrations folder with Configuration.cs
```

```csharp
// Configuration.cs
public class Configuration : DbMigrationsConfiguration<ApplicationDbContext>
{
    public Configuration()
    {
        AutomaticMigrationsEnabled = false; // Always false in production
        AutomaticMigrationDataLossAllowed = false;
    }

    protected override void Seed(ApplicationDbContext context)
    {
        // Seed data after each migration
    }
}
```

## Creating migrations

```powershell
# Add migration
Add-Migration AddBlogRating

# Creates timestamped migration file
# Migrations/202609171200000_AddBlogRating.cs
```

```csharp
public partial class AddBlogRating : DbMigration
{
    public override void Up()
    {
        AddColumn("dbo.Blogs", "Rating", c => c.Int(nullable: false, defaultValue: 0));
    }

    public override void Down()
    {
        DropColumn("dbo.Blogs", "Rating");
    }
}
```

## Applying migrations

```powershell
# Update database to latest migration
Update-Database

# Update to specific migration
Update-Database -TargetMigration "AddBlogRating"

# Generate SQL script (for production)
Update-Database -Script

# Verbose output
Update-Database -Verbose
```

## Team workflow

### Branch strategy

```
1. Developer creates migration locally
2. Commit migration file to source control
3. Pull latest changes
4. If conflicts, resolve and rebase
5. Test migration on local database
6. Push to feature branch
7. Review migration in PR
8. Merge to main
```

### Handling conflicts

```powershell
# If someone else added a migration
Update-Database # Apply their migration first
Add-Migration MyChanges # Rebase your migration
```

### Migration best practices

1. **Small, focused migrations** — One logical change per migration
2. **Test before committing** — Apply and rollback locally
3. **Review in PRs** — Migrations are code, require review
4. **Never edit applied migrations** — Create new migration for changes
5. **Use seed method carefully** — Only for reference data

## Production deployment

### Generate idempotent script

```powershell
# Generate script that checks migration history
Update-Database -Script -SourceMigration $InitialDatabase
```

```sql
-- Generated script example
IF [__MigrationId] < '20260917_AddBlogRating'
BEGIN
    ALTER TABLE [Blogs] ADD [Rating] INT NOT NULL DEFAULT 0;
    INSERT [__MigrationHistory] ...
END
```

### Deployment checklist

1. ✅ Backup database before migration
2. ✅ Test migration script on staging
3. ✅ Review breaking changes (column drops, renames)
4. ✅ Plan rollback strategy
5. ✅ Schedule during low-traffic window
6. ✅ Monitor application after deployment

### Rollback strategy

```powershell
# Rollback to previous migration
Update-Database -TargetMigration "PreviousMigration"

# Generate rollback script
Update-Database -TargetMigration "PreviousMigration" -Script
```

## Data migrations

```csharp
public partial class MigrateBlogData : DbMigration
{
    public override void Up()
    {
        // SQL for data migration
        Sql(@"
            UPDATE Blogs
            SET Rating = CASE
                WHEN PostCount > 100 THEN 5
                WHEN PostCount > 50 THEN 4
                WHEN PostCount > 10 THEN 3
                ELSE 0
            END
        ");
    }

    public override void Down()
    {
        Sql("UPDATE Blogs SET Rating = 0");
    }
}
```
