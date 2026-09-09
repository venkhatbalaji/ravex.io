namespace MarketCatalog.Application.Exceptions;

public sealed class PendingStakesException : Exception
{
    public PendingStakesException() : base("New stakes are blocked. Previously admitted stakes are still processing; retry locking shortly.") { }
}

public sealed class StakeAdmissionUnavailableException : Exception
{
    public StakeAdmissionUnavailableException() : base("Could not confirm stake admission closure. Retry the operation.") { }
}
