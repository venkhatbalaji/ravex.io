using MarketCatalog.Domain.Entities;

namespace MarketCatalog.Domain.Repositories;

public enum MarketPhase { Upcoming, Live, Completed, Processing }

public record MarketQuery(string? Search, Guid? CategoryId, MarketStatus? Status,
    MarketPhase? Phase, int Limit, int Offset, DateTimeOffset ObservedAt);
