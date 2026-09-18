using MarketCatalog.Application.Contracts;
using MarketCatalog.Domain.Entities;
using MarketCatalog.Domain.Repositories;

namespace MarketCatalog.Application.UseCases;

public interface IListMarketsUseCase
{
    Task<MarketPageDto> ExecuteAsync(string? status, string? search, Guid? categoryId, string? phase,
        int limit = 20, int offset = 0, CancellationToken ct = default);
}

public sealed class ListMarketsUseCase : IListMarketsUseCase
{
    private readonly IMarketRepository _markets;

    public ListMarketsUseCase(IMarketRepository markets) => _markets = markets;

    public async Task<MarketPageDto> ExecuteAsync(string? status, string? search, Guid? categoryId, string? phase,
        int limit = 20, int offset = 0, CancellationToken ct = default)
    {
        if (limit is < 1 or > 100 || offset is < 0 or > 1_000_000)
            throw new ArgumentException("limit must be 1–100 and offset must be 0–1000000.");
        if (search?.Length > 100) throw new ArgumentException("Search must be at most 100 characters.");
        var parsedStatus = Parse<MarketStatus>(status, "status");
        var parsedPhase = Parse<MarketPhase>(phase, "phase");
        var observedAt = DateTimeOffset.UtcNow;
        var markets = await _markets.BrowseAsync(new MarketQuery(
            string.IsNullOrWhiteSpace(search) ? null : search.Trim(), categoryId, parsedStatus, parsedPhase, limit, offset, observedAt), ct);
        int? nextOffset = markets.Count > limit && offset + limit <= 1_000_000 ? offset + limit : null;
        return new MarketPageDto(markets.Take(limit).Select(MarketDto.From).ToList(), nextOffset, observedAt);
    }

    private static T? Parse<T>(string? value, string name) where T : struct, Enum
    {
        if (string.IsNullOrEmpty(value)) return null;
        if (!Enum.GetNames<T>().Any(n => n.Equals(value, StringComparison.OrdinalIgnoreCase)))
            throw new ArgumentException($"Unknown {name}.");
        return Enum.Parse<T>(value, true);
    }
}
