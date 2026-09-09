using MarketCatalog.Application.Contracts;
using MarketCatalog.Application.Abstractions;
using MarketCatalog.Application.Exceptions;
using MarketCatalog.Domain.Repositories;

namespace MarketCatalog.Application.UseCases;

public interface ISettleMarketUseCase
{
    Task<MarketDto> ExecuteAsync(Guid id, SettleMarketRequest request, CancellationToken ct = default);
}

public sealed class SettleMarketUseCase : ISettleMarketUseCase
{
    private readonly IMarketRepository _markets;
    private readonly IStakeAdmission _admission;

    public SettleMarketUseCase(IMarketRepository markets, IStakeAdmission admission)
    {
        _markets = markets;
        _admission = admission;
    }

    public async Task<MarketDto> ExecuteAsync(Guid id, SettleMarketRequest request, CancellationToken ct = default)
    {
        var market = await _markets.GetByIdAsync(id, ct) ?? throw new MarketNotFoundException(id);
        market.Settle(request.WinningOutcomeId);
        await _admission.CloseAsync(id, ct);
        await _markets.SaveChangesAsync(ct);
        return MarketDto.From(market);
    }
}
