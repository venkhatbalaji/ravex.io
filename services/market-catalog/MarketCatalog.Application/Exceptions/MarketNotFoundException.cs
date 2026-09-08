namespace MarketCatalog.Application.Exceptions;

public sealed class MarketNotFoundException : Exception
{
    public MarketNotFoundException(Guid id) : base($"No market found with id '{id}'.") { }
}
