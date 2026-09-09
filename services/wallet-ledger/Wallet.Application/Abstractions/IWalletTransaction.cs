namespace Wallet.Application.Abstractions;

public interface IWalletTransaction
{
    // Serializes every mutation for a user, including first-account creation.
    Task<IWalletTransactionScope> BeginAsync(Guid userId, Guid? operationId, CancellationToken ct);
}

public interface IWalletTransactionScope : IAsyncDisposable
{
    Task CommitAsync(CancellationToken ct);
}
