using MarketCatalog.Application.Contracts;
using MarketCatalog.Application.Abstractions;
using MarketCatalog.Application.Exceptions;
using MarketCatalog.Domain.Repositories;
namespace MarketCatalog.Application.UseCases;

public interface ISettleMarketUseCase
{
    Task<MarketDto> ExecuteAsync(Guid id, SettleMarketRequest request, Guid actor, CancellationToken ct = default);
}
public interface ICancelMarketUseCase
{
    Task<MarketDto> ExecuteAsync(Guid id, CancelMarketRequest request, Guid actor, CancellationToken ct = default);
}
public sealed class SettleMarketUseCase(IMarketRepository markets, IStakeAdmission admission) : ISettleMarketUseCase, ICancelMarketUseCase
{
    public Task<MarketDto> ExecuteAsync(Guid id, SettleMarketRequest request, Guid actor, CancellationToken ct = default) =>
        BeginAsync(id, request.WinningOutcomeId, false, request.Source, actor, ct);
    public Task<MarketDto> ExecuteAsync(Guid id, CancelMarketRequest request, Guid actor, CancellationToken ct = default) =>
        BeginAsync(id, null, true, request.Reason, actor, ct);
    private async Task<MarketDto> BeginAsync(Guid id, Guid? winner, bool cancel, string source, Guid actor, CancellationToken ct)
    {
        var market = await markets.GetByIdAsync(id, ct) ?? throw new MarketNotFoundException(id);
        market.BeginResolution(winner, cancel, source, actor);
        await admission.CloseAsync(id, ct);
        await markets.SaveChangesAsync(ct);
        // This committed row is also the recovery queue. The worker publishes
        // the immutable decision until Settlement confirms wallet completion.
        return MarketDto.From(market);
    }
}
