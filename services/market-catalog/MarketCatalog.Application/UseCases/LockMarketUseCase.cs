using MarketCatalog.Application.Contracts;
using MarketCatalog.Application.Exceptions;
using MarketCatalog.Domain.Repositories;

namespace MarketCatalog.Application.UseCases;

public interface ILockMarketUseCase
{
    Task<MarketDto> ExecuteAsync(Guid id, CancellationToken ct = default);
}

public sealed class LockMarketUseCase : ILockMarketUseCase
{
    private readonly IMarketRepository _markets;

    public LockMarketUseCase(IMarketRepository markets) => _markets = markets;

    public async Task<MarketDto> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var market = await _markets.GetByIdAsync(id, ct) ?? throw new MarketNotFoundException(id);
        market.Lock();
        await _markets.SaveChangesAsync(ct);
        return MarketDto.From(market);
    }
}
