using MarketCatalog.Domain.Entities;

namespace MarketCatalog.Application.Contracts;

public record CreateCategoryRequest(string Name);
public record UpdateCategoryRequest(string Name);

public record CategoryDto(Guid Id, string Name)
{
    public static CategoryDto From(Category category) => new(category.Id, category.Name);
}
