namespace MarketCatalog.Domain.Exceptions;

public abstract class MarketDomainException : Exception
{
    protected MarketDomainException(string message) : base(message) { }
}

public sealed class InvalidMarketDefinitionException : MarketDomainException
{
    public InvalidMarketDefinitionException(string message) : base(message) { }
}

public sealed class InvalidMarketStateException : MarketDomainException
{
    public InvalidMarketStateException(string message) : base(message) { }
}

public sealed class UnknownOutcomeException : MarketDomainException
{
    public UnknownOutcomeException(Guid outcomeId) : base($"'{outcomeId}' is not an outcome of this market.") { }
}

public sealed class InvalidCategoryDefinitionException : MarketDomainException
{
    public InvalidCategoryDefinitionException(string message) : base(message) { }
}
