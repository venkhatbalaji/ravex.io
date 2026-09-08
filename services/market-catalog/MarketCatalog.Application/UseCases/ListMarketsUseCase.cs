using MarketCatalog.Application.Contracts;
using MarketCatalog.Domain.Entities;
using MarketCatalog.Domain.Repositories;

namespace MarketCatalog.Application.UseCases;

public interface IListMarketsUseCase
{
    Task<IReadOnlyList<MarketDto>> ExecuteAsync(string? status, CancellationToken ct = default);
}

public sealed class ListMarketsUseCase : IListMarketsUseCase
{
    private readonly IMarketRepository _markets;

    public ListMarketsUseCase(IMarketRepository markets) => _markets = markets;

    public async Task<IReadOnlyList<MarketDto>> ExecuteAsync(string? status, CancellationToken ct = default)
    {
        MarketStatus? parsedStatus = !string.IsNullOrWhiteSpace(status) && Enum.TryParse<MarketStatus>(status, true, out var s)
            ? s
            : null;

        var markets = await _markets.GetAllAsync(parsedStatus, ct);
        return markets.Select(MarketDto.From).ToList();
    }
}
