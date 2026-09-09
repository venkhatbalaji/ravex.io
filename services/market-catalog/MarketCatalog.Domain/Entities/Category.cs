using MarketCatalog.Domain.Exceptions;

namespace MarketCatalog.Domain.Entities;

public class Category
{
    public Guid Id { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; private set; }

    private Category()
    {
        // required by EF Core for materialization
    }

    public static Category Create(string name)
    {
        Validate(name);
        return new Category { Id = Guid.NewGuid(), Name = name.Trim(), CreatedAt = DateTimeOffset.UtcNow };
    }

    public void Rename(string name)
    {
        Validate(name);
        Name = name.Trim();
    }

    private static void Validate(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new InvalidCategoryDefinitionException("A category needs a name.");
    }
}
