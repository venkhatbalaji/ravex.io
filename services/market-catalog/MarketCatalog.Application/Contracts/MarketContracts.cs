using MarketCatalog.Domain.Entities;

namespace MarketCatalog.Application.Contracts;

public record CreateMarketRequest(string Title, string? Description, DateTimeOffset EventStartAt, List<string> Outcomes);
public record SettleMarketRequest(Guid WinningOutcomeId);

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
    IReadOnlyList<OutcomeDto> Outcomes)
{
    public static MarketDto From(Market market) => new(
        market.Id,
        market.Title,
        market.Description,
        market.EventStartAt,
        market.Status.ToString().ToLowerInvariant(),
        market.WinningOutcomeId,
        market.Outcomes.Select(OutcomeDto.From).ToList());
}
