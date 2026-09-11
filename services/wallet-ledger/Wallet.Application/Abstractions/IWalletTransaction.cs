namespace Wallet.Application.Abstractions;

public interface IWalletTransaction
{
    // Serializes every mutation for a user, including first-account creation.
    Task<IWalletTransactionScope> BeginAsync(Guid userId, Guid? operationId, CancellationToken ct, Guid? marketId = null);
}

public interface IWalletTransactionScope : IAsyncDisposable
{
    Task LockUserAsync(Guid userId, CancellationToken ct);
    Task CommitAsync(CancellationToken ct);
}
