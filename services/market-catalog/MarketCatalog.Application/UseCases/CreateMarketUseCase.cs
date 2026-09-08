using MarketCatalog.Application.Contracts;
using MarketCatalog.Domain.Entities;
using MarketCatalog.Domain.Repositories;

namespace MarketCatalog.Application.UseCases;

public interface ICreateMarketUseCase
{
    Task<MarketDto> ExecuteAsync(CreateMarketRequest request, CancellationToken ct = default);
}

public sealed class CreateMarketUseCase : ICreateMarketUseCase
{
    private readonly IMarketRepository _markets;

    public CreateMarketUseCase(IMarketRepository markets) => _markets = markets;

    public async Task<MarketDto> ExecuteAsync(CreateMarketRequest request, CancellationToken ct = default)
    {
        var market = Market.Create(request.Title, request.Description ?? string.Empty, request.EventStartAt, request.Outcomes);
        await _markets.AddAsync(market, ct);
        return MarketDto.From(market);
    }
}
