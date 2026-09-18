using MarketCatalog.Domain.Entities;

namespace MarketCatalog.Application.Contracts;

public record CreateMarketRequest(string Title, string? Description, DateTimeOffset EventStartAt, List<string> Outcomes, Guid? CategoryId = null);
public record SettleMarketRequest(Guid WinningOutcomeId, string Source);
public record CancelMarketRequest(string Reason);
public record MarketPageDto(IReadOnlyList<MarketDto> Items, int? NextOffset, DateTimeOffset ObservedAt);

public record OutcomeDto(Guid Id, string Label)
{
    public static OutcomeDto From(Outcome outcome) => new(outcome.Id, outcome.Label);
}

public record MarketDto(
    Guid Id,
    string Title,
    string Description,
    DateTimeOffset EventStartAt,
    string Status,
    Guid? WinningOutcomeId,
    Guid? CategoryId,
    IReadOnlyList<OutcomeDto> Outcomes,
    string ResultSource,
    Guid? ResolvedBy,
    DateTimeOffset? ResolutionRequestedAt,
    DateTimeOffset? ResolvedAt)
{
    public static MarketDto From(Market market) => new(
        market.Id,
        market.Title,
        market.Description,
        market.EventStartAt,
        market.Status.ToString().ToLowerInvariant(),
        market.WinningOutcomeId,
        market.CategoryId,
        market.Outcomes.Select(OutcomeDto.From).ToList(),
        market.ResultSource, market.ResolvedBy, market.ResolutionRequestedAt, market.ResolvedAt);
}
