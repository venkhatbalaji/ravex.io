namespace MarketCatalog.Application.Exceptions;

public sealed class CategoryNotFoundException : Exception
{
    public CategoryNotFoundException(Guid id) : base($"No category found with id '{id}'.") { }
}
