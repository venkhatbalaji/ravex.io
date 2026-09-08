using MarketCatalog.Application.Contracts;
using MarketCatalog.Application.Exceptions;
using MarketCatalog.Domain.Repositories;

namespace MarketCatalog.Application.UseCases;

public interface IGetMarketUseCase
{
    Task<MarketDto> ExecuteAsync(Guid id, CancellationToken ct = default);
}

public sealed class GetMarketUseCase : IGetMarketUseCase
{
    private readonly IMarketRepository _markets;

    public GetMarketUseCase(IMarketRepository markets) => _markets = markets;

    public async Task<MarketDto> ExecuteAsync(Guid id, CancellationToken ct = default)
    {
        var market = await _markets.GetByIdAsync(id, ct) ?? throw new MarketNotFoundException(id);
        return MarketDto.From(market);
    }
}
