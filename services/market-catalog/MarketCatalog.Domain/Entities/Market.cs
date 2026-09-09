using MarketCatalog.Domain.Exceptions;

namespace MarketCatalog.Domain.Entities;

public class Market
{
    private readonly List<Outcome> _outcomes = new();

    public Guid Id { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public DateTimeOffset EventStartAt { get; private set; }
    public MarketStatus Status { get; private set; }
    public Guid? WinningOutcomeId { get; private set; }
    public Guid? CategoryId { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public IReadOnlyList<Outcome> Outcomes => _outcomes;

    private Market()
    {
        // required by EF Core for materialization
    }

    public static Market Create(
        string title,
        string description,
        DateTimeOffset eventStartAt,
        IReadOnlyList<string> outcomeLabels,
        Guid? categoryId = null)
    {
        if (string.IsNullOrWhiteSpace(title))
            throw new InvalidMarketDefinitionException("A market needs a title.");
        if (outcomeLabels is null || outcomeLabels.Count < 2)
            throw new InvalidMarketDefinitionException("A market needs at least two outcomes.");

        var market = new Market
        {
            Id = Guid.NewGuid(),
            Title = title,
            Description = description,
            EventStartAt = eventStartAt,
            Status = MarketStatus.Open,
            CategoryId = categoryId,
            CreatedAt = DateTimeOffset.UtcNow
        };

        foreach (var label in outcomeLabels)
            market._outcomes.Add(Outcome.Create(market.Id, label));

        return market;
    }

    /// <summary>No further stakes may be accepted once a market locks.</summary>
    public void Lock()
    {
        if (Status != MarketStatus.Open)
            throw new InvalidMarketStateException($"A market must be open to lock; this one is {Status}.");

        Status = MarketStatus.Locked;
    }

    public void Settle(Guid winningOutcomeId)
    {
        if (Status != MarketStatus.Locked)
            throw new InvalidMarketStateException("A market must be locked before it can be settled.");
        if (!_outcomes.Any(o => o.Id == winningOutcomeId))
            throw new UnknownOutcomeException(winningOutcomeId);

        Status = MarketStatus.Settled;
        WinningOutcomeId = winningOutcomeId;
    }
}
