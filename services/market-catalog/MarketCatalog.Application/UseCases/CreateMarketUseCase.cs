using MarketCatalog.Application.Contracts;
using MarketCatalog.Application.Exceptions;
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
    private readonly ICategoryRepository _categories;

    public CreateMarketUseCase(IMarketRepository markets, ICategoryRepository categories)
    {
        _markets = markets;
        _categories = categories;
    }

    public async Task<MarketDto> ExecuteAsync(CreateMarketRequest request, CancellationToken ct = default)
    {
        if (request.CategoryId is { } categoryId && !await _categories.ExistsAsync(categoryId, ct))
            throw new CategoryNotFoundException(categoryId);

        var market = Market.Create(
            request.Title, request.Description ?? string.Empty, request.EventStartAt, request.Outcomes, request.CategoryId);
        await _markets.AddAsync(market, ct);
        return MarketDto.From(market);
    }
}
