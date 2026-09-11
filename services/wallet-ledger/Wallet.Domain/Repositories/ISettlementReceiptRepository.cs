using Wallet.Domain.Entities;
namespace Wallet.Domain.Repositories;
public interface ISettlementReceiptRepository
{
    Task<SettlementReceipt?> GetAsync(Guid marketId, CancellationToken ct);
    Task AddAsync(SettlementReceipt receipt, CancellationToken ct);
}
