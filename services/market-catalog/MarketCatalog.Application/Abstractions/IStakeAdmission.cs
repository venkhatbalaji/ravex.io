namespace MarketCatalog.Application.Abstractions;

public interface IStakeAdmission
{
    // Close the durable gate and confirm all admitted stakes are terminal.
    // A failed call leaves the catalog unchanged; retrying closure is safe.
    Task<bool> ResolveAsync(Guid marketId, CancellationToken ct);
    Task CloseAsync(Guid marketId, CancellationToken ct);
}
