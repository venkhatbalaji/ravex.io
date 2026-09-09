using MarketCatalog.Application.Contracts;
using MarketCatalog.Application.Abstractions;
using MarketCatalog.Domain.Entities;
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
    private readonly IStakeAdmission _admission;

    public LockMarketUseCase(IMarketRepository markets, IStakeAdmission admission)
    {
        _markets = markets;
        _admission = admission;
    }

    public async Task<MarketDto> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var market = await _markets.GetByIdAsync(id, ct) ?? throw new MarketNotFoundException(id);
        if (market.Status != MarketStatus.Locked) market.Lock();
        await _admission.CloseAsync(id, ct);
        await _markets.SaveChangesAsync(ct);
        return MarketDto.From(market);
    }
}
